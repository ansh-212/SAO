from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import secrets
import string

from database import get_db
import models
from auth import get_current_user, get_current_admin
from pydantic import BaseModel

router = APIRouter(prefix="/api/classrooms", tags=["Classrooms"])


# --- Schemas ---
class ClassroomCreate(BaseModel):
    name: str
    description: str = ""


class JoinClassroom(BaseModel):
    class_code: str


# --- Helper ---
def generate_class_code(length=6):
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(chars) for _ in range(length))


# --- Admin Routes ---
@router.post("", response_model=Dict[str, Any])
def create_classroom(
    req: ClassroomCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    code = generate_class_code()
    # ensure unique code
    while db.query(models.Classroom).filter(models.Classroom.class_code == code).first():
        code = generate_class_code()
        
    classroom = models.Classroom(
        name=req.name,
        description=req.description,
        class_code=code,
        admin_id=admin.id
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    
    return {"message": "Classroom created successfully", "classroom": {
        "id": classroom.id,
        "name": classroom.name,
        "description": classroom.description,
        "class_code": classroom.class_code,
        "created_at": classroom.created_at,
        "member_count": 0,
        "assessment_count": 0
    }}


@router.get("", response_model=List[Dict[str, Any]])
def get_admin_classrooms(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    classrooms = db.query(models.Classroom).filter(models.Classroom.admin_id == admin.id).all()
    res = []
    for c in classrooms:
        member_count = db.query(models.ClassroomMember).filter(models.ClassroomMember.classroom_id == c.id).count()
        assessment_count = db.query(models.ClassroomAssessment).filter(models.ClassroomAssessment.classroom_id == c.id).count()
        res.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "class_code": c.class_code,
            "created_at": c.created_at,
            "member_count": member_count,
            "assessment_count": assessment_count
        })
    return res


@router.post("/{classroom_id}/assign/{assessment_id}")
def assign_assessment(
    classroom_id: int,
    assessment_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    classroom = db.query(models.Classroom).filter(
        models.Classroom.id == classroom_id,
        models.Classroom.admin_id == admin.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    existing = db.query(models.ClassroomAssessment).filter(
        models.ClassroomAssessment.classroom_id == classroom_id,
        models.ClassroomAssessment.assessment_id == assessment_id
    ).first()
    
    if existing:
        return {"message": "Assessment already assigned"}
        
    ca = models.ClassroomAssessment(classroom_id=classroom_id, assessment_id=assessment_id)
    db.add(ca)
    db.commit()
    return {"message": "Assessment assigned to classroom"}


# --- Student Routes ---
@router.post("/join")
def join_classroom(
    req: JoinClassroom,
    db: Session = Depends(get_db),
    student: models.User = Depends(get_current_user)
):
    classroom = db.query(models.Classroom).filter(models.Classroom.class_code == req.class_code.upper()).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid class code")
        
    existing = db.query(models.ClassroomMember).filter(
        models.ClassroomMember.classroom_id == classroom.id,
        models.ClassroomMember.student_id == student.id
    ).first()
    
    if existing:
        return {"message": "Already joined this classroom"}
        
    member = models.ClassroomMember(classroom_id=classroom.id, student_id=student.id)
    db.add(member)
    db.commit()
    return {"message": f"Successfully joined {classroom.name}"}


@router.get("/my-classrooms")
def get_student_classrooms(
    db: Session = Depends(get_db),
    student: models.User = Depends(get_current_user)
):
    memberships = db.query(models.ClassroomMember).filter(models.ClassroomMember.student_id == student.id).all()
    res = []
    for m in memberships:
        c = m.classroom
        res.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "admin_name": c.admin.name if c.admin else "Teacher",
            "joined_at": m.joined_at
        })
    return res


@router.get("/my-assessments")
def get_student_assessments(
    db: Session = Depends(get_db),
    student: models.User = Depends(get_current_user)
):
    # Find all assessments assigned to classrooms the student is part of
    memberships = db.query(models.ClassroomMember).filter(models.ClassroomMember.student_id == student.id).all()
    classroom_ids = [m.classroom_id for m in memberships]
    
    if not classroom_ids:
        return []
        
    cas = db.query(models.ClassroomAssessment).filter(models.ClassroomAssessment.classroom_id.in_(classroom_ids)).all()
    
    res = []
    seen = set()
    for ca in cas:
        if ca.assessment_id in seen: continue
        seen.add(ca.assessment_id)
        
        a = ca.assessment
        if not a or not a.is_active: continue
        
        # Check if already submitted
        submission = db.query(models.Submission).filter(
            models.Submission.assessment_id == a.id,
            models.Submission.user_id == student.id
        ).first()
        
        res.append({
            "id": a.id,
            "title": a.title,
            "category": a.category,
            "difficulty": a.difficulty,
            "num_questions": len(a.questions) if a.questions else 0,
            "time_limit_minutes": a.time_limit_minutes,
            "thumbnail_emoji": a.thumbnail_emoji,
            "assigned_via_classroom_id": ca.classroom_id,
            "published_at": ca.published_at,
            "status": "completed" if submission else "pending",
            "score": submission.total_score if submission else None
        })
        
    # Sort pending first, then by published date desc
    res.sort(key=lambda x: (x["status"] == "completed", x["published_at"]), reverse=True)
    return res
