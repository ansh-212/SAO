"""
InterviewVault — Gamification Routes
Badges, leaderboard, XP history, and level info.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from auth import get_current_user
from database import get_db
from services.gamification_service import (
    get_level_info, get_user_badges, get_leaderboard, BADGE_DEFS
)

router = APIRouter(prefix="/api/gamification", tags=["Gamification"])


@router.get("/me")
def my_gamification(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get current user's gamification data: level, badges, streak."""
    level_info = get_level_info(current_user.xp_points or 0)
    badges = get_user_badges(db, current_user.id)

    return {
        "level": level_info,
        "badges": badges,
        "total_badges": len(badges),
        "available_badges": len(BADGE_DEFS),
        "streak_days": current_user.streak_days or 0,
        "xp_points": current_user.xp_points or 0,
    }


@router.get("/leaderboard")
def leaderboard(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get global leaderboard (top students by XP)."""
    entries = get_leaderboard(db, limit=min(limit, 50))

    # Find current user's rank
    my_rank = None
    for entry in entries:
        if entry["user_id"] == current_user.id:
            my_rank = entry["rank"]
            break

    # If user not in top N, calculate their actual rank
    if my_rank is None:
        rank = db.query(models.User).filter(
            models.User.role == "student",
            models.User.xp_points > (current_user.xp_points or 0)
        ).count() + 1
        my_rank = rank

    return {
        "entries": entries,
        "my_rank": my_rank,
        "my_xp": current_user.xp_points or 0,
    }


@router.get("/xp-history")
def xp_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get user's XP earned history."""
    logs = db.query(models.XPLog).filter(
        models.XPLog.user_id == current_user.id
    ).order_by(models.XPLog.created_at.desc()).limit(limit).all()

    return {
        "total_xp": current_user.xp_points or 0,
        "history": [
            {
                "amount": log.amount,
                "reason": log.reason,
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
            for log in logs
        ],
    }


@router.get("/badges/all")
def all_badges(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all available badges with earned status."""
    earned_keys = set(
        ub.badge_key for ub in db.query(models.UserBadge).filter(
            models.UserBadge.user_id == current_user.id
        ).all()
    )

    result = []
    for key, badge_def in BADGE_DEFS.items():
        result.append({
            "badge_key": key,
            "name": badge_def["name"],
            "emoji": badge_def["emoji"],
            "desc": badge_def["desc"],
            "xp": badge_def["xp"],
            "earned": key in earned_keys,
        })
    return result
