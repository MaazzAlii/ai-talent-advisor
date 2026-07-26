import os
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.schemas.api_schemas import JobDescription, EvaluationResult
from app.services.resume_service import resume_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Careem AI Resume Screener & Interview Assistant API",
    description="Backend API for evaluation of candidates against Careem's Senior Backend Engineer JD.",
    version="1.0.0"
)

# CORS middleware config for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/jd", response_model=JobDescription)
def get_job_description():
    """Gets the target Job Description for Careem."""
    try:
        return resume_service.load_job_description()
    except Exception as e:
        logger.error(f"Error loading Job Description: {e}")
        raise HTTPException(status_code=500, detail="Failed to load Job Description.")

@app.get("/api/candidates")
def list_candidates():
    """Lists preloaded resumes from the resumes directory."""
    try:
        return resume_service.list_resumes()
    except Exception as e:
        logger.error(f"Error listing resumes: {e}")
        raise HTTPException(status_code=500, detail="Failed to list resumes.")

@app.get("/api/candidates/{candidate_id}")
def get_candidate_resume(candidate_id: str):
    """Retrieves original resume content of a candidate."""
    try:
        content = resume_service.get_resume_content(candidate_id)
        return {"id": candidate_id, "content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate resume not found.")
    except Exception as e:
        logger.error(f"Error reading candidate resume: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve resume.")

@app.post("/api/screen/{candidate_id}", response_model=EvaluationResult)
def screen_candidate(candidate_id: str):
    """Screens a pre-loaded candidate against the Careem Job Description."""
    try:
        result = resume_service.screen_candidate(candidate_id)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    except Exception as e:
        logger.error(f"Error screening candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")

@app.post("/api/screen-custom", response_model=EvaluationResult)
async def screen_custom_resume(file: UploadFile = File(...)):
    """Screens an uploaded PDF or Text resume against the Careem Job Description."""
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
        
    ext = os.path.splitext(filename)[1].lower()
    
    try:
        file_bytes = await file.read()
        
        if ext == ".pdf":
            resume_content = resume_service.parse_pdf(file_bytes)
        elif ext in [".txt", ".md"]:
            resume_content = file_bytes.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF, TXT or MD file.")
            
        if not resume_content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")
            
        result = resume_service.screen_custom_resume(filename, resume_content)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing custom resume upload: {e}")
        raise HTTPException(status_code=500, detail=f"Custom screening failed: {str(e)}")

# Mount the static files router to serve the front-end application
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    logger.info("Serving frontend static assets from 'frontend' directory.")
else:
    logger.warning("Frontend directory not found. Static files serving disabled.")
