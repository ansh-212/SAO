"""
InterviewVault — Skill Profile Service
DRY upsert helper for UserSkillProfile so quiz/diagnostic/interview routes
don't duplicate weighted-average + history bookkeeping.
"""
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

import models


def upsert_score(
    db: Session,
    user_id: int,
    topic: str,
    score: float,
    job_role: str = "",
    confidence: Optional[float] = None,
    source: str = "quiz",
    flush: bool = True,
) -> models.UserSkillProfile:
    """Insert or update a UserSkillProfile row, appending to history and
    recomputing skill_score as a recency-weighted mean of the last 5 entries.
    Caller is responsible for committing the session."""
    row = (
        db.query(models.UserSkillProfile)
        .filter(
            models.UserSkillProfile.user_id == user_id,
            models.UserSkillProfile.topic == topic,
        )
        .first()
    )
    if row is None:
        row = models.UserSkillProfile(
            user_id=user_id,
            topic=topic,
            job_role=job_role,
            history=[],
        )
        db.add(row)
        if flush:
            db.flush()

    history = list(row.history or [])
    history.append(
        {
            "score": float(score),
            "date": datetime.utcnow().isoformat(),
            "source": source,
        }
    )
    row.history = history
    recent = history[-5:]
    row.skill_score = round(sum(h["score"] for h in recent) / len(recent), 1)
    if confidence is not None:
        row.confidence_score = float(confidence)
    if job_role:
        row.job_role = job_role
    row.last_updated = datetime.utcnow()
    return row


def get_user_profile(db: Session, user_id: int) -> List[Dict]:
    rows = (
        db.query(models.UserSkillProfile)
        .filter(models.UserSkillProfile.user_id == user_id)
        .all()
    )
    return [
        {
            "id": r.id,
            "topic": r.topic,
            "job_role": r.job_role,
            "skill_score": r.skill_score,
            "confidence_score": r.confidence_score,
            "last_updated": r.last_updated.isoformat() if r.last_updated else None,
            "history": r.history or [],
        }
        for r in rows
    ]


def classify(skill_score: float) -> str:
    """Bucket a 0-100 skill score into Weak / Intermediate / Expert."""
    if skill_score < 50:
        return "weak"
    if skill_score < 80:
        return "intermediate"
    return "expert"
