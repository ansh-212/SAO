"""
InterviewVault — AI Interview Coach Routes
Mock interview sessions with multi-turn AI conversations.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import models
from auth import get_current_user
from database import get_db
from services.interview_service import (
    start_interview, continue_interview, end_interview, INTERVIEW_TOPICS
)

router = APIRouter(prefix="/api/interview", tags=["Interview Coach"])


class InterviewStartRequest(BaseModel):
    topic: str = "dsa"
    difficulty: str = "intermediate"
    num_questions: int = 5


class InterviewRespondRequest(BaseModel):
    topic: str
    difficulty: str
    history: List[Dict[str, str]]  # [{role: "interviewer"|"candidate", content: "..."}]
    student_response: str
    question_number: int
    total_questions: int
    behavioral_stats: Optional[Dict[str, Any]] = None


class InterviewEndRequest(BaseModel):
    topic: str
    difficulty: str
    history: List[Dict[str, str]]
    total_questions: int
    behavioral_stats: Optional[Dict[str, Any]] = None


@router.get("/topics")
def get_topics(current_user: models.User = Depends(get_current_user)):
    """Get available interview topics."""
    return INTERVIEW_TOPICS


@router.post("/start")
def start_session(
    data: InterviewStartRequest,
    current_user: models.User = Depends(get_current_user)
):
    """Start a new mock interview session."""
    result = start_interview(
        topic=data.topic,
        difficulty=data.difficulty,
        num_questions=max(3, min(10, data.num_questions))
    )
    if result:
        return {"status": "started", **result}
    return {"status": "error", "message": "Failed to start interview"}


@router.post("/respond")
def respond_to_question(
    data: InterviewRespondRequest,
    current_user: models.User = Depends(get_current_user)
):
    """Send student response and get next question."""
    result = continue_interview(
        topic=data.topic,
        difficulty=data.difficulty,
        history=data.history,
        student_response=data.student_response,
        question_number=data.question_number,
        total_questions=data.total_questions,
        behavioral_stats=data.behavioral_stats
    )
    if result:
        return {"status": "continued", **result}
    return {"status": "error", "message": "Failed to generate follow-up"}


@router.post("/end")
def end_session(
    data: InterviewEndRequest,
    current_user: models.User = Depends(get_current_user)
):
    """End the interview and get evaluation."""
    result = end_interview(
        topic=data.topic,
        difficulty=data.difficulty,
        history=data.history,
        total_questions=data.total_questions,
        behavioral_stats=data.behavioral_stats
    )
    return {"status": "completed", **result}
