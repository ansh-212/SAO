"""
InterviewVault — Role-Based Tracks Service
Defines learning roadmaps for different roles (Frontend, Backend, etc.).
"""
from typing import List, Dict, Any

# Static definitions of available role-based tracks
ROLE_TRACKS = [
    {
        "id": "frontend_dev",
        "title": "Frontend Developer",
        "icon": "🎨",
        "description": "Master UI/UX, React, JavaScript, and Web Performance.",
        "milestones": [
            {"id": "fe_1", "title": "Internet Fundamentals", "topics": ["HTTP", "DNS", "Browsers"]},
            {"id": "fe_2", "title": "HTML, CSS & JS Core", "topics": ["DOM", "CSS Grid", "ES6+"]},
            {"id": "fe_3", "title": "Frontend Frameworks", "topics": ["React", "State Management", "Routing"]},
            {"id": "fe_4", "title": "Web Performance", "topics": ["Optimization", "Caching", "Lighthouse"]},
            {"id": "fe_5", "title": "System Design (UI)", "topics": ["Component Design", "Scalability"]},
        ]
    },
    {
        "id": "backend_dev",
        "title": "Backend Developer",
        "icon": "⚙️",
        "description": "Architect robust servers, APIs, and databases.",
        "milestones": [
            {"id": "be_1", "title": "Language Core", "topics": ["Python/Java", "Data Structures", "OOP"]},
            {"id": "be_2", "title": "Databases", "topics": ["SQL", "NoSQL", "Indexing", "ACID"]},
            {"id": "be_3", "title": "APIs & Communication", "topics": ["REST", "GraphQL", "gRPC", "WebSockets"]},
            {"id": "be_4", "title": "System Architecture", "topics": ["Microservices", "Message Queues", "Caching"]},
            {"id": "be_5", "title": "Security & DevOps", "topics": ["Auth", "Docker", "CI/CD"]},
        ]
    },
    {
        "id": "data_science",
        "title": "Data Scientist",
        "icon": "📊",
        "description": "Discover insights through data modeling and machine learning.",
        "milestones": [
            {"id": "ds_1", "title": "Math & Stats", "topics": ["Linear Algebra", "Probability", "Calculus"]},
            {"id": "ds_2", "title": "Data Manipulation", "topics": ["Pandas", "NumPy", "SQL"]},
            {"id": "ds_3", "title": "Machine Learning", "topics": ["Regression", "Classification", "Clustering"]},
            {"id": "ds_4", "title": "Deep Learning", "topics": ["Neural Networks", "NLP", "Computer Vision"]},
            {"id": "ds_5", "title": "Deployment", "topics": ["Model Serving", "MLOps"]},
        ]
    }
]

def get_all_tracks() -> List[Dict[str, Any]]:
    return ROLE_TRACKS

def get_track_by_id(track_id: str) -> Dict[str, Any]:
    return next((t for t in ROLE_TRACKS if t["id"] == track_id), None)

def calculate_track_progress(user_completed_topics: List[str], track_id: str) -> Dict[str, Any]:
    """Calculate progress for a track based on a user's completed topics."""
    track = get_track_by_id(track_id)
    if not track:
        return {"error": "Track not found"}

    completed_topic_set = set([t.lower() for t in user_completed_topics])
    
    total_topics = 0
    completed_count = 0
    milestone_progress = []

    for ms in track["milestones"]:
        ms_topics = ms["topics"]
        ms_total = len(ms_topics)
        ms_completed = sum(1 for t in ms_topics if t.lower() in completed_topic_set)
        
        total_topics += ms_total
        completed_count += ms_completed
        
        milestone_progress.append({
            "id": ms["id"],
            "title": ms["title"],
            "total_topics": ms_total,
            "completed_topics": ms_completed,
            "is_completed": ms_completed == ms_total,
            "percent_complete": int((ms_completed / ms_total) * 100) if ms_total > 0 else 0
        })

    overall_progress = int((completed_count / total_topics) * 100) if total_topics > 0 else 0

    return {
        "track_id": track_id,
        "overall_progress": overall_progress,
        "total_topics": total_topics,
        "completed_count": completed_count,
        "milestones": milestone_progress
    }
