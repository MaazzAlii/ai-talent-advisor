# Careem AI Talent Advisor (Resume Screener & Interview Assistant)

An intelligent recruiting agent prototype tailored for **Careem** that automates the initial screening of backend candidate resumes against a realistic "Senior Backend Engineer (Python) - Ride Matching & Dispatch Team" Job Description.

This prototype scores candidates across 5 key dimensions using the Groq API (running `llama-3.3-70b-versatile`), generates detailed evaluation justifications, and synthesizes 5 custom interview questions tailored to each candidate's background. It features a sleek glassmorphic dark-theme web dashboard.

---

## Key Features

1. **Careem Core JD Alignment:** Preloaded with a realistic job description for a Senior Python Backend Developer in Careem's Ride Hailing Dispatch division.
2. **Deterministic & AI Evaluations:** Utilizes the Groq LLM API to evaluate resumes.
3. **Comprehensive Scoring System:** Scores candidates on 5 core axes (0-5 scale) and computes a weighted average percentage overall score:
   * **Python & Web Frameworks (FastAPI/Django)** [25% weight]
   * **System Design & Microservices Scale** [25% weight]
   * **Real-time APIs & Databases (Redis/Postgres)** [20% weight]
   * **Cloud, Docker & Kubernetes** [15% weight]
   * **Careem Domain Fit (Logistics/Ride-Hailing)** [15% weight]
4. **Tailored Interview Guide:** Generates 5 technical interview questions targeting candidate gaps, system designs, or Careem-specific transport issues.
5. **Interactive Dashboard:** Offers a premium, glassmorphic UI built in vanilla HTML/CSS/JS with smooth transitions, progress bars, and score-color highlighting.
6. **Custom Resume Uploads:** Allows recruiters to upload custom `.pdf`, `.md`, or `.txt` resumes for real-time AI parsing and screening.
7. **Preloaded Candidates:** Includes 6 mock profiles modeling perfect, partial, and poor matches (Anas Khan, Sarah Jenkins, David Chen, Emily Rodriguez, Michael Chang, Amara Al-Fayed).

---

## Directory Structure

```
├── app/
│   ├── data/
│   │   ├── resumes/               # Preloaded sample resume files (.md)
│   │   └── job_description.json   # Careem Senior Backend Engineer JD
│   ├── schemas/
│   │   └── api_schemas.py         # Pydantic data schemas
│   ├── services/
│   │   ├── llm_service.py         # Groq LLM client & prompting logic
│   │   └── resume_service.py      # Resume listing, parsing, and pipeline orchestration
│   ├── tests/
│   │   └── test_screening.py      # Integration and unit tests
│   ├── config.py                  # Pydantic configuration loader
│   └── main.py                    # FastAPI main routing application
├── frontend/
│   ├── app.js                     # Frontend API integrations & actions
│   ├── index.html                 # Main layout & modal windows
│   └── style.css                  # Modern glassmorphic stylesheet
├── .env                           # Local API keys and configurations
├── .gitignore                     # Git ignore file
├── requirements.txt               # Backend Python dependencies
└── README.md                      # Documentation
```

---

## Installation & Setup

### Prerequisites

* Python 3.10+
* Groq API Key (Fast & Free tier available at [console.groq.com](https://console.groq.com/keys))

### Step-by-Step Local Setup

1. **Clone/Navigate to the directory:**
   ```bash
   cd "Week 3 Tasks"
   ```

2. **Set up a Virtual Environment:**
   ```bash
   python -m venv .venv
   ```

3. **Activate the Virtual Environment:**
   * **Windows (PowerShell):**
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   * **macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```

4. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure Environment Variables:**
   Create a `.env` file in the root directory (one is automatically initialized for you in the workspace):
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   LLM_PROVIDER=groq
   LLM_MODEL=llama-3.3-70b-versatile
   PORT=8000
   ```

---

## How to Run & Verify

### Running the Backend Server

Start the FastAPI application with Uvicorn:
```bash
uvicorn app.main:app --reload --port 8000
```

Once running, you can access:
* **Interactive UI:** Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.
* **Interactive Swagger Documentation:** Visit [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to explore and execute the API endpoints directly.

### Running Automated Tests

Run unit tests via Pytest to check file loading, Pydantic schemas, and calculations:
```bash
pytest
```
*(Make sure your virtual environment is active)*

---

## Scoring Criteria & Formula

The candidate's overall score (weighted average percentage out of 100) is calculated based on the following formula:

$$\text{Overall Score} = (S_{\text{backend}} \times 0.25 + S_{\text{design}} \times 0.25 + S_{\text{db}} \times 0.20 + S_{\text{devops}} \times 0.15 + S_{\text{domain}} \times 0.15) \times 20$$

Where each dimensional score ($S_i$) is an integer between $0$ and $5$.

### Score Statuses

* **Shortlisted (Green):** Overall Score $\ge 80$. High technical alignment and domain fit. Direct path to hiring manager review.
* **Under Review (Orange):** $50 \le \text{Overall Score} < 80$. Minor gaps in frameworks or architecture, but strong fundamentals. Ideal for a preliminary phone screen.
* **Rejected (Red):** Overall Score $< 50$. Significant mismatch in core language or architecture requirements.
