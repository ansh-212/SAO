from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from services.skill_profile_service import (
    get_user_profile,
    upsert_score,
    classify,
)

router = APIRouter(prefix="/api/users", tags=["Users"])


class SkillUpdateRequest(BaseModel):
    topic: str
    score: float
    job_role: Optional[str] = ""
    confidence: Optional[float] = None
    source: Optional[str] = "manual"


@router.get("/me", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=schemas.UserResponse)
def update_profile(
    data: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if data.name is not None:
        current_user.name = data.name
    if data.college is not None:
        current_user.college = data.college
    if data.phone is not None:
        current_user.phone = data.phone
    if data.bio is not None:
        current_user.bio = data.bio
    if data.preferred_language is not None:
        current_user.preferred_language = data.preferred_language

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/skill-profile")
def get_skill_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all UserSkillProfile rows for the current user, with bucket
    classifications and a readiness summary. Powers the dashboard skill rings."""
    rows = get_user_profile(db, current_user.id)
    for r in rows:
        r["bucket"] = classify(r.get("skill_score", 0) or 0)

    avg = round(sum(r.get("skill_score", 0) or 0 for r in rows) / len(rows), 1) if rows else 0.0
    by_bucket = {
        "weak": [r["topic"] for r in rows if r["bucket"] == "weak"],
        "intermediate": [r["topic"] for r in rows if r["bucket"] == "intermediate"],
        "expert": [r["topic"] for r in rows if r["bucket"] == "expert"],
    }
    return {
        "items": rows,
        "summary": {
            "average_score": avg,
            "topics_assessed": len(rows),
            "by_bucket": by_bucket,
            "readiness": classify(avg),
        },
    }


@router.put("/skill-profile/update")
def update_skill_profile(
    data: SkillUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manually upsert a topic score (used by background processes / debug).
    Most flows should update via the activity routes instead."""
    if not data.topic:
        raise HTTPException(status_code=400, detail="topic is required.")
    row = upsert_score(
        db,
        user_id=current_user.id,
        topic=data.topic,
        score=data.score,
        job_role=data.job_role or current_user.target_role or "",
        confidence=data.confidence,
        source=data.source or "manual",
    )
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "topic": row.topic,
        "skill_score": row.skill_score,
        "confidence_score": row.confidence_score,
        "bucket": classify(row.skill_score or 0),
    }
