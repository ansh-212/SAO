"""
InterviewVault — Daily Prep Planner Service
Generates personalized daily study plans based on performance data.
"""
from typing import Dict, Any, Optional
from services.ai_service import _generate, _safe_parse_json


def generate_daily_plan(
    xp_points: int = 0,
    streak_days: int = 0,
    average_score: float = 0,
    total_submissions: int = 0,
    skill_gaps: list = None,
    recent_topics: list = None
) -> Dict[str, Any]:
    """Generate a personalized daily study plan."""

    gaps_text = ", ".join(skill_gaps[:5]) if skill_gaps else "general review"
    recent_text = ", ".join(recent_topics[:5]) if recent_topics else "various topics"

    prompt = f"""You are a smart study planner for an interview prep platform.

STUDENT PROFILE:
- XP: {xp_points} | Streak: {streak_days} days | Avg Score: {average_score}%
- Total assessments completed: {total_submissions}
- Skill gaps: {gaps_text}
- Recent topics studied: {recent_text}

Generate a concise daily study plan with 3-5 actionable tasks.
Each task should be specific and achievable in 15-30 minutes.

{"This student is new — focus on basics and building confidence." if total_submissions < 3 else ""}
{"Great streak! Include a challenge task to keep momentum." if streak_days >= 5 else ""}
{"Score is below 60% — focus on fundamentals and practice." if average_score < 60 and total_submissions > 0 else ""}

Respond with JSON:
{{
  "greeting": "A brief motivational message (1 sentence)",
  "tasks": [
    {{
      "title": "Short task title",
      "description": "1-2 sentence description",
      "type": "review" or "practice" or "challenge" or "mock_interview",
      "duration_min": 20,
      "emoji": "📖"
    }}
  ],
  "estimated_total_min": 60,
  "focus_area": "The main area to focus on today",
  "tip": "A specific study tip for today"
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and result.get("tasks"):
            # Validate tasks
            valid_tasks = []
            for t in result["tasks"][:5]:
                if isinstance(t, dict) and t.get("title"):
                    t.setdefault("description", "")
                    t.setdefault("type", "practice")
                    t.setdefault("duration_min", 20)
                    t.setdefault("emoji", "📝")
                    valid_tasks.append(t)
            if valid_tasks:
                result["tasks"] = valid_tasks
                result.setdefault("greeting", "Ready to level up today? Let's go! 🚀")
                result.setdefault("estimated_total_min", sum(t.get("duration_min", 20) for t in valid_tasks))
                result.setdefault("focus_area", gaps_text)
                result.setdefault("tip", "Break your study into 25-minute focused sessions with 5-minute breaks.")
                return result

    # Fallback plan
    return {
        "greeting": "Let's make today count! 💪",
        "tasks": [
            {"title": "Quick Review", "description": "Review your weakest topic from recent assessments.", "type": "review", "duration_min": 15, "emoji": "📖"},
            {"title": "Practice Problems", "description": "Solve 3 practice problems on your weakest area.", "type": "practice", "duration_min": 25, "emoji": "✏️"},
            {"title": "Mock Interview", "description": "Do a quick 5-question mock interview to build confidence.", "type": "mock_interview", "duration_min": 20, "emoji": "🎙️"},
        ],
        "estimated_total_min": 60,
        "focus_area": gaps_text,
        "tip": "Consistency beats intensity. Even 30 minutes a day compounds over time.",
    }
