"""
InterviewVault — Adaptive Diagnostic Routes
Step-laddered easy -> intermediate -> advanced questions per topic. Stop at
first failure; classify each topic into weak / intermediate / expert; auto-
re-balance the user's LearningPath green/yellow lists at completion.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db
from services.ai_service import _generate, _safe_parse_json
from services.learning_path_service import STANDARD_PATHS, get_standard_path
from services.skill_profile_service import upsert_score

router = APIRouter(prefix="/api/diagnostic", tags=["Diagnostic"])

LEVEL_ORDER = ["easy", "intermediate", "advanced"]
PASS_THRESHOLD = 70  # score (0-100) needed to advance to the next level


# ─── Schemas ──────────────────────────────────────────────────────────────────
class StartDiagnosticRequest(BaseModel):
    job_role: str
    topics: Optional[List[str]] = None  # override the default green list


class NextQuestionRequest(BaseModel):
    session_id: int


class SubmitAnswerRequest(BaseModel):
    session_id: int
    question: str
    answer: str
    level: Optional[str] = None  # informational; we trust DB state


class CompleteRequest(BaseModel):
    session_id: int
    apply_to_path: bool = True


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _load_session(db: Session, sid: int, user_id: int) -> models.DiagnosticSession:
    s = (
        db.query(models.DiagnosticSession)
        .filter(
            models.DiagnosticSession.id == sid,
            models.DiagnosticSession.user_id == user_id,
        )
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Diagnostic session not found.")
    return s


def _topics_for_session(s: models.DiagnosticSession) -> List[str]:
    """Topics list snapshotted at start (stored under results._meta.topics)."""
    meta = (s.results or {}).get("_meta", {}) if isinstance(s.results, dict) else {}
    return meta.get("topics", []) or []


def _set_meta(s: models.DiagnosticSession, key: str, value: Any) -> None:
    results = dict(s.results or {})
    meta = dict(results.get("_meta", {}))
    meta[key] = value
    results["_meta"] = meta
    s.results = results


def _record_topic_result(
    s: models.DiagnosticSession,
    topic: str,
    level: str,
    score: float,
    passed: bool,
) -> None:
    results = dict(s.results or {})
    entry = dict(results.get(topic, {}))
    levels = list(entry.get("levels", []))
    levels.append({"level": level, "score": score, "passed": passed})
    entry["levels"] = levels
    if passed:
        entry["level_reached"] = level
    elif "level_reached" not in entry:
        entry["level_reached"] = None
    entry["last_score"] = score
    results[topic] = entry
    s.results = results


def _generate_question(topic: str, role_id: str, level: str) -> Dict[str, Any]:
    role_title = STANDARD_PATHS.get(role_id, {}).get("title", role_id.replace("_", " ").title())
    prompt = f"""You are an interviewer running a quick adaptive diagnostic.
Generate ONE clear {level}-level interview question on the topic: "{topic}"
for a {role_title}. The question should be answerable in 2-4 sentences.

Return ONLY JSON in this exact shape:
{{
  "question": "The question text",
  "expected_keywords": ["keyword1", "keyword2", "keyword3"],
  "model_answer": "1-2 sentence ideal answer for grading reference"
}}"""
    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, dict) and parsed.get("question"):
            parsed.setdefault("expected_keywords", [])
            parsed.setdefault("model_answer", "")
            return parsed
    return {
        "question": f"At a {level} level, explain {topic} and give one practical example.",
        "expected_keywords": [],
        "model_answer": "",
    }


def _grade_answer(topic: str, level: str, question: str, answer: str) -> Dict[str, Any]:
    prompt = f"""You are grading a candidate's diagnostic-test answer.
Topic: {topic}
Level: {level}
Question: {question}
Candidate's answer: "{answer[:1200]}"

Score the answer 0-100 based on correctness, depth, and clarity for the
target level. Be honest but fair. Return JSON:
{{
  "score": 0,
  "passed": false,
  "feedback": "1-2 sentence feedback"
}}
Treat 'passed' as score >= {PASS_THRESHOLD}."""
    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, dict) and "score" in parsed:
            try:
                score = max(0, min(100, int(parsed.get("score", 0))))
            except (ValueError, TypeError):
                score = 0
            return {
                "score": score,
                "passed": bool(parsed.get("passed", score >= PASS_THRESHOLD)),
                "feedback": parsed.get("feedback", ""),
            }
    # Fallback: treat any non-trivial answer as a 50.
    score = 50 if answer and len(answer.strip()) > 30 else 0
    return {"score": score, "passed": False, "feedback": "Unable to grade — give it another try."}


def _classify_topic(entry: Dict[str, Any]) -> str:
    """Map a topic's diagnostic entry into weak / intermediate / expert."""
    reached = entry.get("level_reached")
    if reached == "advanced":
        return "expert"
    if reached == "intermediate":
        return "intermediate"
    return "weak"


# ─── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/start")
def start_diagnostic(
    data: StartDiagnosticRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Begin a diagnostic session for the given role."""
    role = data.job_role
    if role not in STANDARD_PATHS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")

    topics = data.topics or list(get_standard_path(role)["green"])
    if not topics:
        raise HTTPException(status_code=400, detail="No topics to diagnose.")

    # Close any existing in-progress session for this role.
    open_session = (
        db.query(models.DiagnosticSession)
        .filter(
            models.DiagnosticSession.user_id == current_user.id,
            models.DiagnosticSession.job_role == role,
            models.DiagnosticSession.status == "in_progress",
        )
        .first()
    )
    if open_session:
        open_session.status = "abandoned"
        db.flush()

    session = models.DiagnosticSession(
        user_id=current_user.id,
        job_role=role,
        status="in_progress",
        results={},
        current_topic_index=0,
        current_difficulty="easy",
    )
    db.add(session)
    db.flush()
    _set_meta(session, "topics", topics)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "job_role": role,
        "topics": topics,
        "current_topic": topics[0],
        "current_level": "easy",
        "total_topics": len(topics),
        "current_topic_index": 0,
    }


@router.post("/next-question")
def next_question(
    data: NextQuestionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the next question based on session state."""
    session = _load_session(db, data.session_id, current_user.id)
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Session already completed.")

    topics = _topics_for_session(session)
    if session.current_topic_index >= len(topics):
        return {"done": True, "message": "All topics complete. Call /complete."}

    topic = topics[session.current_topic_index]
    level = session.current_difficulty or "easy"
    q = _generate_question(topic, session.job_role, level)

    return {
        "session_id": session.id,
        "topic": topic,
        "level": level,
        "topic_index": session.current_topic_index,
        "total_topics": len(topics),
        "question": q["question"],
        "expected_keywords": q.get("expected_keywords", []),
    }


@router.post("/submit-answer")
def submit_answer(
    data: SubmitAnswerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Grade the answer and advance the ladder."""
    session = _load_session(db, data.session_id, current_user.id)
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Session already completed.")

    topics = _topics_for_session(session)
    if session.current_topic_index >= len(topics):
        raise HTTPException(status_code=400, detail="No active topic. Call /complete.")

    topic = topics[session.current_topic_index]
    level = session.current_difficulty or "easy"
    grade = _grade_answer(topic, level, data.question, data.answer)
    _record_topic_result(session, topic, level, grade["score"], grade["passed"])

    advanced_to_next_topic = False
    advanced_level = level

    if grade["passed"] and level != LEVEL_ORDER[-1]:
        # Move up the ladder
        next_level = LEVEL_ORDER[LEVEL_ORDER.index(level) + 1]
        session.current_difficulty = next_level
        advanced_level = next_level
    else:
        # Move to the next topic, reset level
        session.current_topic_index += 1
        session.current_difficulty = "easy"
        advanced_to_next_topic = True

    db.commit()
    db.refresh(session)

    finished = session.current_topic_index >= len(topics)

    return {
        "session_id": session.id,
        "topic": topic,
        "level": level,
        "score": grade["score"],
        "passed": grade["passed"],
        "feedback": grade["feedback"],
        "next_topic": topics[session.current_topic_index] if not finished else None,
        "next_level": session.current_difficulty if not finished else None,
        "topic_index": session.current_topic_index,
        "total_topics": len(topics),
        "advanced_to_next_topic": advanced_to_next_topic,
        "advanced_level": advanced_level,
        "finished": finished,
    }


@router.post("/complete")
def complete_diagnostic(
    data: CompleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Finalize the session, classify each topic, and optionally rebalance the path."""
    session = _load_session(db, data.session_id, current_user.id)
    topics = _topics_for_session(session)
    raw_results = session.results or {}

    classification: Dict[str, str] = {}
    weak: List[str] = []
    intermediate: List[str] = []
    expert: List[str] = []

    score_map = {"weak": 35.0, "intermediate": 65.0, "expert": 90.0}

    for t in topics:
        entry = raw_results.get(t, {})
        bucket = _classify_topic(entry)
        classification[t] = bucket
        if bucket == "weak":
            weak.append(t)
        elif bucket == "intermediate":
            intermediate.append(t)
        else:
            expert.append(t)
        # Update skill profile
        upsert_score(
            db,
            user_id=current_user.id,
            topic=t,
            score=score_map[bucket],
            job_role=session.job_role,
            source="diagnostic",
        )

    session.status = "completed"
    session.completed_at = datetime.utcnow()

    # Rebalance learning path: weak + intermediate go to green; expert to yellow.
    new_green = weak + intermediate
    new_yellow_additions = expert
    learning_path = (
        db.query(models.LearningPath)
        .filter(models.LearningPath.user_id == current_user.id)
        .first()
    )
    if data.apply_to_path and learning_path:
        existing_yellow = list(learning_path.yellow_topics or [])
        merged_yellow = list(dict.fromkeys(new_yellow_additions + existing_yellow))
        learning_path.green_topics = new_green
        learning_path.yellow_topics = merged_yellow
        learning_path.last_modified = datetime.utcnow()

    db.commit()

    return {
        "session_id": session.id,
        "classification": classification,
        "weak": weak,
        "intermediate": intermediate,
        "expert": expert,
        "applied_to_path": bool(data.apply_to_path and learning_path),
        "green_topics": learning_path.green_topics if learning_path else None,
        "yellow_topics": learning_path.yellow_topics if learning_path else None,
    }


@router.get("/session/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = _load_session(db, session_id, current_user.id)
    return {
        "session_id": s.id,
        "job_role": s.job_role,
        "status": s.status,
        "results": s.results,
        "topics": _topics_for_session(s),
        "current_topic_index": s.current_topic_index,
        "current_difficulty": s.current_difficulty,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
    }
