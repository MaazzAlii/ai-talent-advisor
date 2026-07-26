# 🚀 Careem AI Talent Advisor
### AI-Powered Resume Screening & Interview Intelligence Platform

> **SafeX Internship — Week 3 Project | AI & ML Department**
> Built by **Maaz Ali** (C380 / M380) | Group 56 | Supervisor: Ahmed Mujtaba

---

## 📋 Project Overview

**Careem AI Talent Advisor** is a fully functional AI agent prototype that automates the initial stages of technical hiring for **Careem** — the Middle East's leading ride-hailing super app. The system screens candidate resumes against a configurable Job Description, generates dimensional suitability scores, creates tailored technical interview questions, and provides personalized resume improvement advice.

This project was built for the **Week 3 AI & ML Task**: *"Build an AI agent that screens resumes against a job description and suggests interview questions."*

---

## ✨ Key Features

### 1. 🎯 Editable Job Description System
- Preloaded with a realistic **Careem Senior Backend Engineer (Python) — Ride Matching & Dispatch** JD
- **View Mode** — read the full JD in a clean formatted modal
- **Edit Mode** — modify any field (role, company, requirements, qualifications) in real time
- **Paste JD Mode** — paste any job description from LinkedIn, Indeed, or any job board; the system auto-parses it into structured fields
- **Reset to Default** — one-click restore to the original Careem JD
- JD changes invalidate all cached evaluations so candidates are re-evaluated against the new role

### 2. 🤖 Dual AI Model Support — Mistral Large & Groq Llama 3.3 70B
- **Mistral Large (`mistral-large-latest`)** — default, highest accuracy for nuanced resume analysis
- **Groq Llama 3.3 70B** — ultra-fast inference alternative
- Switch models from the header dropdown at any time, without restarting the server

### 3. ⚡ High-Speed Direct AI Resume Parsing (PDF, TXT, MD, JPG, PNG)
- Fast, zero-latency document parsing pipeline using **pypdf** for PDFs and **Pixtral (`pixtral-12b-2409`)** for image/screenshot resumes
- Extracted raw text is structured directly by **Mistral Large** into clean Markdown format in a single fast API call
- Eliminates heavy local file processing dependencies for maximum speed and accuracy

### 4. ⚖️ 5-Dimensional AI Scoring Model
Each candidate is evaluated on 5 weighted dimensions (0–5 scale per dimension):

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Python & Web Frameworks | 25% | FastAPI, Django, Flask proficiency |
| System Design & Scale | 25% | Microservices, concurrency, event-driven |
| Real-time APIs & Databases | 20% | PostgreSQL, Redis, WebSockets, gRPC |
| Cloud, Docker & Kubernetes | 15% | AWS, Docker, K8s deployments |
| Domain Fit | 15% | Logistics/ride-hailing industry experience |

**Overall Score Formula:**
```
score = (backend*0.25 + design*0.25 + databases*0.20 + devops*0.15 + domain*0.15) × 20
```

**Decision Logic:**
- 🟢 **Shortlisted** — Score ≥ 80
- 🟡 **Under Review** — Score 50–79
- 🔴 **Rejected** — Score < 50

### 5. 💬 Tailored Interview Questions
- Generates **5 unique technical interview questions** per candidate
- Questions target the candidate's specific weaknesses, projects, and Careem-domain scenarios
- Different questions for every candidate — not generic templates

### 6. 💡 Resume Improvement Guide (AI Career Coach)
- A dedicated **4th tab** per candidate showing:
  - **✦ Strengths** — what the resume does well vs the JD
  - **⚠ Critical Gaps** — missing skills or experience
  - **✏ Resume Suggestions** — specific resume writing improvements (e.g., "quantify Redis impact with metrics")
  - **🚀 Skills to Build** — concrete career development actions (e.g., "get AWS Certified Developer")
  - **Overall Career Advice** — 2–3 sentence coaching summary

### 7. ✅ Candidate Select / Deselect for Batch Screening
- Checkboxes on every candidate card for multi-select
- **"Screen Selected"** button — screen only checked candidates
- **"Screen All"** — evaluate entire candidate list
- **Select All / Deselect All** toggle button

### 8. 🎨 Premium Glassmorphic Dark UI
- Radial progress chart for overall score
- Animated dimension progress bars (color-coded by score level)
- Glassmorphism cards with blur backdrop effects
- Drag-and-drop resume upload zone
- 4-tab candidate dashboard (Assessment, Interview Qs, Improvement, Resume)

---

## 🏗️ System Architecture

```
careem-ai-talent-advisor/
├── app/
│   ├── config.py                  # Pydantic settings (LLM provider, model, API keys)
│   ├── main.py                    # FastAPI routes: /api/jd, /api/screen, /api/improve, /api/llm-config
│   ├── data/
│   │   ├── resumes/               # 6 preloaded .md resumes + custom uploads
│   │   └── job_description.json   # Active JD (auto-generated, gitignored)
│   ├── schemas/
│   │   └── api_schemas.py         # Pydantic models: JobDescription, EvaluationResult, ImprovementResult
│   ├── services/
│   │   ├── llm_service.py         # LLM client (Mistral Large / Groq), screen_resume(), improve_resume()
│   │   └── resume_service.py      # Resume loading, MarkItDown conversion, orchestration
│   └── tests/
│       └── test_screening.py      # 7 automated unit tests
├── frontend/
│   ├── index.html                 # Main layout with header, sidebar, 4-tab dashboard, 3-pane JD modal
│   ├── app.js                     # All UI logic: screening, improvement, JD editing, paste parsing
│   └── style.css                  # Glassmorphic dark theme (2000+ lines)
├── packages/
│   └── markitdown/                # Microsoft MarkItDown (local installation)
├── .env                           # API keys (gitignored)
├── .env.example                   # Environment template
├── requirements.txt               # Python dependencies
├── Dockerfile                     # Container image definition
└── README.md                      # This document
```

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- A **Mistral AI API key** (recommended) → [console.mistral.ai/keys](https://console.mistral.ai/keys)
- A **Groq API key** (alternative) → [console.groq.com/keys](https://console.groq.com/keys)

### Step-by-Step Setup

**1. Navigate to the project:**
```powershell
cd "careem-ai-talent-advisor"
```

**2. Create virtual environment:**
```powershell
python -m venv ..\.venv
```

**3. Activate virtual environment:**
```powershell
# Windows PowerShell
..\.venv\Scripts\Activate.ps1

# macOS/Linux
source ../.venv/bin/activate
```

**4. Install Python dependencies:**
```powershell
pip install -r requirements.txt
```

**5. Install Microsoft MarkItDown (local package):**
```powershell
pip install -e packages/markitdown
```

**6. Configure environment variables:**
```powershell
# Copy the template
copy .env.example .env
```

Edit `.env`:
```env
MISTRAL_API_KEY=your_mistral_api_key_here
GROQ_API_KEY=your_groq_api_key_here
LLM_PROVIDER=mistral
LLM_MODEL=mistral-large-latest
PORT=8000
```

---

## 🚀 Running the Application

**Start the FastAPI server:**
```powershell
python -m uvicorn app.main:app --port 8000
```

Open in browser:
- **Application UI:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧪 Running Tests

```powershell
..\.venv\Scripts\python -m pytest app/tests -v
```

Expected: **7 tests pass** ✅

---

## 📖 How to Use

### Screen a Pre-loaded Candidate
1. Click any candidate card in the left sidebar
2. AI evaluation runs automatically — see dimensional scores, status, and summary
3. Click **"Interview Qs"** tab for 5 tailored questions
4. Click **"Improvement"** tab → **"Generate AI Suggestions"** for career coaching

### Upload Your Own Resume
1. Drag-and-drop or click the upload zone (PDF, TXT, or MD)
2. Microsoft MarkItDown converts it to structured Markdown
3. Mistral Large evaluates it against the active JD
4. View score, breakdown, questions, and improvement advice

### Paste a Job Description from Any Platform
1. Click **"View / Edit JD"** in the header
2. Click **"Paste JD"** tab
3. Paste the full job description text from LinkedIn, Indeed, etc.
4. Click **"Parse & Apply JD"** — auto-extracted into structured fields
5. Review in Edit tab and click **"Save Job Description"**

### Switch AI Model
- Use the **model selector dropdown** in the header
- Switching resets all cached evaluations

---

## 📊 Scoring Criteria Write-Up

### Why These 5 Dimensions?
Careem's Senior Backend Engineer role requires a very specific combination of skills. The 5 dimensions were chosen to reflect what Careem's engineering leadership actually evaluates in technical interviews:

1. **Python & Frameworks (25%)** — The role is Python-first. FastAPI is their primary framework. Fluency here is non-negotiable.

2. **System Design (25%)** — Careem processes millions of bookings daily. Candidates must understand distributed systems, microservices, event-driven architecture, and concurrency at scale.

3. **Real-time & Databases (20%)** — Real-time vehicle matching requires WebSockets and Redis pub/sub. PostgreSQL with proper locking prevents double-booking. These are daily realities on the team.

4. **Cloud & DevOps (15%)** — All services run on AWS with Kubernetes. Docker fluency is expected of all senior engineers.

5. **Domain Fit (15%)** — Ride-hailing has unique constraints (geospatial indexing, surge pricing, dynamic routing). Prior experience dramatically reduces ramp-up time.

### Score Thresholds
| Threshold | Status | Action |
|-----------|--------|--------|
| ≥ 80 | 🟢 Shortlisted | Forward to hiring manager |
| 50–79 | 🟡 Under Review | Phone screen first |
| < 50 | 🔴 Rejected | Does not meet minimum bar |

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **AI / LLM** | Mistral Large (`mistral-large-latest`) | Resume scoring, question generation, improvement analysis |
| **AI Vision** | Pixtral (`pixtral-12b-2409`) | Image / screenshot resume text extraction |
| **AI / LLM Alt** | Groq Llama 3.3 70B | Fast inference alternative |
| **Document Parsing** | pypdf | Fast PDF text extraction |
| **Backend** | FastAPI + Uvicorn | REST API server |
| **Data Validation** | Pydantic v2 | Schema validation & settings |
| **HTTP Client** | httpx | Async HTTP calls to Mistral API |
| **Frontend** | Vanilla HTML5/CSS3/JS | No framework needed |
| **Icons** | Lucide Icons | Premium icon set |
| **Fonts** | Inter + Outfit (Google) | Modern typography |
| **Testing** | pytest | 7 automated unit tests |
| **Containerization** | Docker | Deployment-ready image |

---

## 📦 Pre-loaded Sample Candidates

| Candidate | Profile | Expected Status |
|-----------|---------|----------------|
| **Anas Khan** | 7yr Senior Python/FastAPI at Careem | Shortlisted (~90%) |
| **Sarah Jenkins** | Google SWE, distributed systems | Shortlisted (~85%) |
| **David Chen** | Uber ride-matching engineer | Shortlisted (~88%) |
| **Emily Rodriguez** | Mid-level Django dev | Under Review (~65%) |
| **Michael Chang** | ML Engineer, less backend | Under Review (~58%) |
| **Amara Al-Fayed** | Junior dev, 2yr exp | Rejected (~35%) |

---

## 📁 Submission Deliverables

| Deliverable | Status |
|-------------|--------|
| ✅ Working prototype with 6 scored resumes | Complete |
| ✅ Sample generated interview questions | Complete (5 per candidate) |
| ✅ Short write-up on scoring criteria | See above section |
| ✅ Resume improvement suggestions | New in v2.0 |
| ✅ Editable Job Description system | New in v2.0 |
| ✅ Custom resume upload (PDF/MD/TXT/JPG/PNG) | Complete |
| ✅ GitHub Repository | Committed with individual file commits |
| ✅ README with full documentation | This document |

---

## 📜 License

This project was built for educational purposes as part of the **SafeX Internship Program, Week 3**.

---

*Made with ❤️ by Maaz Ali | Careem AI Talent Advisor v2.0 | 2026*
