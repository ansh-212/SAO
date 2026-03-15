"""
InterviewVault — Role-Based Tracks Routes
API endpoints for accessing and joining learning tracks.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
from auth import get_current_user
from database import get_db
from services.track_service import get_all_tracks, get_track_by_id, calculate_track_progress

router = APIRouter(prefix="/api/tracks", tags=["Learning Tracks"])

@router.get("/")
def list_tracks(current_user: models.User = Depends(get_current_user)):
    """Get all available role-based tracks."""
    return get_all_tracks()

@router.get("/{track_id}/progress")
def get_track_progress(track_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get the current user's progress on a specific track."""
    track = get_track_by_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    # In a real system, we'd query models.CompletedTopic or similar.
    # For now, we'll extract topics from their PathwaySteps or Assessments.
    assessments = db.query(models.Assessment).join(
        models.Submission, models.Assessment.id == models.Submission.assessment_id
    ).filter(
        models.Submission.user_id == current_user.id
    ).all()
    
    # Simulate completed topics by taking words from assessment titles
    completed_topics = []
    for a in assessments:
        completed_topics.extend(a.title.split())
        
    # Just to show some progress in demo cases if they have no assessments
    if not completed_topics and current_user.xp_points and current_user.xp_points > 100:
        if track_id == "frontend_dev":
            completed_topics = ["HTML", "CSS", "DOM"]
        elif track_id == "backend_dev":
            completed_topics = ["SQL", "OOP"]
            
    return calculate_track_progress(completed_topics, track_id)
