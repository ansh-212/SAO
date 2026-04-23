"""
InterviewVault — Interview Report Service
Builds the rich post-interview report from a raw transcript and behavioral
proctor stats. Combines deterministic heuristics (filler words, pace) with
Gemini-driven communication / language analysis.
"""
import re
from typing import Any, Dict, List, Optional

from services.ai_service import _generate, _safe_parse_json


FILLER_WORDS = {
    "um",
    "uh",
    "like",
    "you know",
    "kinda",
    "sort of",
    "basically",
    "actually",
    "literally",
    "right",
}


def _candidate_text(transcript: List[Dict[str, str]]) -> str:
    chunks = []
    for msg in transcript or []:
        role = (msg.get("role") or "").lower()
        if role in ("candidate", "user", "student"):
            chunks.append(str(msg.get("content") or ""))
    return "\n".join(chunks)


def _count_fillers(text: str) -> Dict[str, int]:
    lowered = " " + text.lower() + " "
    counts: Dict[str, int] = {}
    for word in FILLER_WORDS:
        token = f" {word} "
        n = lowered.count(token)
        if n:
            counts[word] = n
    return counts


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def _speaking_pace(text: str, behavioral_stats: Dict[str, Any]) -> Optional[float]:
    duration = (behavioral_stats or {}).get("duration_seconds") or (behavioral_stats or {}).get("duration")
    if not duration:
        return None
    try:
        minutes = float(duration) / 60.0
        if minutes <= 0:
            return None
        return round(_word_count(text) / minutes, 1)
    except (TypeError, ValueError):
        return None


def _eye_contact_pct(behavioral_stats: Dict[str, Any]) -> Optional[float]:
    bs = behavioral_stats or {}
    for key in ("eye_contact_pct", "gaze_score", "looking_at_camera_pct"):
        if key in bs and bs[key] is not None:
            try:
                return round(float(bs[key]), 1)
            except (TypeError, ValueError):
                continue
    return None


def _expression_breakdown(behavioral_stats: Dict[str, Any]) -> Dict[str, float]:
    bs = (behavioral_stats or {}).get("expressions") or {}
    if not isinstance(bs, dict):
        return {}
    out: Dict[str, float] = {}
    for k, v in bs.items():
        try:
            out[str(k)] = round(float(v), 2)
        except (TypeError, ValueError):
            continue
    return out


def _language_quality(text: str, topic: str) -> Dict[str, Any]:
    if not text or len(text.strip()) < 80:
        return {
            "vocabulary_richness": 0,
            "grammar_score": 0,
            "coherence_score": 0,
            "best_moment": "",
            "weakest_moment": "",
            "summary": "Insufficient candidate speech to evaluate language quality.",
        }
    prompt = f"""Evaluate the candidate's spoken language quality from this
interview transcript on the topic '{topic}'. Consider only the candidate's
words. Return JSON with integer scores 0-100:
{{
  "vocabulary_richness": 0,
  "grammar_score": 0,
  "coherence_score": 0,
  "best_moment": "Quote a strong sentence (<= 25 words)",
  "weakest_moment": "Quote a weak/unclear sentence (<= 25 words)",
  "summary": "1-2 sentence overall language assessment"
}}

Candidate words:
\"\"\"{text[:5000]}\"\"\""""
    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, dict):
            for k in ("vocabulary_richness", "grammar_score", "coherence_score"):
                try:
                    parsed[k] = max(0, min(100, int(parsed.get(k, 0))))
                except (TypeError, ValueError):
                    parsed[k] = 0
            return {
                "vocabulary_richness": parsed["vocabulary_richness"],
                "grammar_score": parsed["grammar_score"],
                "coherence_score": parsed["coherence_score"],
                "best_moment": str(parsed.get("best_moment", "") or "")[:200],
                "weakest_moment": str(parsed.get("weakest_moment", "") or "")[:200],
                "summary": str(parsed.get("summary", "") or "")[:400],
            }
    return {
        "vocabulary_richness": 60,
        "grammar_score": 60,
        "coherence_score": 60,
        "best_moment": "",
        "weakest_moment": "",
        "summary": "Language analysis not available right now.",
    }


def build_communication_analysis(
    transcript: List[Dict[str, str]],
    behavioral_stats: Dict[str, Any],
    topic: str,
) -> Dict[str, Any]:
    text = _candidate_text(transcript)
    fillers = _count_fillers(text)
    pace = _speaking_pace(text, behavioral_stats or {})
    eye_contact = _eye_contact_pct(behavioral_stats or {})
    expressions = _expression_breakdown(behavioral_stats or {})
    language = _language_quality(text, topic)

    return {
        "filler_word_counts": fillers,
        "filler_word_total": sum(fillers.values()),
        "speaking_pace_wpm": pace,
        "word_count": _word_count(text),
        "eye_contact_pct": eye_contact,
        "expression_breakdown": expressions,
        "language": language,
    }


def build_report(
    *,
    topic: str,
    end_eval: Dict[str, Any],
    transcript: List[Dict[str, str]],
    behavioral_stats: Dict[str, Any],
    topics_covered: List[str],
) -> Dict[str, Any]:
    """Compose the full interview report stored on InterviewSession.report."""
    communication = build_communication_analysis(transcript, behavioral_stats or {}, topic)
    return {
        "overall_score": end_eval.get("overall_score"),
        "verdict": end_eval.get("verdict"),
        "strengths": end_eval.get("strengths") or [],
        "weaknesses": end_eval.get("weaknesses") or [],
        "detailed_feedback": end_eval.get("detailed_feedback") or "",
        "category_scores": end_eval.get("category_scores") or {},
        "recommended_study_topics": end_eval.get("recommended_study_topics") or [],
        "closing_message": end_eval.get("closing_message") or "",
        "visual_capture_results": end_eval.get("visual_capture_results") or {},
        "question_text_by_number": end_eval.get("question_text_by_number") or {},
        "communication": communication,
        "topics_covered": topics_covered,
    }
