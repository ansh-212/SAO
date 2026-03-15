"""
InterviewVault — Remediation Routes
API endpoints for identifying weak areas and generating practice quizzes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from auth import get_current_user
from database import get_db
from services.remediation_service import get_weak_topics, generate_micro_quiz

router = APIRouter(prefix="/api/remediation", tags=["Remediation Hub"])

class MicroQuizRequest(BaseModel):
    topic: str

@router.get("/weak-areas")
def list_weak_areas(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get the user's historically weak topics that need review."""
    return get_weak_topics(current_user.id, db)

@router.post("/micro-quiz")
def create_micro_quiz(data: MicroQuizRequest, current_user: models.User = Depends(get_current_user)):
    """Generate a targeted practice quiz for a specific weak area."""
    return generate_micro_quiz(data.topic)
