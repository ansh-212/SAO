"""
InterviewVault — Topic Learning Routes
Article generation (cached), quiz, notes, and progress tracking.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

import models
from auth import get_current_user
from database import get_db
from services.ai_service import _generate, _safe_parse_json
from services.gamification_service import award_xp
from services.skill_profile_service import upsert_score

router = APIRouter(prefix="/api/topics", tags=["Topic Learning"])


class NotesRequest(BaseModel):
    notes: str


class QuizSubmitRequest(BaseModel):
    topic: str
    job_role: str
    answers: dict              # {question_index: answer_text}
    questions: list            # full question list sent from frontend
    is_completion_attempt: bool = False  # true → set test_pending on fail


class StatusUpdateRequest(BaseModel):
    status: str   # not_started | in_progress | test_pending | completed


class ChatMessage(BaseModel):
    role: str       # 'user' or 'assistant'
    content: str


class PracticeQuestionsRequest(BaseModel):
    job_role: str = ""
    chat_messages: List[ChatMessage] = []  # last N turns for context
    num_questions: int = 5


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    job_role: str = ""


def _get_or_create_progress(db: Session, user_id: int, topic: str, job_role: str) -> models.UserTopicProgress:
    record = db.query(models.UserTopicProgress).filter(
        models.UserTopicProgress.user_id == user_id,
        models.UserTopicProgress.topic == topic,
        models.UserTopicProgress.job_role == job_role,
    ).first()
    if not record:
        record = models.UserTopicProgress(
            user_id=user_id, topic=topic, job_role=job_role
        )
        db.add(record)
        db.flush()
    return record


@router.get("/{topic}/article")
def get_topic_article(
    topic: str,
    job_role: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return a Gemini-generated article for the topic. Cached in DB after first generation."""
    progress = _get_or_create_progress(db, current_user.id, topic, job_role)

    # Return cached article if exists
    if progress.article_content:
        progress.article_read = True
        if progress.status == "not_started":
            progress.status = "in_progress"
        db.commit()
        return {"topic": topic, "content": progress.article_content, "cached": True}

    # Generate with Gemini
    role_context = f" for a {job_role.replace('_', ' ').title()} role" if job_role else ""
    prompt = f"""You are an expert technical educator writing a clean, easy-to-read interview prep article.

Topic: {topic}{role_context}

Write the article as well-spaced markdown that reads like a great blog post,
NOT a dense reference sheet. Follow this structure literally:

# {topic}

> One-line "why this matters" hook (italicised tagline).

## Overview
2-3 short paragraphs (3-4 sentences each) explaining the core concept in plain
language. Use **bold** sparingly for the most important terms. Avoid bullet
lists here — use real paragraphs.

## Key concepts
A markdown table comparing the most important sub-concepts. Use this exact shape:

| Concept | What it is | When to use |
|---|---|---|
| ... | ... | ... |

(4-7 rows. Keep cells short — single phrase, not full sentences.)

## How it works
A short paragraph followed by ONE ASCII/Unicode diagram inside a fenced
```text``` code block. Examples:
- Box-and-arrow flowcharts
- Tree / graph structures
- Sequence of states
- Memory layout

Pick whichever shape best fits the topic. Keep the diagram under 14 lines
and label every node/arrow clearly.

## Common interview questions
A numbered list of 5-7 questions typically asked, each with a one-line
follow-up clue in italics. Format:

1. **Question?**
   *Hint: what to focus on in your answer.*

## Real-world applications
2-3 short bullet points, each starting with a **bold product/system name**
followed by one sentence on how it uses this concept.

## Quick recap
A 5-bullet cheat-sheet of must-remember points. Each bullet is a single
declarative sentence ending with a period.

## Further study
2-3 inline-link suggestions (use real, well-known resource names — no fake URLs).

WRITING RULES (critical — clean formatting > content density):
- Use ONLY ONE H1 (`#`) at the very top.
- Always leave a blank line before and after every heading, table, and code block.
- Paragraphs must be separated by a blank line.
- Never wrap text awkwardly mid-line. Keep each paragraph as one continuous block.
- Code/identifier names go in `backticks`.
- Length: 700-1100 words total. Prioritise clarity over completeness.
- Tone: warm, direct, never academic. Imagine explaining to a smart junior
  who has 30 minutes to prep."""

    raw = _generate(prompt)
    if not raw:
        raise HTTPException(status_code=503, detail="Article generation failed. Please try again.")

    # Cache it
    progress.article_content = raw
    progress.article_read = True
    if progress.status == "not_started":
        progress.status = "in_progress"
    db.commit()

    return {"topic": topic, "content": raw, "cached": False}


@router.api_route("/{topic}/quiz", methods=["GET", "POST"])
def get_topic_quiz(
    topic: str,
    job_role: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a 5-question quiz for the topic. Mix of MCQ and short answer."""
    role_context = f" for a {job_role.replace('_', ' ').title()} role" if job_role else ""

    prompt = f"""Generate a 5-question quiz on: {topic}{role_context}

Mix of question types: 3 multiple choice (MCQ) + 2 short answer.
Focus on interview-relevant knowledge, not academic trivia.

Return JSON array:
[
  {{
    "id": 1,
    "type": "mcq",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 2,
    "correct_answer": "Option C",
    "explanation": "Why this is correct and why others are wrong..."
  }},
  {{
    "id": 4,
    "type": "short_answer",
    "question": "Explain question here...",
    "model_answer": "The ideal answer covers X, Y, Z...",
    "key_points": ["Key point 1", "Key point 2", "Key point 3"],
    "explanation": "What makes a good answer..."
  }}
]"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, list) and len(parsed) >= 3:
            return {"topic": topic, "questions": parsed}

    raise HTTPException(status_code=503, detail="Quiz generation failed. Please try again.")


@router.post("/{topic}/quiz/submit")
def submit_topic_quiz(
    topic: str,
    data: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Evaluate quiz answers, provide feedback, auto-generate follow-up for wrong answers, update skill score."""
    questions = data.questions
    answers = data.answers

    results = []
    correct_count = 0
    total = len(questions)

    for i, q in enumerate(questions):
        user_ans = answers.get(str(i), "")
        is_correct = False
        feedback = ""

        if q.get("type") == "mcq":
            correct_idx = q.get("correct_index", -1)
            try:
                user_idx = int(user_ans)
                is_correct = user_idx == correct_idx
            except (ValueError, TypeError):
                is_correct = False
            feedback = q.get("explanation", "")

        elif q.get("type") == "short_answer":
            # Use Gemini to evaluate short answer
            eval_prompt = f"""Evaluate this answer for the interview topic: {topic}

Question: {q.get('question', '')}
Model answer reference: {q.get('model_answer', '')}
Key points to cover: {q.get('key_points', [])}

Student's answer: "{user_ans}"

Score: is this answer acceptable? (did it cover at least 2 key points?)
Return JSON: {{"is_correct": true/false, "score": 0-10, "feedback": "specific feedback on what was right/wrong"}}"""

            raw = _generate(eval_prompt, json_mode=True)
            if raw:
                ev = _safe_parse_json(raw)
                if isinstance(ev, dict):
                    is_correct = ev.get("is_correct", False)
                    feedback = ev.get("feedback", q.get("explanation", ""))
                else:
                    feedback = q.get("explanation", "")
            else:
                feedback = q.get("explanation", "Review the model answer above.")

        if is_correct:
            correct_count += 1

        # Generate follow-up for wrong answers (auto, not opt-in, for quiz context)
        followup_q = None
        if not is_correct and user_ans.strip():
            fu_prompt = f"""The student got this question wrong in a quiz on {topic}.
Question: {q.get('question', '')}
Their answer: "{user_ans[:300]}"
Correct answer/explanation: {feedback}

Generate ONE helpful follow-up question to deepen their understanding of where they went wrong.
Return JSON: {{"follow_up": "The follow-up question text?"}}"""
            fu_raw = _generate(fu_prompt, json_mode=True)
            if fu_raw:
                fu = _safe_parse_json(fu_raw)
                if isinstance(fu, dict) and fu.get("follow_up"):
                    followup_q = fu["follow_up"]

        results.append({
            "question_index": i,
            "is_correct": is_correct,
            "feedback": feedback,
            "correct_answer": q.get("correct_answer") or q.get("model_answer", ""),
            "follow_up": followup_q,
        })

    score_pct = round(correct_count / total * 100) if total > 0 else 0

    # ─── Update DB progress ───────────────────────────────────────────────────
    progress = _get_or_create_progress(db, current_user.id, data.topic, data.job_role)
    history = list(progress.quiz_scores or [])
    history.append({"score": score_pct, "date": datetime.utcnow().isoformat(), "correct": correct_count, "total": total})
    progress.quiz_scores = history

    if score_pct >= 70:
        progress.status = "completed"
        progress.completed_at = datetime.utcnow()
    elif data.is_completion_attempt:
        # User tried to mark topic as complete but didn't pass — flag as pending.
        progress.status = "test_pending"
    elif progress.status in ("not_started",):
        progress.status = "in_progress"

    upsert_score(
        db,
        user_id=current_user.id,
        topic=data.topic,
        score=score_pct,
        job_role=data.job_role,
        source="topic_quiz",
    )

    # Award XP
    xp = max(5, correct_count * 10)
    award_xp(db, current_user, xp, f"topic_quiz:{data.topic}")

    db.commit()

    return {
        "score": score_pct,
        "correct": correct_count,
        "total": total,
        "results": results,
        "topic_completed": progress.status == "completed",
        "xp_gained": xp,
        "message": "🎉 Topic mastered!" if score_pct >= 70 else "Keep practicing — review the explanations above.",
    }


@router.put("/{topic}/notes")
def save_notes(
    topic: str,
    data: NotesRequest,
    job_role: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save user's notes for a topic."""
    progress = _get_or_create_progress(db, current_user.id, topic, job_role)
    progress.notes = data.notes
    db.commit()
    return {"success": True, "message": "Notes saved."}


@router.put("/{topic}/status")
def update_topic_status(
    topic: str,
    data: StatusUpdateRequest,
    job_role: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Directly set a topic's status (e.g. mark as test_pending when user skips)."""
    valid = {"not_started", "in_progress", "test_pending", "completed"}
    if data.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")
    progress = _get_or_create_progress(db, current_user.id, topic, job_role)
    progress.status = data.status
    if data.status == "completed" and not progress.completed_at:
        progress.completed_at = datetime.utcnow()
    db.commit()
    return {"success": True, "status": data.status}


@router.post("/{topic}/practice-questions")
def get_practice_questions(
    topic: str,
    data: PracticeQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate context-aware practice questions from the article + chat session.

    Unlike the standard quiz (which is generic), these questions are grounded
    in the specific content the student read AND the tangents they explored
    in the chat — so they target exactly what was discussed.
    """
    progress = db.query(models.UserTopicProgress).filter(
        models.UserTopicProgress.user_id == current_user.id,
        models.UserTopicProgress.topic == topic,
        models.UserTopicProgress.job_role == data.job_role,
    ).first()
    article_excerpt = (progress.article_content or "")[:4000] if progress else ""

    role_context = (
        f" The student is preparing for a {data.job_role.replace('_', ' ').title()} role."
        if data.job_role else ""
    )

    chat_context = ""
    if data.chat_messages:
        recent = data.chat_messages[-8:]
        chat_context = "\n".join(
            f"{m.role.capitalize()}: {m.content[:400]}" for m in recent
        )

    prompt = f"""You are creating a focused practice quiz for a student who just studied a topic.
Generate exactly {data.num_questions} questions.{role_context}

Topic: {topic}

Article the student read (use as the primary knowledge source):
{article_excerpt or "(no article cached — use general knowledge)"}

{"Chat conversation during study (the student asked these; weight questions toward these areas):" if chat_context else ""}
{chat_context}

Mix at least 2 MCQ and at least 1 short-answer. Make the questions:
- Grounded in the specific sub-topics above (not vague generic questions)
- At interview difficulty — not trivia, not textbook recitation
- For short-answer, test the student on things they specifically asked about in the chat

Return a JSON array in EXACTLY this shape:
[
  {{
    "id": 1,
    "type": "mcq",
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_index": 2,
    "correct_answer": "C",
    "explanation": "..."
  }},
  {{
    "id": 4,
    "type": "short_answer",
    "question": "...",
    "model_answer": "...",
    "key_points": ["point 1", "point 2"],
    "explanation": "..."
  }}
]"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, list) and len(parsed) >= 2:
            return {"topic": topic, "questions": parsed, "context_aware": True}

    raise HTTPException(status_code=503, detail="Practice question generation failed. Please try again.")


@router.post("/{topic}/chat")
def chat_about_topic(
    topic: str,
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Conversational follow-up about a topic.

    The frontend opens this when the learner asks "what about X?" right next
    to their notes. We feed Gemini the cached article (if any) as grounding
    plus the last few turns so answers stay focused on the current topic.
    """
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Pull the cached article for grounding (best-effort).
    progress = db.query(models.UserTopicProgress).filter(
        models.UserTopicProgress.user_id == current_user.id,
        models.UserTopicProgress.topic == topic,
        models.UserTopicProgress.job_role == data.job_role,
    ).first()
    article_excerpt = (progress.article_content or "")[:3000] if progress else ""

    role_context = (
        f" The learner is preparing for a {data.job_role.replace('_', ' ').title()} role."
        if data.job_role else ""
    )

    history_block = ""
    if data.history:
        # Keep the prompt bounded — last 6 turns is plenty for context.
        recent = data.history[-6:]
        history_block = "\n".join(
            f"{m.role.capitalize()}: {m.content[:600]}" for m in recent
        )

    prompt = f"""You are a focused, friendly interview-prep tutor helping a student
master one topic at a time.

Topic: {topic}{role_context}

Reference article (use this to stay grounded; don't quote it verbatim):
{article_excerpt or '(no cached article — answer from general expertise)'}

Conversation so far:
{history_block or '(this is the first message)'}

Student just asked: "{data.message.strip()}"

Reply rules:
- Stay strictly on this topic. If the student drifts, gently redirect.
- Use clean markdown: short paragraphs, occasional bullet lists, fenced code
  blocks for code/diagrams. Tables only when comparing 3+ things.
- Lead with the direct answer in 1-2 sentences, then expand with details and a
  concrete example.
- End with one short follow-up question that nudges deeper understanding.
- Length: 120-300 words unless the student explicitly asks for more.
- Never apologise, never say "as an AI". Just answer."""

    raw = _generate(prompt)
    if not raw:
        raise HTTPException(status_code=503, detail="Chat reply failed. Try again.")
    return {"reply": raw.strip()}


@router.get("/{topic}/notes")
def get_notes(
    topic: str,
    job_role: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get user's saved notes for a topic."""
    progress = _get_or_create_progress(db, current_user.id, topic, job_role)
    db.commit()
    return {"topic": topic, "notes": progress.notes or ""}
