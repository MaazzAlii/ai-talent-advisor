import os
import logging
import tempfile
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
    version="2.0.0"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────── Job Description Endpoints ───────────────

@app.get("/api/jd", response_model=JobDescription)
def get_job_description():
    """Gets the target Job Description."""
    try:
        return resume_service.load_job_description()
    except Exception as e:
        logger.error(f"Error loading Job Description: {e}")
        raise HTTPException(status_code=500, detail="Failed to load Job Description.")


@app.put("/api/jd", response_model=JobDescription)
def update_job_description(jd: JobDescription):
    """Updates the active Job Description."""
    try:
        return resume_service.save_job_description(jd.model_dump())
    except Exception as e:
        logger.error(f"Error saving Job Description: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update Job Description: {str(e)}")


@app.post("/api/jd/reset", response_model=JobDescription)
def reset_job_description():
    """Resets the Job Description back to the default Careem JD."""
    try:
        return resume_service.reset_job_description()
    except Exception as e:
        logger.error(f"Error resetting Job Description: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset Job Description.")


# ─────────────── LLM Config Endpoints ───────────────

@app.get("/api/llm-config")
def get_llm_config():
    """Gets current LLM provider and model."""
    return {
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "available_providers": [
            {"value": "mistral", "label": "Mistral Large (Best Quality)", "model": "mistral-large-latest"},
            {"value": "groq", "label": "Groq Llama 3.3 70B (Fast)", "model": "llama-3.3-70b-versatile"},
        ]
    }


@app.post("/api/llm-config")
def update_llm_config(payload: dict):
    """Switches active LLM provider ('groq' or 'mistral')."""
    provider = payload.get("provider")
    model = payload.get("model")
    if not provider:
        raise HTTPException(status_code=400, detail="Provider field is required.")
    try:
        settings.set_provider(provider, model)
        from app.services.llm_service import llm_service
        llm_service.__init__()
        return {
            "status": "success",
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL
        }
    except Exception as e:
        logger.error(f"Error changing LLM provider: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────── Candidate Endpoints ───────────────

@app.get("/api/candidates")
def list_candidates():
    """Lists all available resumes."""
    try:
        return resume_service.list_resumes()
    except Exception as e:
        logger.error(f"Error listing resumes: {e}")
        raise HTTPException(status_code=500, detail="Failed to list resumes.")


@app.get("/api/candidates/{candidate_id}")
def get_candidate_resume(candidate_id: str):
    """Retrieves the raw resume content of a candidate."""
    try:
        content = resume_service.get_resume_content(candidate_id)
        return {"id": candidate_id, "content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate resume not found.")
    except Exception as e:
        logger.error(f"Error reading candidate resume: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve resume.")


# ─────────────── Screening Endpoints ───────────────

@app.post("/api/screen/{candidate_id}", response_model=EvaluationResult)
def screen_candidate(candidate_id: str):
    """Screens a pre-loaded candidate against the active Job Description."""
    try:
        return resume_service.screen_candidate(candidate_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    except Exception as e:
        logger.error(f"Error screening candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")


@app.post("/api/screen-custom", response_model=EvaluationResult)
async def screen_custom_resume(file: UploadFile = File(...)):
    """Screens an uploaded PDF, TXT, or MD resume using Microsoft MarkItDown for conversion."""
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Upload PDF, TXT, or MD.")

    try:
        file_bytes = await file.read()

        # Save to temp file so MarkItDown can access it by path
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            if ext == ".pdf":
                # Use MarkItDown for PDF → Markdown conversion
                resume_content = resume_service.normalize_resume_to_markdown("", file_path=tmp_path)
                if not resume_content or resume_content.startswith("# Empty"):
                    # Fallback to pypdf
                    resume_content = resume_service.parse_pdf(file_bytes)
            else:
                resume_content = file_bytes.decode("utf-8", errors="ignore")
        finally:
            os.unlink(tmp_path)

        if not resume_content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")

        result = resume_service.screen_custom_resume(filename, resume_content)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing custom resume upload: {e}")
        raise HTTPException(status_code=500, detail=f"Custom screening failed: {str(e)}")


# ─────────────── Improvement Endpoints ───────────────

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
    """Generates improvement suggestions for an uploaded resume."""
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Upload PDF, TXT, or MD.")

    try:
        file_bytes = await file.read()

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            if ext == ".pdf":
                resume_content = resume_service.normalize_resume_to_markdown("", file_path=tmp_path)
                if not resume_content or resume_content.startswith("# Empty"):
                    resume_content = resume_service.parse_pdf(file_bytes)
            else:
                resume_content = file_bytes.decode("utf-8", errors="ignore")
        finally:
            os.unlink(tmp_path)

        if not resume_content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")

        from app.services.llm_service import llm_service
        candidate_name = llm_service._infer_candidate_name(resume_content)
        candidate_id = "custom_" + filename.lower().replace(" ", "_").replace(ext, "")
        safe_id = "".join([c for c in candidate_id if c.isalnum() or c in ("_", "-")])

        result = resume_service.improve_custom_resume(resume_content, safe_id, candidate_name)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating custom improvement: {e}")
        raise HTTPException(status_code=500, detail=f"Improvement analysis failed: {str(e)}")


# ─────────────── Static Frontend ───────────────

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info("Serving frontend from 'frontend/' directory.")
else:
    logger.warning("Frontend directory not found. Static serving disabled.")
