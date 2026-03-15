from datetime import datetime
import json
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student")  # 'student' or 'admin'
    avatar_color = Column(String(20), default="#6366f1")
    xp_points = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_active = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    preferred_language = Column(String(10), default="en")  # en, hi, mr
    college = Column(String(255), default="")
    phone = Column(String(20), default="")
    bio = Column(Text, default="")
    level = Column(Integer, default=1)
    last_streak_date = Column(DateTime, nullable=True)

    pdfs = relationship("PDF", back_populates="uploader")
    submissions = relationship("Submission", back_populates="user")
    certificates = relationship("Certificate", back_populates="user")
    badges = relationship("UserBadge", back_populates="user", lazy="dynamic")
    xp_logs = relationship("XPLog", back_populates="user", lazy="dynamic")


class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(Integer, primary_key=True, index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    extracted_text = Column(Text)
    num_pages = Column(Integer, default=0)
    language = Column(String(10), default="en")
    file_size_kb = Column(Float, default=0)
    upload_date = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("User", back_populates="pdfs")
    assessments = relationship("Assessment", back_populates="pdf")


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    questions = Column(JSON)           # List of question dicts
    difficulty = Column(String(20), default="intermediate")  # beginner/intermediate/advanced
    category = Column(String(100), default="General")
    time_limit_minutes = Column(Integer, default=30)
    language = Column(String(10), default="en")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    tags = Column(JSON)                # List of tag strings
    thumbnail_emoji = Column(String(10), default="📚")

    pdf = relationship("PDF", back_populates="assessments")
    creator = relationship("User", foreign_keys=[created_by])
    submissions = relationship("Submission", back_populates="assessment")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    assessment_id = Column(Integer, ForeignKey("assessments.id"))
    answers = Column(JSON)             # {question_index: answer_text}
    scores = Column(JSON)              # {question_index: {depth, accuracy, application, originality}}
    feedback = Column(JSON)            # {question_index: feedback_text}
    total_score = Column(Float, default=0.0)
    max_score = Column(Float, default=100.0)
    time_taken_seconds = Column(Integer, default=0)
    anticheat_flags = Column(JSON)     # {plagiarism_score, tab_switches, copy_paste_count}
    audio_transcript = Column(Text)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    evaluated_at = Column(DateTime)

    user = relationship("User", back_populates="submissions")
    assessment = relationship("Assessment", back_populates="submissions")
    certificate = relationship("Certificate", back_populates="submission", uselist=False)


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    submission_id = Column(Integer, ForeignKey("submissions.id"))
    cert_filename = Column(String(500))
    qr_hash = Column(String(64), unique=True, index=True)
    issued_at = Column(DateTime, default=datetime.utcnow)
    is_valid = Column(Boolean, default=True)

    user = relationship("User", back_populates="certificates")
    submission = relationship("Submission", back_populates="certificate")


class PathwayStep(Base):
    __tablename__ = "pathway_steps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    source_assessment_id = Column(Integer, ForeignKey("assessments.id"))
    recommended_assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    reason = Column(Text)
    skill_gaps = Column(JSON)          # List of identified weak areas
    recommended_topics = Column(JSON)  # List of topic strings to study
    created_at = Column(DateTime, default=datetime.utcnow)
    is_completed = Column(Boolean, default=False)


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_key = Column(String(50), nullable=False)  # key from BADGE_DEFS
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")


class XPLog(Base):
    __tablename__ = "xp_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String(200), nullable=False)  # "assessment_complete", "badge_earned", etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="xp_logs")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    class_code = Column(String(20), unique=True, index=True, nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    admin = relationship("User", foreign_keys=[admin_id])
    members = relationship("ClassroomMember", back_populates="classroom", cascade="all, delete-orphan")
    assessments = relationship("ClassroomAssessment", back_populates="classroom", cascade="all, delete-orphan")


class ClassroomMember(Base):
    __tablename__ = "classroom_members"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="members")
    student = relationship("User", foreign_keys=[student_id])


class ClassroomAssessment(Base):
    __tablename__ = "classroom_assessments"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    published_at = Column(DateTime, default=datetime.utcnow)
    due_at = Column(DateTime, nullable=True)

    classroom = relationship("Classroom", back_populates="assessments")
    assessment = relationship("Assessment")

