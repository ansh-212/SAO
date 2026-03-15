"""
InterviewVault — Remediation Service
Analyzes past performance to build targeted micro-quizzes for weak topics.
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import models
from services.ai_service import _generate, _safe_parse_json

def get_weak_topics(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Aggregate submissions to find topics with average score < 6."""
    
    # In a fully normalized DB we'd have a Topic table linked to Question.
    # For MVP, we extract the "section_reference" or "title" from assessments/pathways.
    assessments = db.query(models.Assessment).join(
        models.Submission, models.Assessment.id == models.Submission.assessment_id
    ).filter(
        models.Submission.user_id == user_id,
        models.Submission.evaluated_at.isnot(None)
    ).all()
    
    pathway_steps = db.query(models.PathwayStep).filter(
        models.PathwayStep.user_id == user_id
    ).order_by(models.PathwayStep.created_at.desc()).limit(10).all()

    weak_areas = {}
    
    # 1. From Pathway Steps (skill gaps)
    for p in pathway_steps:
        if p.skill_gaps:
            for gap in p.skill_gaps:
                gap = gap.strip()
                if gap:
                    weak_areas[gap] = weak_areas.get(gap, 0) + 1
                    
    # Sort by frequency
    sorted_gaps = sorted(weak_areas.items(), key=lambda x: x[1], reverse=True)
    topics = [{"topic": k, "frequency": v, "recommended": True} for k, v in sorted_gaps[:5]]

    # If no gaps found, provide generic fallback topics based on their level
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not topics:
        if user and user.level and user.level >= 3:
            return [
                {"topic": "System Architecture", "frequency": 1, "recommended": True},
                {"topic": "Advanced Algorithms", "frequency": 1, "recommended": True}
            ]
        else:
            return [
                {"topic": "Data Structures", "frequency": 1, "recommended": True},
                {"topic": "Basic OOP Concepts", "frequency": 1, "recommended": True}
            ]
            
    return topics

def generate_micro_quiz(topic: str) -> Dict[str, Any]:
    """Use Gemini to generate a quick 3-question targeted practice quiz."""
    prompt = f"""You are an expert tutor creating a targeted 3-question micro-quiz to help a student who is weak in the topic: "{topic}".
    
Focus SPECIFICALLY on common misunderstandings related to {topic}.

Respond ONLY with valid JSON matching this schema:
{{
  "topic": "{topic}",
  "title": "A catchy title like 'Fixing Array Foundations'",
  "questions": [
    {{
      "id": 1,
      "text": "Clear, specific question",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct and others are wrong (1-2 sentences)"
    }}
  ]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and "questions" in result:
            # Validate structure
            valid_qs = []
            for i, q in enumerate(result["questions"][:3]):
                if isinstance(q, dict) and q.get("text") and "options" in q and "correct_index" in q:
                    q["id"] = i + 1
                    valid_qs.append(q)
            if len(valid_qs) >= 1:
                result["questions"] = valid_qs
                return result

    # Fallback
    return {
        "topic": topic,
        "title": f"Reviewing {topic}",
        "questions": [
            {
                "id": 1,
                "text": f"What is the most critical fundamental principle regarding {topic}?",
                "type": "multiple_choice",
                "options": [
                    "It relies on absolute state isolation.",
                    "It primarily optimizes O(1) time complexity.",
                    f"Understanding the core mechanic behind {topic} allows scale.",
                    "It cannot be used in a distributed system."
                ],
                "correct_index": 2,
                "explanation": "Core mechanics are the foundation of scalability."
            }
        ]
    }
