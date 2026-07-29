# Careem AI Talent Advisor — Resume Screener & Interview Assistant

An AI recruiting agent that screens candidate resumes against a job description, scores them across 5 weighted dimensions, drafts 5 tailored interview questions per candidate, and — separately — gives the candidate concrete feedback on how to improve their resume for that specific role.

Built for the AI & ML Department "Resume Screening & Interview Assistant" assignment (Group 56), targeting **Careem** as the example company.

> 📄 See [`SCORING_CRITERIA.md`](./SCORING_CRITERIA.md) for the full scoring methodology write-up (a required deliverable).

---

## Key features

1. **Editable Job Description** — preloaded with Careem's "Senior Backend Engineer" JD, but fully editable/replaceable in the UI (paste any real JD from LinkedIn/Indeed) with one-click reset to the Careem default.
2. **Dual LLM provider, switchable live** — Groq (`openai/gpt-oss-120b`) or Mistral AI (`mistral-large-latest`), toggled from the header dropdown with no restart needed.
3. **Fast resume ingestion via Mistral OCR** — PDF/PNG/JPG go straight to Mistral's dedicated OCR API (`mistral-ocr-latest`) in a single call; DOCX is parsed locally with `python-docx`.
4. **Image resume support** — upload a photo/scan/screenshot of a resume (PNG/JPG) and it's OCR'd to Markdown before scoring.
5. **5-dimension weighted scoring** with per-dimension justifications, an overall 0–100 score, and a Shortlisted / Under Review / Rejected status.
6. **5 tailored interview questions** per candidate, targeted at that candidate's specific apparent gaps.
7. **Resume improvement suggestions** — a separate AI pass that surfaces strengths, concrete gaps with rewrite suggestions, missing JD keywords, and things that are already fine as-is.
8. **Select / deselect candidates** for batch screening — check individual candidates (or "select all") and screen only that subset, or screen everyone at once.

---

## ⚠️ Before you do anything else: rotate your API keys

This repo's `.env` is excluded from git via `.gitignore`, but if you've shared this project folder (zip, chat, screen share, etc.) with anyone or any tool, **treat the keys inside it as already exposed** and rotate them:

- Groq: https://console.groq.com/keys
- Mistral: https://console.mistral.ai/api-keys

Then paste the new keys into your local `.env`. Never commit `.env` to GitHub.

---

## Project structure

```
careem-ai-talent-advisor/
├── app/
│   ├── main.py                  # FastAPI routes
│   ├── config.py                # Settings (.env-driven)
│   ├── schemas/api_schemas.py   # Pydantic request/response models
│   ├── services/
│   │   ├── llm_service.py       # Scoring + feedback prompts, Groq/Mistral calls
│   │   └── resume_service.py    # JD storage, resume conversion (Mistral OCR + python-docx)
│   ├── data/
│   │   ├── job_description.json # Active JD (editable via the UI)
│   │   └── resumes/             # Sample + uploaded resumes (.md)
│   └── tests/test_screening.py
├── frontend/                    # Vanilla HTML/CSS/JS UI (served as static files by FastAPI)
├── ai_agent_proposal.md         # Original assignment brief
├── SCORING_CRITERIA.md          # Scoring methodology write-up (deliverable)
├── pdf_converter_ui.py          # Optional standalone Streamlit resume-to-Markdown demo tool
├── install-readme.md            # Setup notes for the standalone Streamlit tool above
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## Setup (local, step-by-step)

### 1. Prerequisites
- Python 3.11+
- A Groq API key (free tier available) and/or a Mistral API key

### 2. Clone/open the project and create a virtual environment
```bash
cd careem-ai-talent-advisor
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
```bash
cp .env.example .env    # Windows: copy .env.example .env
```
Then edit `.env` and fill in `GROQ_API_KEY` and/or `MISTRAL_API_KEY`.

> Set **both** keys if you can — `MISTRAL_API_KEY` is used for image-resume OCR regardless of which provider (`LLM_PROVIDER`) you have selected for scoring.

### 5. Run the app
```bash
uvicorn app.main:app --reload --port 8000
```
Open **http://localhost:8000** in your browser. The FastAPI backend serves the frontend directly — no separate frontend server needed.

### 6. Run tests (optional)
```bash
pytest app/tests/
```

---

## Running with Docker

```bash
docker build -t careem-talent-advisor .
docker run -p 8000:8000 --env-file .env careem-talent-advisor
```
Open **http://localhost:8000**.

Note: this container's filesystem is ephemeral — uploaded/screened resumes and JD edits are lost when the container is removed. For anything beyond a local demo, mount a volume at `/app/app/data`.

---

## How to use it

1. **Set the target JD** — click **View / Edit JD** in the header. Paste in a real job description (or keep the Careem default) and save. Use **Reset to Default Careem JD** to go back.
2. **Screen the sample candidates** — click a candidate in the sidebar to screen them individually, or use **Screen All**. Check the boxes next to specific candidates and click **Screen Selected** to screen just that subset.
3. **Upload your own resume** — drag & drop (or browse) a PDF, DOCX, PPTX, XLSX, PNG/JPG photo, TXT, or MD file into the upload card. It's converted to Markdown, saved, and scored automatically.
4. **Read the results** — the **Assessment Summary** tab shows the 5-dimension breakdown with justifications; **Interview Guide** shows the 5 tailored questions; **Improve Resume** (click "Generate Suggestions") gives you strengths/gaps/rewrite tips/missing keywords; **Original Resume** shows the converted Markdown source.
5. **Switch AI models** anytime from the header dropdown — Groq and Mistral give independent scores, useful for sanity-checking a borderline candidate against a second model.

---

## Architecture notes / what changed from the original prototype

If you're comparing this against an earlier version of the project:

- The entire **Microsoft MarkItDown source repo was previously vendored** into `packages/` (hundreds of files, plus its own README/LICENSE/Dockerfile/devcontainer), and even after cleanup it was still noticeably slow to run per-file. It has been **removed entirely**. PDF/PNG/JPG resumes now go straight to **Mistral's OCR API** (`mistral-ocr-latest`, one fast HTTP call), and DOCX is parsed locally with `python-docx` (no API call needed since DOCX already has a text layer).
- The old **`Dockerfile` was actually MarkItDown's own Dockerfile** (`ENTRYPOINT ["markitdown"]`), so `docker build`/`docker run` never actually started the FastAPI app. It's now a real Dockerfile for this app.
- The original PDF path was **imported but never actually invoked correctly** for uploaded resumes, so PDFs were silently falling back to raw `pypdf` text extraction with no structure. This is now fixed via the direct Mistral OCR call described above, with a `pypdf`-based local fallback if OCR fails or no key is configured.
- Model defaults were bumped from small/lightweight tiers to full-size flagship models (`openai/gpt-oss-120b` on Groq, `mistral-large-latest` on Mistral) for stronger scoring/justification quality.
- Added: image-resume upload/OCR, the "Improve Resume" feedback feature and its `/api/feedback/{candidate_id}` endpoint, and select/deselect + "Screen Selected" batch controls.

---

## API reference (quick)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/jd` | Get the active Job Description |
| PUT | `/api/jd` | Update the Job Description |
| POST | `/api/jd/reset` | Reset JD to the default Careem posting |
| GET | `/api/llm-config` | Get the active provider/model |
| POST | `/api/llm-config` | Switch provider/model |
| GET | `/api/candidates` | List all resumes (sample + uploaded) |
| GET | `/api/candidates/{id}` | Get a candidate's raw Markdown resume |
| POST | `/api/screen/{id}` | Score a candidate against the active JD |
| POST | `/api/screen-custom` | Upload + convert + score a new resume |
| POST | `/api/feedback/{id}` | Generate resume-improvement suggestions |

---

## Deliverables checklist (for submission)

- ✅ Working prototype with 6 sample resumes (see `app/data/resumes/`) + your own uploadable resume
- ✅ Sample generated interview questions (visible per-candidate in the **Interview Guide** tab)
- ✅ Scoring criteria write-up — [`SCORING_CRITERIA.md`](./SCORING_CRITERIA.md)
- ⬜ Weekly Progress Report (PDF) — not included here, write up separately
- ⬜ Daily Work Log — not included here
- ⬜ Demo video / presentation slides — not included here

---

## Known limitations

- LLM scoring is probabilistic — re-screening the same resume can shift scores slightly. See `SCORING_CRITERIA.md` §8 for more on this and other limitations (no bias auditing yet, mock fallback on API failure, etc).
- No authentication/authorization — this is a local prototype, not meant to be exposed publicly as-is.
- CORS is wide open (`allow_origins=["*"]`) for local development convenience; lock this down before any real deployment.
