"""
InterviewVault — AI Interview Coach Routes
Mock interview sessions with multi-turn AI conversations.
"""
import os
import uuid
from fastapi import APIRouter, Depends
from fastapi import File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import models
from auth import get_current_user
from database import get_db
from config import settings
from services.interview_service import (
    start_interview, continue_interview, end_interview, INTERVIEW_TOPICS
)
from services.visual_capture_service import evaluate_interview_capture

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


@router.post("/capture/evaluate")
async def evaluate_written_response(
    question_text: str = Form(...),
    typed_context: str = Form(""),
    language: str = Form("en"),
    response_file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    content = await response_file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file")

    capture_dir = os.path.join(settings.UPLOAD_DIR, "whiteboard_captures")
    os.makedirs(capture_dir, exist_ok=True)
    ext = os.path.splitext(response_file.filename or "capture.jpg")[1] or ".jpg"
    filename = f"interview_capture_{current_user.id}_{uuid.uuid4().hex}{ext}"
    image_path = os.path.join(capture_dir, filename)

    with open(image_path, "wb") as saved:
        saved.write(content)

    result = evaluate_interview_capture(
        question_text=question_text,
        image_path=image_path,
        language=language,
        typed_context=typed_context,
    )

    return {
        "status": "ok",
        "summary": result.get("summary", ""),
        "feedback": result.get("feedback", ""),
        "scores": result.get("scores", {}),
        "overall_score": result.get("overall_score", 0),
        "extracted_text": result.get("transcribed_text", ""),
        "evaluator_used": result.get("evaluator_used", "fallback"),
    }
