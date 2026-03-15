"""
InterviewVault — Daily Prep Planner Routes
Personalized daily study plans.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from auth import get_current_user
from database import get_db
from services.planner_service import generate_daily_plan

router = APIRouter(prefix="/api/planner", tags=["Daily Planner"])


@router.get("/today")
def get_today_plan(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get today's personalized study plan."""
    # Gather performance data
    submissions = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id,
        models.Submission.evaluated_at.isnot(None)
    ).all()

    total = len(submissions)
    scores = [s.total_score for s in submissions]
    avg_score = sum(scores) / len(scores) if scores else 0

    # Gather skill gaps from pathway steps
    pathway_steps = db.query(models.PathwayStep).filter(
        models.PathwayStep.user_id == current_user.id
    ).order_by(models.PathwayStep.created_at.desc()).limit(3).all()

    skill_gaps = []
    for p in pathway_steps:
        if p.skill_gaps:
            skill_gaps.extend(p.skill_gaps)
    skill_gaps = list(set(skill_gaps))[:5]

    # Recent assessment topics
    recent_assessments = db.query(models.Assessment).join(
        models.Submission, models.Assessment.id == models.Submission.assessment_id
    ).filter(
        models.Submission.user_id == current_user.id
    ).order_by(models.Submission.submitted_at.desc()).limit(5).all()
    recent_topics = [a.title for a in recent_assessments]

    plan = generate_daily_plan(
        xp_points=current_user.xp_points or 0,
        streak_days=current_user.streak_days or 0,
        average_score=round(avg_score, 1),
        total_submissions=total,
        skill_gaps=skill_gaps,
        recent_topics=recent_topics
    )

    return plan
