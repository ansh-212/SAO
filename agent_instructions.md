# 🧠 InterviewVault — Agent Instructions & Product Blueprint

> **Last updated:** April 2026 — All open questions resolved. Ready for implementation.

> **Purpose:** This document is the master reference for any AI agent or developer working on InterviewVault. It captures the existing platform state, the full product vision, and the feature roadmap in one place. Always read this before making any design, feature, or architectural decision.

---

## 📌 What Is InterviewVault?

**InterviewVault** is a GenAI- and Agentic AI-powered interview preparation platform — the *"Udemy for Interview Prep."*

It offers adaptive, gamified learning for professionals and students across skill levels (Basic, Intermediate, Advanced) with role-specific subjects like Statistics, ML, NLP, and GenAI for Data Scientists, DSA for Software Engineers, etc.

**Core Philosophy:**
- Every user gets a personalized, adaptive learning path
- Mock interviews are not generic; they're based on what a user has studied and where they are weak
- The system gets smarter every time a user engages with it
- The platform emulates a real interview end-to-end — technical, behavioral, body language, and communication

**Target Platform:** Web-first (desktop browser); mobile app comes later.

---

## 🎨 UI/UX Excellence Standard — NON-NEGOTIABLE

> **This is a top priority.** The UI must be stunning, modern, and use best-in-class React libraries. Generic-looking UIs are unacceptable.

### Mandatory React Libraries to Use

| Library | Use For | Install |
|---|---|---|
| **`@radix-ui/react-*`** | Accessible primitives: dialogs, tooltips, dropdowns, sliders, tabs | `npm i @radix-ui/react-dialog @radix-ui/react-tooltip` etc. |
| **`shadcn/ui`** | Pre-styled, customizable component layer on top of Radix | Follow official shadcn CLI setup |
| **`framer-motion`** | All animations, transitions, drag-and-drop animations | Already installed |
| **`@dnd-kit/core` + `@dnd-kit/sortable`** | Drag-and-drop for Green/Yellow topic lists | `npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` |
| **`recharts`** | Data charts (skill radar, score history, topic meters) | Already installed |
| **`lucide-react`** | Icons (consistent, crisp, modern) | `npm i lucide-react` |
| **`react-hot-toast`** | Toast notifications (replace custom ones) | `npm i react-hot-toast` |
| **`@tanstack/react-query`** | Server state management, data fetching with caching | `npm i @tanstack/react-query` |
| **`cmdk`** | Command palette (power-user search across the platform) | `npm i cmdk` |
| **`react-markdown`** | Render Gemini-generated articles with proper formatting | `npm i react-markdown remark-gfm` |
| **`react-resizable-panels`** | Split-pane layouts (e.g., article + notes side by side) | `npm i react-resizable-panels` |
| **`@radix-ui/react-progress`** | Beautiful animated skill/progress meters | Part of Radix |
| **`vaul`** | Drawer component (mobile-friendly slide-up panels) | `npm i vaul` |

### Visual Design Rules

1. **Color system is already established** — use the existing CSS variables (`--dk-*`). Extend don't replace.
2. **Every new page must feel alive** — use Framer Motion's `staggerChildren`, `layoutId` for shared-element transitions, spring animations.
3. **Glassmorphism everywhere:** `backdrop-filter: blur(20px)`, translucent cards.
4. **Typography:** Use `Space Grotesk` for headings, `Inter` or `Geist` for body. Already loaded in the project.
5. **Micro-interactions on everything:** hover lifts (`translateY(-4px)`), active presses (`scale(0.97)`), glow effects on focus.
6. **Skill meters:** Use circular progress rings (SVG-based or CSS conic-gradient) — not just bars.
7. **Drag-and-drop:** Use `@dnd-kit` — items must have smooth grab animation, placeholder ghost, and drop zone highlight.
8. **Onboarding:** Multi-step with animated step indicators, smooth slide transitions between steps.
9. **Company cards:** Rich cards with company logo (use Clearbit/favicon fallback), topic chips, match score badge.
10. **Interview report:** Full-page visually rich report with section dividers, color-coded scores, timeline transcript view.

### shadcn/ui Integration Note
- Initialize shadcn in `frontend_final/` with: `npx shadcn@latest init`
- Use components: `Button`, `Card`, `Dialog`, `Input`, `Progress`, `Tabs`, `Tooltip`, `Badge`, `Separator`, `Avatar`, `Sheet`
- shadcn components inherit the existing dark theme via CSS variables — ensure `--background` maps to `--dk-bg` etc.

---

## 🏗️ Current Codebase State (What Already Exists)

### Tech Stack
| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python), SQLAlchemy ORM, SQLite DB |
| **AI Engine** | Google Gemini (`gemini-2.5-flash`) via `google-genai` SDK |
| **Frontend** | React 19 + Vite 7, React Router 7, Axios |
| **Proctoring** | `face-api.js` (face detection, gaze, expressions), TensorFlow.js COCO-SSD (object detection) |
| **Charts** | Recharts + Chart.js (Radar, Bar) |
| **Code Editor** | Monaco Editor |
| **Audio** | OpenAI Whisper (STT) |
| **Certs** | Pillow + QR Code generator |

### Existing Backend Services (`backend_final/services/`)
| File | What It Does |
|---|---|
| `ai_service.py` | Gemini-powered: question generation, answer evaluation (4D scoring), follow-up Qs, adaptive pathway generation, AI-text detection, confidence analysis |
| `interview_service.py` | Multi-turn mock interview: `start_interview`, `continue_interview`, `end_interview` with full evaluation (technical depth, communication, problem solving, clarity, confidence) |
| `gamification_service.py` | XP system, level tracking (Rookie→Legend), badge system (11 badges), leaderboard, streak tracking |
| `anticheat_service.py` | Plagiarism detection, AI-generated answer detection, tab-switch and copy-paste monitoring |
| `certificate_service.py` | PNG certificate generation with QR code verification |
| `planner_service.py` | Daily prep plan generation |
| `remediation_service.py` | Remediation/recovery recommendations for weak topics |
| `track_service.py` | Learning tracks and milestone progress tracking |
| `pdf_service.py` | PDF text extraction for assessment generation |
| `whisper_service.py` | Audio-to-text transcription |

### Existing Backend Routes (`backend_final/routes/`)
| Route | Endpoints Summary |
|---|---|
| `auth_routes.py` | Register, Login, /me |
| `pdf_routes.py` | Upload PDF, List PDFs |
| `assessment_routes.py` | CRUD assessments, generate follow-up questions |
| `submission_routes.py` | Submit answers, audio, AI evaluation |
| `certificate_routes.py` | Generate, download, verify certs |
| `analytics_routes.py` | Admin and student analytics |
| `user_routes.py` | Profile management |
| `interview_routes.py` | Start/continue/end mock interview |
| `gamification_routes.py` | XP, badges, leaderboard |
| `classroom_routes.py` | Classroom management (admin-student) |
| `track_routes.py` | Learning tracks and milestones |
| `planner_routes.py` | Daily plan generation |
| `remediation_routes.py` | Remediation recommendations |

### Existing Frontend Pages (`frontend_final/src/pages/`)
| Page | What It Has |
|---|---|
| `Landing.jsx` | Public marketing page |
| `Login.jsx` / `Register.jsx` | Auth pages |
| `StudentDashboard.jsx` | Skill radar chart, score history, daily plan widget, gamification (level/badges/leaderboard), assessments list, classroom join |
| `AdminDashboard.jsx` | Admin analytics panel |
| `TakeAssessment.jsx` | Assessment-taking with timer, webcam proctoring |
| `AssessmentResult.jsx` | Detailed result with 4D scores, feedback, pathway |
| `InterviewCoach.jsx` | Multi-turn AI mock interview with live webcam proctoring |
| `Tracks.jsx` | Role-based roadmap with milestone progress |
| `RemediationHub.jsx` | Weak topic recovery content |
| `Portfolio.jsx` | Student portfolio + certificates |
| `Profile.jsx` | Profile editing |
| `CodingSkills.jsx` | Monaco code editor + plagiarism detection |

### Existing Database Models (`backend_final/models.py`)
| Model | Key Fields |
|---|---|
| `User` | id, email, name, role, xp_points, streak_days, level, avatar_color |
| `PDF` | id, uploader_id, filename, extracted_text |
| `Assessment` | id, title, difficulty, questions (JSON), category, tags, language |
| `Submission` | id, user_id, assessment_id, answers, scores (4D), feedback, total_score, anticheat_flags, audio_transcript |
| `Certificate` | id, user_id, submission_id, qr_hash |
| `PathwayStep` | id, user_id, skill_gaps, recommended_topics |
| `UserBadge` | id, user_id, badge_key |
| `XPLog` | id, user_id, amount, reason |
| `Classroom` / `ClassroomMember` / `ClassroomAssessment` | Full classroom management |

### Existing Proctoring Capabilities (Frontend)
- **Face detection** via `face-api.js` — no face, multiple faces
- **Gaze tracking** — 68-point landmarks, looking-away detection
- **Expression analysis** — stress, confusion indicators
- **Object detection** — TensorFlow.js COCO-SSD (phone, book, laptop)
- **Integrity scoring** — composite score, timestamped violation log

### Existing Gamification
- **XP system** with logged reasons
- **7 Levels**: Rookie → Apprentice → Challenger → Expert → Master → Grandmaster → Legend
- **11 Badges**: First Blood, On Fire (3-day streak), Unstoppable (7-day), Legend (30-day), Flawless (100%), Top Gun, Code Warrior, Polyglot, Speed Demon, Five Star, Ten Star
- **Leaderboard** by XP

---

## 🗺️ Full Product Vision & Feature Roadmap

### Phase 1: Onboarding & Personalized Learning Path (NEW)

#### 1.1 — Role-Based Onboarding
**Trigger:** User registers for the first time  
**Flow:**
1. Ask user: "What role are you preparing for?" → show cards (Data Scientist, Software Engineer, ML Engineer, Product Manager, etc.)
2. Ask: "Do you have a resume?" → option to upload PDF
3. OCR + LLM analysis of resume → show role-fit cards (clickable): "Based on your resume, these roles suit you best: [Data Analyst ✦] [ML Engineer ✦] [Backend Dev]"
4. User clicks a role card → go to **Learning Path Configuration (1.2)**

**Implementation Notes:**
- Resume OCR: Use `pdfplumber` (already in requirements) + Gemini for text analysis
- Add `onboarding_complete` flag to `User` model
- Add `target_role` field to `User` model
- Resume analysis endpoint: `POST /api/users/analyze-resume`

---

#### 1.2 — Interactive Learning Path Configurator
**Concept:** Two-column drag-and-drop topic list  
**Green List (left):** Topics in the standard curated path for that role  
**Yellow List (right):** Extended/optional topics related to the role  

**Rules:**
- Topics removed from Green → move to Yellow
- Topics dragged from Yellow → move to Green
- On "Start Learning" → save final Green list as the user's active syllabus

**Path Seeder:** Pre-curate standard paths for each role. Example for Data Scientist:
- Green: Statistics, ML Fundamentals, Python for DS, EDA, Feature Engineering, Model Evaluation, SQL
- Yellow: NLP, Computer Vision, GenAI/LLMs, MLOps, Spark, Recommender Systems

**Alternative Path Entry — Diagnostic Test (1.3)**

---

#### 1.3 — Adaptive Diagnostic Assessment
**When:** User opts for "Take Diagnostic Test" instead of manual topic selection  
**How it works:**
1. For each topic in the standard path, ask questions in progressive difficulty:
   - **Easy** → if passed, ask **Intermediate** → if passed, ask **Advanced**
   - Stop at first failure
2. **Classification:**
   - Scored ≤ Easy level: Topic is **Weak** → added to Green list (must study)
   - Scored up to Intermediate: Topic is **Intermediate** → added to Green list
   - Scored Advanced: Topic is **Expert** → added to Yellow list (optional re-study)
3. After all topics assessed: Show results and populate the two-column configurator

**AI Model:** Use Gemini for question generation. Prompt pattern:  
`"Generate a [easy/intermediate/advanced] question on [topic] for the [role] role. This is for a diagnostic test."`

**Implementation:** New endpoint `POST /api/diagnostic/question` and `POST /api/diagnostic/evaluate`

---

#### 1.4 — Learning Path Personalization Options (after initial path setup)

**A) Time-Based Personalization**
User sees: "My interview is in..."
- ⚡ 24 hours
- 📅 1 week
- 🗓️ 1 month
- 📆 3 months
- 🎯 6 months

System logic:
- Sort topics by: (1) frequency in real interviews, (2) user's weakest areas from diagnostic
- Prune/prioritize Green list accordingly
- 24hr mode: top 10 most-asked topics only

**B) Company-Specific Personalization**
1. User selects **company** (or searches) + **job role** at that company
2. **Perplexity API** fetches real-time data: company interview patterns, favorite topics, tech stack, domain focus, Glassdoor/LeetCode/blog sources
3. **Gemini** synthesizes the retrieved data → generates a priority-ranked topic list and pattern summary
4. Shows analysis card → user gets company-curated Green/Yellow lists
5. Option: Take a targeted test on company-specific topics → intersection of user weaknesses + company hot topics = ultra-personalized plan

**Company Intelligence DB:**
- Pre-seed 4-5 companies (Google, Amazon, Microsoft, Meta, Flipkart, etc.)
- When a new company is analyzed → cache results in DB so it's never re-fetched for the same company+role
- Library grows organically with every new user who searches an unseen company
- DB Table: `CompanyInsights` (company_name, role, topics, patterns, analysis_summary, source_data, analyzed_at)

**C) Article + Notes + Mini-Test Learning Flow**
For each topic in the Green list:
1. Show Gemini-generated article for the topic
2. User reads → takes notes (editable notepad in UI)
3. 5-question quiz at the end
4. If user answers wrong → show explanation of why wrong + correct answer
5. Mark topic as "in progress" or "completed"
6. XP awarded on completion

---

### Phase 2: Mock Interview System (Enhancement of Existing)

#### 2.1 — User-Profile-Aware Interviews
**Current state:** InterviewCoach takes topic + difficulty from user selection  
**Enhancement:**
- Interview questions pulled from user's assessed weak topics first
- Also consider topics studied (from Green list completions)
- Interview history stored; previously covered topics aren't repeated unless weak

#### 2.2 — Full-Syllabus Interview Mode
**New Mode:** "Quick Full Interview"
- Available even if user hasn't finished studying
- Covers all topics in Green list regardless of completion
- Useful for users with <24hr prep time

#### 2.3 — Interview Storage & Transcript System
After each interview:
- Store full transcript in DB
- Generate comprehensive interview report
- Make past interviews browsable in "Past Interviews" section

**Interview Report must include:**
- Overall score + verdict (Strong Hire / Hire / Lean Hire / etc.)
- Technical performance by topic
- Communication assessment (clarity, vocabulary, pace)
- **Body language analysis** (from webcam data: posture, eye contact, confidence)
- **Expression analysis** (stress, nervousness indicators)
- **English language/speaking skill assessment** (from audio transcript)
- Visual charts for all dimensions
- Recommended next steps

**DB Table:** `InterviewSession` (user_id, transcript JSON, report JSON, created_at, topics_covered JSON, mode)

---

### Phase 3: Adaptive User Profiling System

#### 3.1 — Persistent User Skill Vector
Every test, diagnostic, or interview updates the user's skill profile:
- Topic-level mastery scores (0–100 per topic)
- Confidence scores per topic
- Historical trend (improving / declining / stable)
- Store as `UserSkillProfile` in DB: {user_id, topic, score, confidence, last_updated, history[]}

#### 3.2 — Self-Adapting Question Difficulty
Before each interview question, system checks:
- User's historical score on this topic
- Last time this was assessed
- Trend direction
→ Adjusts difficulty in real-time

#### 3.3 — Post-Activity Updates
After each:
- ✅ Topic quiz → update topic skill score
- ✅ Diagnostic test → update topic skill scores
- ✅ Mock interview → update topic skill scores + recalculate readiness
- ✅ Article + mini-test → update topic progress

---

### Phase 4: Dashboard & Progress Visualization

#### 4.1 — Topic-Level Progress Dashboard
Show the user:
- Overall readiness meter (0–100)
- Per-topic skill meters (0–100)
- Topics: Not Started / In Progress / Completed / Expert
- Interview readiness score (how ready are you for an actual interview?)

**Visual Design:** Meters, progress rings, heatmap-style topic grid

#### 4.2 — Interview History & Reports
- Paginated list of past interviews
- Click any entry → view full report
- Compare performance across interviews (trend charts)

---

### Phase 5: Body Language & Communication Analysis (Enhancement)

**Already have:** Face detection, gaze tracking, expression analysis (face-api.js), audio transcription (Whisper)

**Multi-Camera Architecture Note:**
> Body language analysis via multi-camera feed will be integrated in a future phase. The `behavioral_stats` object stored per-interview session is designed to be extensible — new sensor data fields (body keypoints, multi-angle video refs) can be added without schema changes. Do NOT hard-code assumptions about single-camera.

**Current Phase — What to Build Now:**
- **Posture proxy:** Infer body language from face position, head tilt angle, and face landmark geometry (already available from face-api.js 68-point model). Not 100% accurate but usable until multi-camera arrives.
- **Voice analysis (post-interview):** Count filler words ("um", "uh", "like", "you know"), measure speaking pace (words/minute from transcript + duration), detect long pauses
- **Language quality via Gemini:** Grammar correctness, vocabulary richness, answer coherence — analyzed from stored transcript after interview ends
- **Real-time alerts during interview:** "Looking away from camera", "Multiple faces detected" (already works via proctor), add "Appears nervous (high stress expression)" using existing expression data

**Post-interview report section: "Communication & Presence"**
- Eye contact % (from gaze tracking — already tracked)
- Expression timeline: calm / stressed / confident breakdown over interview duration
- Posture proxy score (from head position heuristics)
- Speaking pace (WPM from transcript)
- Filler word count and list
- Vocabulary richness score (Gemini analysis)
- Grammar & fluency score (Gemini analysis)
- Language quality examples (best and weakest moments quoted)

---

## 🔧 Technical Guidelines for New Development

### New DB Models to Add
```python
# In models.py — ADD these:

class UserSkillProfile(Base):
    __tablename__ = "user_skill_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic = Column(String(200))
    skill_score = Column(Float, default=0.0)  # 0-100
    confidence_score = Column(Float, default=50.0)
    last_updated = Column(DateTime, default=datetime.utcnow)
    history = Column(JSON)  # [{score, date}]

class CompanyInsight(Base):
    __tablename__ = "company_insights"
    id = Column(Integer, primary_key=True)
    company_name = Column(String(200))
    job_role = Column(String(200))
    topics = Column(JSON)  # priority-ordered list
    patterns = Column(JSON)  # interview patterns
    analysis_summary = Column(Text)
    source_data = Column(Text)  # scraped content
    analyzed_at = Column(DateTime, default=datetime.utcnow)

class UserTopicProgress(Base):
    __tablename__ = "user_topic_progress"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic = Column(String(200))
    job_role = Column(String(100))
    status = Column(String(20), default="not_started")  # not_started / in_progress / completed
    quiz_scores = Column(JSON)  # [{score, date}]
    notes = Column(Text, default="")
    article_read = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

class LearningPath(Base):
    __tablename__ = "learning_paths"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    job_role = Column(String(100))
    green_topics = Column(JSON)   # ordered list of topic strings
    yellow_topics = Column(JSON)  # extended/optional topics
    time_mode = Column(String(20), nullable=True)  # "24h"/"1w"/"1m"/"3m"/"6m"
    company = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow)

class DiagnosticSession(Base):
    __tablename__ = "diagnostic_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    job_role = Column(String(100))
    results = Column(JSON)  # {topic: {level_reached, scores}}
    completed_at = Column(DateTime, nullable=True)

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    mode = Column(String(30))  # "studied_topics" / "full_syllabus" / "company_specific"
    job_role = Column(String(100))
    company = Column(String(200), nullable=True)
    topics_covered = Column(JSON)
    transcript = Column(JSON)  # [{role, content, timestamp}]
    report = Column(JSON)  # full interview report
    behavioral_stats = Column(JSON)  # from proctoring
    overall_score = Column(Float, nullable=True)
    verdict = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### New API Endpoints to Build
```
# Onboarding
POST  /api/onboarding/analyze-resume     → Upload resume, get role suggestions
POST  /api/onboarding/select-role        → Save selected role, init learning path

# Learning Path
GET   /api/learning-path/my             → Get user's current learning path
POST  /api/learning-path/configure      → Save Green/Yellow topic lists
PUT   /api/learning-path/personalize    → Apply time/company personalization

# Diagnostic
POST  /api/diagnostic/start             → Begin diagnostic for a role
POST  /api/diagnostic/next-question     → Get next adaptive question
POST  /api/diagnostic/submit-answer     → Evaluate answer, determine next level
POST  /api/diagnostic/complete          → Finalize diagnostic, return topic classification

# Company Intelligence
GET   /api/companies                    → List all known companies
GET   /api/companies/{name}/insights    → Get analysis for a company + role
POST  /api/companies/analyze            → Trigger new company analysis via Gemini

# Topic Learning (Article + Quiz)
GET   /api/topics/{topic}/article       → Get Gemini-generated article
POST  /api/topics/{topic}/quiz          → Get 5-question quiz
POST  /api/topics/{topic}/quiz/submit   → Submit quiz, get feedback, update skill
PUT   /api/topics/{topic}/notes         → Save user notes

# Interview Sessions
GET   /api/interviews/history           → List all past interview sessions
GET   /api/interviews/{id}              → Get full session + report
POST  /api/interviews/start             → Start new interview session (mode-aware)

# User Skill Profile
GET   /api/users/skill-profile          → Get all topic scores for user
PUT   /api/users/skill-profile/update   → Update scores after activity
```

### Frontend Routes to Add
```
/onboarding         → Onboarding flow (role selection + resume)
/onboarding/path    → Learning path configurator (Green/Yellow lists)
/onboarding/diagnostic → Adaptive diagnostic test
/learn              → Topic learning hub (article + notes + quiz per topic)
/learn/:topic       → Single topic learning page
/plan               → Path personalization (time + company)
/interviews         → Past interviews list
/interviews/:id     → Full interview report
/dashboard          → Enhanced skill dashboard (already exists, expand it)
```

---

## 🎨 Design System Principles

### Color Language (already established)
- **Background:** `#05050a` (deep void)
- **Primary:** `#6366f1` (indigo)
- **Accent:** `#a855f7` (purple)
- **Success/Green List:** `#10b981` (emerald)
- **Warning/Yellow List:** `#f59e0b` (amber)
- **Error:** `#ef4444`
- **Text:** `#f1f5f9` / Muted: `#64748b`

### Component Conventions
- `DarkLayout` wrapper for all authenticated pages
- Glassmorphic cards: `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.06)`
- Spotlight hover effect on interactive cards (mouse position CSS vars `--mx`, `--my`)
- Framer Motion for page transitions and stagger animations
- `motion.div` with `initial={{ opacity: 0, y: 16 }}` → `animate={{ opacity: 1, y: 0 }}`

### Green/Yellow List Visual Design
- Green List: Topics with `border-left: 3px solid #10b981`, subtle green glow on hover
- Yellow List: Topics with `border-left: 3px solid #f59e0b`, subtle amber glow on hover
- Drag handles visible on hover
- Smooth drag-and-drop animations (use `@dnd-kit` library)

---

## ⚡ AI Usage Guidelines (Gemini + Perplexity)

### When to Use Which AI

| Task | Use | Why |
|---|---|---|
| Question generation (diagnostic, quiz, interview) | **Gemini** | Better at structured generation, JSON mode |
| Answer evaluation + scoring | **Gemini** | Strong reasoning, multi-dimensional scoring |
| Article generation for topics | **Gemini** | High-quality long-form educational content |
| Adaptive pathway generation | **Gemini** | Reasoning over user profile data |
| Company research (real-time data) | **Perplexity** | Has live web access, knows recent interview patterns |
| Company interview pattern analysis | **Perplexity → then Gemini** | Perplexity retrieves, Gemini synthesizes |
| Voice/transcript language quality | **Gemini** | Strong NLU, fluency/grammar analysis |
| Load balancing (Gemini rate limits hit) | **Perplexity** | Fallback for non-company tasks if needed |

### Gemini — Already Working Patterns (Reuse)
```python
# Standard Gemini call (from ai_service.py)
from services.ai_service import _generate, _safe_parse_json

raw = _generate(prompt, json_mode=True)
result = _safe_parse_json(raw)
```

### Multi-Pass JSON Parsing
Always use `_safe_parse_json()` — it has 5-pass parsing to handle Gemini output quirks.

### For New Gemini Prompts — Always:
1. Use `json_mode=True` for structured outputs
2. Provide a clear JSON schema in the prompt
3. Validate required fields after parsing
4. Have a graceful fallback

### Gemini Model
Currently using `gemini-2.5-flash` — keep using this.

### Perplexity API — New Integration
```python
# New file: backend_final/services/perplexity_service.py
import httpx
from config import settings  # Add PERPLEXITY_API_KEY to config

def search_company_interview_data(company: str, role: str) -> str:
    """
    Use Perplexity to fetch real-time company interview patterns.
    Returns raw text for Gemini to synthesize.
    """
    headers = {
        "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "sonar",  # Perplexity's web-search model
        "messages": [
            {
                "role": "user",
                "content": f"What are the most commonly asked interview questions and topics for {role} at {company}? Include difficulty levels, specific technical areas, and any known interview process patterns. Cite sources including Glassdoor, LeetCode discussions, company engineering blogs."
            }
        ],
        "return_citations": True
    }
    response = httpx.post(
        "https://api.perplexity.ai/chat/completions",
        headers=headers,
        json=payload,
        timeout=30
    )
    data = response.json()
    return data["choices"][0]["message"]["content"]
```

**Add to `.env`:**
```
PERPLEXITY_API_KEY=your_key_here
```
**Add to `config.py`:**
```python
PERPLEXITY_API_KEY: str = os.getenv("PERPLEXITY_API_KEY", "")
```

---

## 🔑 Critical Business Rules

1. **Every interview uses the user's stored skill profile** — never generic questions for a user who has history
2. **Diagnostic results must survive across sessions** — stored in DB, not just in-memory
3. **Company analysis results are cached** — never re-analyze the same company+role combination
4. **After every activity (quiz/interview/diagnostic), update `UserSkillProfile`** — this is the core of the self-adapting system
5. **Green list = commitment** — when user starts learning, the Green list is their syllabus; changes should be tracked
6. **Interview transcripts are permanent** — never delete, user must always be able to review
7. **Body language + communication analysis runs AFTER the interview** from the stored transcript + behavioral stats — not blocking the interview flow
8. **Skill meters (0–100) must update visually in real-time** after each assessment activity

---

## 📋 Feature Priority Order for Development

| Priority | Feature | Depends On |
|---|---|---|
| P0 | Role-based onboarding + role selection | Nothing |
| P0 | Resume OCR + role suggestion | Onboarding |
| P0 | Learning path configurator (Green/Yellow drag-drop) | Onboarding |
| P1 | Adaptive diagnostic assessment | Learning path |
| P1 | Topic article + notes + mini-quiz flow | Learning path |
| P1 | Enhanced student dashboard (skill meters) | Skill profile DB |
| P2 | Time-based path personalization | Learning path |
| P2 | Company-specific path personalization | Learning path + DB |
| P2 | Interview history page | InterviewSession model |
| P3 | Body language + communication analysis | Interview sessions |
| P3 | Full-syllabus interview mode | Learning path |
| P3 | Post-interview comprehensive report | Interview sessions |

---

## ✅ All Decisions Resolved

| Decision | Resolution |
|---|---|
| Company data source | **Perplexity API** for real-time retrieval → **Gemini** for synthesis |
| Posture detection | Use face-api.js heuristics now; multi-camera feed to be integrated later (architecture is already extensible) |
| Article generation | Generate once via Gemini, cache in DB keyed by `(topic, job_role)` |
| Voice analysis | Post-processing from stored transcript, async, non-blocking |
| Standard learning paths | Core (Green) paths = hard-coded seeds; Extended (Yellow) topics = Gemini-generated dynamically at onboarding |
| Assessment follow-up questions | ✅ **System already works** — see analysis below |

---

## 🔬 Existing Assessment Follow-Up System — Analysis & Verdict

### How It Currently Works
The follow-up question system in `TakeAssessment.jsx` + `assessment_routes.py` is a **Socratic probing system**, not a fully dynamic question list:

1. User answers a base question from the pre-generated assessment
2. User can click **"Get Follow-up"** button (only appears after 20+ char answer)
3. Frontend calls `POST /api/assessments/{id}/followup` with `{question_index, student_answer}`
4. Backend calls `generate_followup_question()` in `ai_service.py` — Gemini generates ONE contextual follow-up based on the student's specific answer
5. The follow-up appears inline below the original question; user can answer it
6. Follow-up answer is submitted alongside the main answers as `{idx}_followup` key

### What Works Well ✅
- **Truly adaptive:** Each follow-up is generated based on that student's actual answer (vague → ask for example; wrong → challenge it; good → probe deeper)
- **Socratic logic:** The prompt has 4 probe strategies: vague, wrong, good, extend
- **Non-disruptive:** Follow-up is optional, doesn't break the assessment flow
- **Answers are scored:** The `{idx}_followup` answers are included in the AI evaluation

### What's Currently Limited ⚠️
- Follow-ups are **opt-in by the user** (click button) — not automatic
- Only **one follow-up per question** max (the state `followups[qIndex]` is single-value)
- Follow-ups are generated **one at a time**, not as a chain
- The system doesn't yet **chain follow-ups** (follow-up to a follow-up)

### Verdict & Decision
> **✅ USE the existing system as the foundation.** It is solid and produces genuinely adaptive questions. 

**For topic quizzes (new feature):** Extend this same pattern — generate 5 base questions, then after each answer, auto-generate a follow-up (make it automatic, not opt-in). This creates a 5→10 question adaptive experience. 

**Enhancement needed:** Make follow-ups **automatic** in the new diagnostic and topic quiz flows (not click-triggered). For the existing `TakeAssessment` page, keep click-triggered (it's an assessment context, user controls the pace).

---

## 📁 File Reference Map

| What you need | Where it lives |
|---|---|
| Gemini call wrapper | `backend_final/services/ai_service.py` → `_generate()`, `_safe_parse_json()` |
| Follow-up Q generation | `ai_service.py` → `generate_followup_question()` |
| Interview multi-turn logic | `backend_final/services/interview_service.py` |
| Gamification (XP/badges) | `backend_final/services/gamification_service.py` |
| DB models | `backend_final/models.py` |
| Frontend design system | `frontend_final/src/index.css` (all `--dk-*` CSS variables) |
| Layout wrapper | `frontend_final/src/components/layout/DarkLayout.jsx` |
| Auth context | `frontend_final/src/context/AuthContext.jsx` |
| API client (Axios + JWT) | `frontend_final/src/api/client.js` |
| Proctoring component | `frontend_final/src/components/Proctor.jsx` |
