import os
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.schemas.api_schemas import JobDescription, EvaluationResult, ImprovementResult
from app.services.resume_service import resume_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Careem AI Talent Advisor API",
    description="AI-powered resume screening and interview assistant for Careem's engineering team.",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────── Supported file types ───────────────────────
SUPPORTED_TEXT = {".pdf", ".txt", ".md"}
SUPPORTED_IMAGE = {".jpg", ".jpeg", ".png"}
MIME_MAP = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}

# ─────────────────────── Job Description Endpoints ───────────────────────

@app.get("/api/jd", response_model=JobDescription)
def get_job_description():
    """Returns the active Job Description."""
    try:
        return resume_service.load_job_description()
    except Exception as e:
        logger.error(f"Error loading JD: {e}")
        raise HTTPException(status_code=500, detail="Failed to load Job Description.")


@app.put("/api/jd", response_model=JobDescription)
def update_job_description(jd: JobDescription):
    """Saves an updated Job Description."""
    try:
        return resume_service.save_job_description(jd.model_dump())
    except Exception as e:
        logger.error(f"Error saving JD: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update JD: {str(e)}")


@app.post("/api/jd/reset", response_model=JobDescription)
def reset_job_description():
    """Resets to the default Careem JD."""
    try:
        return resume_service.reset_job_description()
    except Exception as e:
        logger.error(f"Error resetting JD: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset Job Description.")


# ─────────────────────── LLM Config Endpoints ───────────────────────

@app.get("/api/llm-config")
def get_llm_config():
    """Returns current LLM provider, model, key presence, and available options."""
    return {
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "has_mistral_key": bool(settings.MISTRAL_API_KEY and len(settings.MISTRAL_API_KEY.strip()) > 5),
        "has_groq_key": bool(settings.GROQ_API_KEY and len(settings.GROQ_API_KEY.strip()) > 5),
        "available_providers": [
            {
                "value": "mistral",
                "label": "✦ Mistral AI",
                "default_model": "mistral-large-latest",
                "models": [
                    {"value": "mistral-large-latest", "label": "Mistral Large (Recommended)"},
                    {"value": "mistral-small-latest", "label": "Mistral Small (Fast)"},
                    {"value": "codestral-latest", "label": "Codestral (Code Focused)"},
                    {"value": "pixtral-12b-2409", "label": "Pixtral 12B (Multimodal)"}
                ]
            },
            {
                "value": "groq",
                "label": "⚡ Groq AI",
                "default_model": "llama-3.3-70b-versatile",
                "models": [
                    {"value": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B (Recommended)"},
                    {"value": "llama3-70b-8192", "label": "Llama 3 70B"},
                    {"value": "mixtral-8x7b-32768", "label": "Mixtral 8x7B"}
                ]
            }
        ]
    }


@app.post("/api/llm-config")
def update_llm_config(payload: dict):
    """
    Switches active LLM provider and/or sets custom API keys.
    Accepts: { provider: 'mistral'|'groq', model?: string, mistral_api_key?: string, groq_api_key?: string }
    """
    provider = payload.get("provider")
    model    = payload.get("model")
    mistral_key = payload.get("mistral_api_key")
    groq_key    = payload.get("groq_api_key")

    if not provider:
        raise HTTPException(status_code=400, detail="Provider field is required.")
    try:
        settings.set_api_keys(mistral_key=mistral_key, groq_key=groq_key)
        settings.set_provider(provider, model)
        from app.services.llm_service import llm_service
        llm_service.refresh_config()
        return {
            "status": "success",
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL,
            "has_mistral_key": bool(settings.MISTRAL_API_KEY),
            "has_groq_key": bool(settings.GROQ_API_KEY)
        }
    except Exception as e:
        logger.error(f"Error updating LLM config: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────── Candidate Endpoints ───────────────────────

@app.get("/api/candidates")
def list_candidates():
    """Lists all pre-loaded candidate resumes."""
    try:
        return resume_service.list_resumes()
    except Exception as e:
        logger.error(f"Error listing resumes: {e}")
        raise HTTPException(status_code=500, detail="Failed to list resumes.")


@app.get("/api/candidates/{candidate_id}")
def get_candidate_resume(candidate_id: str):
    """Returns the raw Markdown content of a pre-loaded resume."""
    try:
        content = resume_service.get_resume_content(candidate_id)
        return {"id": candidate_id, "content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate resume not found.")
    except Exception as e:
        logger.error(f"Error reading resume: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve resume.")


# ─────────────────────── Screening Endpoints ───────────────────────

@app.post("/api/screen/{candidate_id}", response_model=EvaluationResult)
def screen_candidate(candidate_id: str):
    """Screens a pre-loaded candidate against the active JD using Mistral Large."""
    try:
        return resume_service.screen_candidate(candidate_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    except Exception as e:
        logger.error(f"Error screening {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")


@app.post("/api/screen-custom", response_model=EvaluationResult)
async def screen_custom_resume(file: UploadFile = File(...)):
    """
    Screens an uploaded resume against the active JD.

    Supported formats:
    - PDF / TXT / MD  → text extracted by pypdf or decoded, then structured by Mistral Large
    - JPG / PNG       → text extracted by Pixtral (Mistral vision model)
    """
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in SUPPORTED_TEXT | SUPPORTED_IMAGE:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Upload PDF, TXT, MD, JPG, or PNG."
        )

    try:
        file_bytes = await file.read()

        if ext in SUPPORTED_IMAGE:
            # ── Image resume → Pixtral vision model ──
            from app.services.llm_service import llm_service
            mime = MIME_MAP[ext]
            resume_content = llm_service.parse_image_resume(file_bytes, mime_type=mime)

        elif ext == ".pdf":
            # ── PDF → pypdf text extraction (fast) → Mistral Large structuring ──
            raw_text = resume_service.extract_text_from_pdf(file_bytes)
            if not raw_text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from PDF. The file may be image-only — try uploading as JPG/PNG.")
            resume_content = resume_service.normalize_resume_text(raw_text)

        else:
            # ── TXT / MD → decode directly ──
            resume_content = file_bytes.decode("utf-8", errors="ignore")
            resume_content = resume_service.normalize_resume_text(resume_content)

        if not resume_content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")

        return resume_service.screen_custom_resume(filename, resume_content)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing custom resume: {e}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")


# ─────────────────────── Improvement Endpoints ───────────────────────

@app.post("/api/improve/{candidate_id}", response_model=ImprovementResult)
def improve_candidate(candidate_id: str):
    """Generates resume improvement suggestions for a pre-loaded candidate."""
    try:
        return resume_service.improve_candidate(candidate_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    except Exception as e:
        logger.error(f"Error generating improvements for {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Improvement analysis failed: {str(e)}")


@app.post("/api/improve-custom", response_model=ImprovementResult)
async def improve_custom_resume(file: UploadFile = File(...)):
    """Generates resume improvement suggestions for an uploaded resume file."""
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in SUPPORTED_TEXT | SUPPORTED_IMAGE:
        raise HTTPException(status_code=400, detail="Unsupported format. Upload PDF, TXT, MD, JPG, or PNG.")

    try:
        file_bytes = await file.read()
        from app.services.llm_service import llm_service

        if ext in SUPPORTED_IMAGE:
            mime = MIME_MAP[ext]
            resume_content = llm_service.parse_image_resume(file_bytes, mime_type=mime)
        elif ext == ".pdf":
            raw_text = resume_service.extract_text_from_pdf(file_bytes)
            resume_content = resume_service.normalize_resume_text(raw_text)
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")
            resume_content = resume_service.normalize_resume_text(raw_text)

        if not resume_content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")

        candidate_name = llm_service._infer_candidate_name(resume_content)
        raw_id = "custom_" + filename.lower().replace(" ", "_")
        for e in list(SUPPORTED_TEXT | SUPPORTED_IMAGE):
            raw_id = raw_id.replace(e, "")
        candidate_id = "".join(c for c in raw_id if c.isalnum() or c in ("_", "-"))

        return resume_service.improve_custom_resume(resume_content, candidate_id, candidate_name)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating custom improvements: {e}")
        raise HTTPException(status_code=500, detail=f"Improvement analysis failed: {str(e)}")


# ─────────────────────── Static Frontend ───────────────────────

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info("Serving frontend from 'frontend/' directory.")
else:
    logger.warning("Frontend directory not found. Static serving disabled.")
