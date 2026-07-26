# Careem AI Talent Advisor (Resume Screener & Interview Assistant)

An intelligent recruiting agent prototype tailored for **Careem** and custom enterprise hiring pipelines that automates candidate resume screening, dimensional suitability scoring, and technical interview question generation.

---

## Key Features

1. **Editable Job Description System:**
   - Preloaded with Careem's "Senior Backend Engineer (Python) - Ride Matching & Dispatch Team" Job Description.
   - Includes a full **View / Edit Job Description Modal** allowing recruiters to modify role titles, company names, core requirements, and responsibilities, or paste custom JDs from any job site (LinkedIn, Indeed, etc.) on-the-fly.
   - Supports instant **Reset to Default Careem JD**.

2. **Dual LLM Provider Support (Groq & Mistral AI):**
   - Toggle seamlessly between **Groq (Llama 3.3 70B Versatile)** and **Mistral AI (Mistral Small / Large)** using the header Model Selector dropdown or environment configuration.

3. **Microsoft MarkItDown Resume Conversion:**
   - Integrates Microsoft's official **MarkItDown** document conversion library to transform `.pdf`, `.docx`, `.md`, and `.txt` candidate resumes into clean, structured Markdown.
   - Boosts LLM dimensional scoring precision and renders clear Markdown source text in the candidate dashboard viewer tab.

4. **5-Dimensional Scoring Model:**
   - Evaluates candidates on a 0-5 scale across 5 core dimensions:
     - **Python & Web Frameworks (FastAPI/Django)** [25% weight]
     - **System Design & Microservices Scale** [25% weight]
     - **Real-time APIs & Databases (Redis/Postgres)** [20% weight]
     - **Cloud, Docker & Kubernetes** [15% weight]
     - **Domain Fit (Logistics/Ride-Hailing)** [15% weight]

5. **Tailored Technical Interview Questions:**
   - Generates 5 customized technical interview questions addressing candidate gaps, system designs, or transport-domain scenarios.

6. **Glassmorphic Web Dashboard:**
   - Dark-theme UI built with Vanilla HTML5, CSS3, and JavaScript featuring circular progress charts, dimension progress bars, and score-color highlighting.

---

## Directory Structure

```
├── careem-ai-talent-advisor/
│   ├── app/
│   │   ├── data/
│   │   │   ├── resumes/               # Preloaded & custom uploaded resumes (.md / .txt)
│   │   │   └── job_description.json   # Target Job Description
│   │   ├── schemas/
│   │   │   └── api_schemas.py         # Pydantic API data schemas
│   │   ├── services/
│   │   │   ├── llm_service.py         # Groq & Mistral AI provider integration
│   │   │   └── resume_service.py      # Resume parsing, MarkItDown, & JD management
│   │   ├── tests/
│   │   │   └── test_screening.py      # Pytest automated test suite
│   │   ├── config.py                  # Pydantic settings & LLM provider manager
│   │   └── main.py                    # FastAPI routing application
│   ├── frontend/
│   │   ├── app.js                     # Frontend API integrations & UI actions
│   │   ├── index.html                 # Main layout & View/Edit JD modal
│   │   └── style.css                  # Modern glassmorphic stylesheet
│   ├── .env                           # Local API keys & provider config
│   ├── .env.example                   # Environment variable template
│   ├── .gitignore                     # Git ignore rules
│   ├── requirements.txt               # Backend Python dependencies
│   └── README.md                      # Documentation
```

---

## Installation & Setup

### Prerequisites

* Python 3.10+
* Groq API Key ([console.groq.com](https://console.groq.com/keys))
* Mistral AI API Key ([console.mistral.ai](https://console.mistral.ai/keys))

### Setup Instructions

1. **Navigate to project directory:**
   ```bash
   cd careem-ai-talent-advisor
   ```

2. **Set up virtual environment:**
   ```bash
   python -m venv ..\.venv
   ```

3. **Activate virtual environment:**
   - **Windows (PowerShell):**
     ```powershell
     ..\.venv\Scripts\Activate.ps1
     ```
   - **macOS/Linux:**
     ```bash
     source ../.venv/bin/activate
     ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure `.env` file:**
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   MISTRAL_API_KEY=your_mistral_api_key_here
   LLM_PROVIDER=groq
   LLM_MODEL=llama-3.3-70b-versatile
   PORT=8000
   ```

---

## Running the Application

### Launch FastAPI Server

```bash
python -m uvicorn app.main:app --port 8000
```

- **Interactive UI:** Open [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Docs (Swagger):** Visit [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Run Unit Tests

```bash
python -m pytest app/tests
```

---

## Scoring Formula

$$\text{Overall Score} = (S_{\text{backend}} \times 0.25 + S_{\text{design}} \times 0.25 + S_{\text{db}} \times 0.20 + S_{\text{devops}} \times 0.15 + S_{\text{domain}} \times 0.15) \times 20$$

- **Shortlisted (Green):** Score $\ge 80$
- **Under Review (Orange):** $50 \le \text{Score} < 80$
- **Rejected (Red):** Score $< 50$

---

## Acknowledgments & Credits

We explicitly credit and acknowledge **Microsoft's MarkItDown** project for document-to-markdown conversion capabilities:

* **Microsoft MarkItDown Repository:** [https://github.com/microsoft/markitdown](https://github.com/microsoft/markitdown)
* **License:** MIT License by Microsoft Corporation.
