"""
InterviewVault — Learning Path Service
Hardcoded standard paths (Green) per role + Gemini-generated extended topics (Yellow).
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from services.ai_service import _generate, _safe_parse_json
import models

# ─── Hardcoded Standard Learning Paths ───────────────────────────────────────
STANDARD_PATHS: Dict[str, Dict[str, Any]] = {
    "data_scientist": {
        "title": "Data Scientist",
        "icon": "📊",
        "description": "Master statistical foundations, ML algorithms, and data story-telling.",
        "green": [
            "Statistics & Probability",
            "Linear Algebra & Calculus",
            "Python for Data Science",
            "SQL & Data Querying",
            "Exploratory Data Analysis",
            "Feature Engineering",
            "Machine Learning Fundamentals",
            "Model Evaluation & Metrics",
        ],
        "yellow_seed": ["NLP & Text Processing", "Computer Vision", "Deep Learning & Neural Networks",
                        "GenAI & LLMs", "MLOps & Model Deployment", "Time Series Analysis",
                        "Recommender Systems", "Big Data & Spark", "A/B Testing & Experimentation"],
    },
    "software_engineer": {
        "title": "Software Engineer",
        "icon": "💻",
        "description": "Excel at DSA, system design, and core CS fundamentals.",
        "green": [
            "Data Structures & Algorithms",
            "System Design",
            "Object-Oriented Programming",
            "Databases (SQL + NoSQL)",
            "Computer Networks",
            "Operating Systems",
            "Concurrency & Multithreading",
            "Behavioral & Leadership",
        ],
        "yellow_seed": ["Distributed Systems", "Kubernetes & Docker", "Microservices Architecture",
                        "Cloud Architecture (AWS/GCP)", "Low-Level System Design",
                        "Security & Authentication", "Performance Optimization", "GraphQL & WebSockets"],
    },
    "ml_engineer": {
        "title": "ML Engineer",
        "icon": "🤖",
        "description": "Build, deploy, and scale production ML systems.",
        "green": [
            "Machine Learning Algorithms",
            "Deep Learning & Neural Networks",
            "Python (NumPy/Pandas/PyTorch)",
            "Data Pipelines & ETL",
            "Model Deployment & Serving",
            "SQL for ML",
            "Statistics & Probability",
            "System Design for ML",
        ],
        "yellow_seed": ["MLOps (MLflow/Kubeflow)", "Feature Stores", "Distributed Training",
                        "LLM Fine-tuning & RLHF", "GenAI Systems & RAG", "Computer Vision in Production",
                        "Recommendation Systems", "Reinforcement Learning"],
    },
    "frontend_developer": {
        "title": "Frontend Developer",
        "icon": "🎨",
        "description": "Craft exceptional user interfaces and web experiences.",
        "green": [
            "HTML & CSS Mastery",
            "JavaScript (ES6+)",
            "React.js Fundamentals",
            "State Management (Redux/Zustand)",
            "REST APIs & Async JS",
            "Web Performance & Optimization",
            "Responsive & Accessible Design",
            "Browser APIs & DOM",
        ],
        "yellow_seed": ["TypeScript", "Next.js & SSR", "Testing (Jest/Cypress/RTL)", "WebSockets & Real-time",
                        "Progressive Web Apps", "Web Animations (GSAP/Framer)", "Micro-frontends",
                        "Design Systems & Storybook"],
    },
    "backend_developer": {
        "title": "Backend Developer",
        "icon": "⚙️",
        "description": "Architect robust APIs, databases, and scalable server systems.",
        "green": [
            "Python / Java / Node.js Core",
            "Databases (SQL + NoSQL)",
            "REST API Design",
            "Authentication & Authorization",
            "System Design",
            "Caching & Message Queues",
            "Security Best Practices",
            "Testing & CI/CD",
        ],
        "yellow_seed": ["Microservices Architecture", "Docker & Kubernetes", "Event-driven Architecture",
                        "gRPC & WebSockets", "Database Internals & Optimization", "Cloud (AWS/GCP/Azure)",
                        "Service Mesh & Observability", "Serverless Computing"],
    },
    "product_manager": {
        "title": "Product Manager",
        "icon": "📋",
        "description": "Define product strategy, drive execution, and ship great products.",
        "green": [
            "Product Strategy & Vision",
            "User Research & Personas",
            "PRD Writing & Documentation",
            "Prioritization Frameworks (RICE, ICE)",
            "Go-to-Market Strategy",
            "Metrics, KPIs & Analytics",
            "Agile / Scrum Process",
            "Stakeholder Management",
        ],
        "yellow_seed": ["Technical Literacy for PMs", "Design Thinking & UX", "Competitive Analysis",
                        "Growth Hacking", "Financial Modeling & Unit Economics", "Data Analysis (SQL basics)",
                        "Product-Led Growth", "AI/ML for Product Managers"],
    },
    "devops_engineer": {
        "title": "DevOps / Cloud Engineer",
        "icon": "☁️",
        "description": "Build reliable infrastructure, CI/CD pipelines, and cloud-native systems.",
        "green": [
            "Linux & Shell Scripting",
            "Docker & Containerization",
            "Kubernetes Orchestration",
            "CI/CD Pipelines",
            "Cloud Fundamentals (AWS/GCP/Azure)",
            "Networking & DNS",
            "Infrastructure as Code (Terraform)",
            "Monitoring & Alerting",
        ],
        "yellow_seed": ["Service Mesh (Istio/Linkerd)", "Observability (Prometheus/Grafana)", "DevSecOps",
                        "Cost Optimization", "Site Reliability Engineering", "GitOps",
                        "Chaos Engineering", "Multi-cloud Strategy"],
    },
    "data_analyst": {
        "title": "Data Analyst",
        "icon": "📈",
        "description": "Turn data into actionable insights with analytics and visualization.",
        "green": [
            "SQL (Advanced Queries)",
            "Excel & Google Sheets",
            "Python / R for Analysis",
            "Statistics & Hypothesis Testing",
            "Data Visualization (Tableau/Power BI)",
            "Business Intelligence",
            "Exploratory Data Analysis",
            "Communication & Storytelling",
        ],
        "yellow_seed": ["Machine Learning Basics", "Predictive Analytics", "A/B Testing",
                        "Big Data Tools (Spark/Hive)", "Dashboard Design", "Data Governance & Quality",
                        "ETL Pipelines", "Cloud Analytics (BigQuery/Redshift)"],
    },
}

# ─── Job Role Cards for Onboarding ───────────────────────────────────────────
ROLE_CARDS = [
    {"id": "software_engineer", "title": "Software Engineer", "icon": "💻",
     "tags": ["DSA", "System Design", "CS Fundamentals"], "color": "#6366f1"},
    {"id": "data_scientist", "title": "Data Scientist", "icon": "📊",
     "tags": ["ML", "Statistics", "Python"], "color": "#10b981"},
    {"id": "ml_engineer", "title": "ML Engineer", "icon": "🤖",
     "tags": ["Deep Learning", "MLOps", "LLMs"], "color": "#a855f7"},
    {"id": "frontend_developer", "title": "Frontend Developer", "icon": "🎨",
     "tags": ["React", "JavaScript", "UI/UX"], "color": "#f59e0b"},
    {"id": "backend_developer", "title": "Backend Developer", "icon": "⚙️",
     "tags": ["APIs", "Databases", "System Design"], "color": "#3b82f6"},
    {"id": "product_manager", "title": "Product Manager", "icon": "📋",
     "tags": ["Strategy", "Metrics", "Agile"], "color": "#ec4899"},
    {"id": "devops_engineer", "title": "DevOps / Cloud", "icon": "☁️",
     "tags": ["Docker", "K8s", "CI/CD"], "color": "#06b6d4"},
    {"id": "data_analyst", "title": "Data Analyst", "icon": "📈",
     "tags": ["SQL", "Visualization", "BI"], "color": "#84cc16"},
]


def get_standard_path(role_id: str) -> Optional[Dict[str, Any]]:
    """Return the hardcoded standard path for a given role."""
    return STANDARD_PATHS.get(role_id)


def get_role_cards() -> List[Dict[str, Any]]:
    return ROLE_CARDS


def generate_extended_topics(role_id: str, existing_yellow: List[str]) -> List[str]:
    """Use Gemini to generate additional extended/optional topics beyond the seed list."""
    path = STANDARD_PATHS.get(role_id)
    if not path:
        return existing_yellow

    role_title = path["title"]
    all_topics = path["green"] + existing_yellow

    prompt = f"""You are an expert career advisor specializing in interview preparation.

Role: {role_title}

Current topics already covered (do NOT repeat these):
{all_topics}

Generate 8-12 additional advanced or niche topics that would be valuable EXTENDED study topics 
for a {role_title} interview candidate who wants to go beyond the basics.
These should be real, specific, and relevant to modern {role_title} interviews.

Return ONLY a JSON array of strings (topic names):
["Topic 1", "Topic 2", ...]

Each topic should be:
- Specific (not generic like "Advanced Concepts")
- Relevant to current industry practices
- Different from the existing topics listed above
- Appropriate as optional extended learning"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, list):
            # Filter out any duplicates
            new_topics = [t for t in parsed if isinstance(t, str) and t not in all_topics]
            return existing_yellow + new_topics[:8]

    return existing_yellow


def create_learning_path(db: Session, user: models.User, role_id: str, custom_green: List[str] = None,
                          custom_yellow: List[str] = None) -> models.LearningPath:
    """Create-or-activate a user's learning path for `role_id`.

    If the user already has a path for this role, we simply return it (no
    overwrite — their saved customizations are preserved). Otherwise we create
    a fresh row from the standard template. Supports a single user preparing
    for multiple roles simultaneously.
    """
    path_data = STANDARD_PATHS.get(role_id, {})

    existing = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == user.id,
        models.LearningPath.job_role == role_id,
    ).first()
    if existing:
        return existing

    green = custom_green if custom_green is not None else path_data.get("green", [])
    yellow = custom_yellow if custom_yellow is not None else path_data.get("yellow_seed", [])
    lp = models.LearningPath(
        user_id=user.id,
        job_role=role_id,
        green_topics=green,
        yellow_topics=yellow,
    )
    db.add(lp)
    db.commit()
    db.refresh(lp)
    return lp


def get_user_learning_path(
    db: Session, user_id: int, job_role: Optional[str] = None
) -> Optional[models.LearningPath]:
    """Return one of the user's learning paths.

    - If `job_role` is given, return that specific path.
    - Otherwise return the user's *active* path (matching `User.target_role`),
      falling back to the most-recently-modified path if `target_role` is empty
      or no path matches it (handles legacy data).
    """
    q = db.query(models.LearningPath).filter(models.LearningPath.user_id == user_id)
    if job_role:
        return q.filter(models.LearningPath.job_role == job_role).first()

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user and user.target_role:
        active = q.filter(models.LearningPath.job_role == user.target_role).first()
        if active:
            return active
    return q.order_by(models.LearningPath.last_modified.desc()).first()


def get_user_learning_paths(db: Session, user_id: int) -> List[models.LearningPath]:
    """Return every learning path the user has across all roles."""
    return (
        db.query(models.LearningPath)
        .filter(models.LearningPath.user_id == user_id)
        .order_by(models.LearningPath.created_at.asc())
        .all()
    )


def analyze_resume_for_roles(resume_text: str) -> List[Dict[str, Any]]:
    """Use Gemini to analyze resume and suggest best-fit roles."""
    prompt = f"""You are a career counselor. Analyze this resume text and identify the top 3 most suitable job roles 
from this specific list: software_engineer, data_scientist, ml_engineer, frontend_developer, backend_developer, 
product_manager, devops_engineer, data_analyst

Resume text:
{resume_text[:4000]}

For each matched role provide a confidence score and key matching reasons.

Return JSON:
{{
  "matches": [
    {{
      "role_id": "software_engineer",
      "confidence": 85,
      "reasons": ["3 years Python experience", "Mentions LeetCode practice", "B.Tech CS background"]
    }}
  ]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and "matches" in result:
            return result["matches"]

    return []
