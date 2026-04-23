"""
InterviewVault — AI Interview Coach Service
Multi-turn conversational mock interviews powered by Gemini.
"""
import re
from typing import List, Dict, Any, Optional
from services.ai_service import _generate, _safe_parse_json


# ─── Interview Topic Catalog ──────────────────────────────────────────────────
INTERVIEW_TOPICS = [
    {"id": "dsa", "name": "Data Structures & Algorithms", "emoji": "🧠", "category": "Technical"},
    {"id": "sys_design", "name": "System Design", "emoji": "🏗️", "category": "Technical"},
    {"id": "os", "name": "Operating Systems", "emoji": "⚙️", "category": "Technical"},
    {"id": "dbms", "name": "Database Management", "emoji": "🗄️", "category": "Technical"},
    {"id": "cn", "name": "Computer Networks", "emoji": "🌐", "category": "Technical"},
    {"id": "ml", "name": "Machine Learning", "emoji": "🤖", "category": "Technical"},
    {"id": "python", "name": "Python Programming", "emoji": "🐍", "category": "Technical"},
    {"id": "java", "name": "Java Programming", "emoji": "☕", "category": "Technical"},
    {"id": "react", "name": "React & Frontend", "emoji": "⚛️", "category": "Technical"},
    {"id": "behavioral", "name": "Behavioral Questions", "emoji": "🤝", "category": "Soft Skills"},
    {"id": "leadership", "name": "Leadership & Teamwork", "emoji": "👥", "category": "Soft Skills"},
    {"id": "problem_solving", "name": "Problem Solving", "emoji": "💡", "category": "Soft Skills"},
]


WRITTEN_TRIGGER_PATTERN = re.compile(
    r"(draw|diagram|flow\s?chart|figure|sketch|illustrate|white\s?paper|whiteboard|write\s+the\s+steps|write\s+steps|commands?|command\s+sequence|workflow|architecture|block\s+diagram|process\s+flow|formula)",
    re.IGNORECASE,
)


def _topic_label(topic: str) -> str:
    info = next((t for t in INTERVIEW_TOPICS if t["id"] == topic), None)
    return info["name"] if info else topic


def _force_written_prompt(question_text: str, topic_name: str) -> str:
    """Guarantee written prompts only for diagram/formula style questions."""
    text = (question_text or "").strip()
    if WRITTEN_TRIGGER_PATTERN.search(text):
        return text
    return (
        f"On paper, write the key formula/steps for a core {topic_name} problem and draw a simple "
        "diagram or flowchart of your approach. Then explain your reasoning."
    )


def _force_standard_prompt(question_text: str, topic_name: str, question_number: int = 1) -> str:
    """Guarantee the question remains a regular non-capture interview prompt."""
    text = (question_text or "").strip()
    if text and not WRITTEN_TRIGGER_PATTERN.search(text):
        return text
    if question_number <= 1:
        return (
            f"Can you explain the fundamental concepts of {topic_name} and how they apply "
            "in real-world software engineering?"
        )
    return (
        f"Question {question_number}: Building on your previous answer, explain a more advanced "
        f"aspect of {topic_name}, including trade-offs and real-world edge cases."
    )


def _written_question_slots(total_questions: int) -> set:
    """Pick only 1-2 question numbers that require written/diagram responses."""
    total = max(1, int(total_questions or 1))
    if total <= 4:
        slots = {2}
    else:
        slots = {2, min(total - 1, 5)}
    return {n for n in slots if 1 <= n <= total}


def start_interview(topic: str, difficulty: str = "intermediate", num_questions: int = 5) -> Optional[Dict[str, Any]]:
    """Generate an interview plan and opening question."""
    topic_name = _topic_label(topic)
    written_slots = sorted(_written_question_slots(num_questions))

    prompt = f"""You are an expert technical interviewer at a top tech company (Google/Meta level).
You are conducting a {difficulty} difficulty interview on the topic: {topic_name}.

The interview will have {num_questions} questions total. Start with the FIRST question.

INTERVIEWER PERSONA:
- Professional but approachable
- Ask ONE clear question at a time
- Start with a warm greeting and brief context
- Your first question should be {difficulty} difficulty
- The first question must be a normal conceptual question (no draw/write-steps wording).
- Only question numbers in {written_slots} should be written/diagram style prompts.

Respond with JSON:
{{
  "greeting": "A brief, warm greeting introducing yourself and the interview format (2-3 sentences)",
  "first_question": "The first interview question — clear, specific, and {difficulty} difficulty",
  "question_number": 1,
  "total_questions": {num_questions},
  "difficulty": "{difficulty}",
  "topic": "{topic_name}",
  "hints": ["A subtle hint if the candidate gets stuck"]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and result.get("first_question"):
            result.setdefault("greeting", f"Welcome! I'll be your interviewer today. We'll cover {topic_name} with {num_questions} questions.")
            result.setdefault("question_number", 1)
            result.setdefault("total_questions", num_questions)
            result["first_question"] = _force_standard_prompt(result.get("first_question", ""), topic_name, 1)
            return result

    # Fallback
    return {
        "greeting": f"Hi there! Welcome to your {topic_name} interview. I'll ask you {num_questions} questions at {difficulty} difficulty. Take your time and think through each answer. Let's begin!",
        "first_question": _force_standard_prompt("", topic_name, 1),
        "question_number": 1,
        "total_questions": num_questions,
        "difficulty": difficulty,
        "topic": topic_name,
        "hints": ["Think about core principles and practical applications."],
    }


def continue_interview(
    topic: str,
    difficulty: str,
    history: List[Dict[str, str]],
    student_response: str,
    question_number: int,
    total_questions: int,
    behavioral_stats: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Generate the next interview question based on conversation history."""
    topic_name = _topic_label(topic)
    written_slots = sorted(_written_question_slots(total_questions))
    should_be_written = question_number in written_slots

    # Build conversation context
    conv_text = ""
    for msg in history[-8:]:  # Keep last 8 messages for context window
        role = "Interviewer" if msg.get("role") == "interviewer" else "Candidate"
        conv_text += f"\n{role}: {msg['content'][:500]}"

    behavioral_context_prompt = f"AI PROCTOR BEHAVIORAL SNAPSHOT:\n{behavioral_stats}" if behavioral_stats else ""

    prompt = f"""You are an expert interviewer conducting a {difficulty} {topic} interview.
This is question {question_number} of {total_questions}.

CONVERSATION SO FAR:
{conv_text}

CANDIDATE'S LATEST RESPONSE:
{student_response[:800]}

{behavioral_context_prompt}

YOUR TASK:
1. Briefly acknowledge the candidate's answer (1 sentence — what was good or what was missing)
2. If this is NOT the last question, ask the NEXT question that builds on or relates to their response
3. Adapt difficulty: if they struggled, make next question slightly easier; if they aced it, make it harder
4. Keep the conversation natural and flowing
5. Only question numbers in {written_slots} should be written/diagram style prompts.
6. This question number is {question_number}; it should be {"written/diagram" if should_be_written else "normal conceptual"}.
7. The question MUST be clearly relevant to {topic_name}.

{"This is the LAST question. Make it a challenging wrap-up question." if question_number >= total_questions else ""}

Respond with JSON:
{{
  "acknowledgment": "Brief feedback on their answer (1-2 sentences)",
  "next_question": "The next interview question (clear and specific)",
  "question_number": {question_number},
  "performance_signal": "strong" or "moderate" or "weak",
  "hints": ["A subtle hint if needed"]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and result.get("next_question"):
            result.setdefault("question_number", question_number)
            result.setdefault("performance_signal", "moderate")
            if should_be_written:
                result["next_question"] = _force_written_prompt(result.get("next_question", ""), topic_name)
            else:
                result["next_question"] = _force_standard_prompt(result.get("next_question", ""), topic_name, question_number)
            return result

    fallback_next_question = (
        _force_written_prompt("", topic_name)
        if should_be_written
        else _force_standard_prompt("", topic_name, question_number)
    )

    return {
        "acknowledgment": "Thank you for that response. Let's move on.",
        "next_question": fallback_next_question,
        "question_number": question_number,
        "performance_signal": "moderate",
        "hints": ["Think about edge cases and real-world scenarios."],
    }


def end_interview(
    topic: str,
    difficulty: str,
    history: List[Dict[str, str]],
    total_questions: int,
    behavioral_stats: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Generate final interview evaluation with detailed scores and feedback."""

    conv_text = ""
    for msg in history:
        role = "Interviewer" if msg.get("role") == "interviewer" else "Candidate"
        conv_text += f"\n{role}: {msg['content'][:400]}"

    behavioral_context_prompt = (
        f"AI PROCTOR OVERALL BEHAVIORAL ANALYTICS (Posture, Gaze, Emotion):\n{behavioral_stats}\n"
        "Take their physical posture, dominant emotion, eye contact (gaze), and confidence from video feed into consideration for their communication score and overall feedback."
    ) if behavioral_stats else ""

    prompt = f"""You just finished conducting a {difficulty} {topic} interview with {total_questions} questions.

FULL INTERVIEW TRANSCRIPT:
{conv_text[:6000]}

{behavioral_context_prompt}

Generate a comprehensive interview evaluation. Be honest but constructive.

Respond with JSON:
{{
  "overall_score": 78,
  "verdict": "Strong Hire" or "Hire" or "Lean Hire" or "Lean No Hire" or "No Hire",
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "weaknesses": ["Specific area to improve 1", "Specific area to improve 2"],
  "detailed_feedback": "3-4 sentences of specific, actionable feedback referencing actual answers from the interview",
  "category_scores": {{
    "technical_depth": 7,
    "communication": 8,
    "problem_solving": 6,
    "clarity": 7,
    "confidence": 8
  }},
  "recommended_study_topics": ["Topic 1 to study", "Topic 2 to study"],
  "closing_message": "A brief, encouraging closing message from the interviewer"
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and result.get("overall_score") is not None:
            # Validate scores
            try:
                result["overall_score"] = max(0, min(100, int(result["overall_score"])))
            except (ValueError, TypeError):
                result["overall_score"] = 65
            cats = result.get("category_scores", {})
            for k in ["technical_depth", "communication", "problem_solving", "clarity", "confidence"]:
                try:
                    cats[k] = max(0, min(10, int(cats.get(k, 5))))
                except (ValueError, TypeError):
                    cats[k] = 5
            result["category_scores"] = cats
            return result

    return {
        "overall_score": 65,
        "verdict": "Lean Hire",
        "strengths": ["Showed understanding of core concepts", "Good communication"],
        "weaknesses": ["Could go deeper on advanced topics", "Need more specific examples"],
        "detailed_feedback": "Thank you for completing this interview. You demonstrated solid foundational knowledge. Focus on strengthening your understanding of advanced concepts and practice articulating your thought process more clearly.",
        "category_scores": {"technical_depth": 6, "communication": 7, "problem_solving": 6, "clarity": 7, "confidence": 6},
        "recommended_study_topics": [f"Advanced {topic}", "System design patterns"],
        "closing_message": "Great effort! Keep practicing and you'll do even better next time. 🚀",
    }


def generate_capture_counter_question(
    topic: str,
    difficulty: str,
    question_text: str,
    interpreted_content: str = "",
    summary: str = "",
    mode: str = "auxiliary",
) -> Dict[str, str]:
    """Generate a dynamic follow-up/counter question for capture flow without exposing correctness."""
    topic_name = _topic_label(topic)
    safe_mode = (mode or "auxiliary").strip().lower()
    mode_label = "during_pending_analysis" if safe_mode == "auxiliary" else "post_analysis"

    prompt = f"""You are an expert interviewer running a {difficulty} {topic_name} interview.

CURRENT WRITTEN PROMPT:
{question_text}

IMAGE INTERPRETATION SNAPSHOT (may be partial):
Interpreted content: {interpreted_content or 'N/A'}
Summary: {summary or 'N/A'}

MODE: {mode_label}

TASK:
Generate exactly ONE specific, interview-quality counter question related to the same concept/problem.

STRICT RULES:
1. Do NOT reveal whether the candidate is right or wrong.
2. Do NOT mention analysis delay, processing state, or system behavior.
3. Keep the question directly relevant to the original prompt and technically specific.
4. Avoid generic prompts like "any edge case?" unless tied to context.
5. Keep it concise (1-2 sentences max).

Respond only in JSON:
{{
  "question": "single counter question"
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, dict) and str(parsed.get("question") or "").strip():
            return {"question": str(parsed["question"]).strip()}

    if safe_mode == "auxiliary":
        fallback = "Can you walk me through one critical edge case for this approach and how your solution handles it?"
    else:
        fallback = "Can you explain one key assumption in your written approach and how you would validate it in practice?"
    return {"question": fallback}
