import os
import json
import logging
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from app.config import settings
from app.schemas.api_schemas import ResumeProfile, JobDescription, EvaluationResult
from app.services.llm_service import llm_service
from datetime import datetime

logger = logging.getLogger(__name__)

class ResumeService:
    def __init__(self):
        self.resumes_dir = os.path.join("app", "data", "resumes")
        self.jd_path = os.path.join("app", "data", "job_description.json")

    def load_job_description(self) -> Dict[str, Any]:
        """Loads the Careem Job Description from JSON."""
        if not os.path.exists(self.jd_path):
            raise FileNotFoundError(f"Job Description file not found at {self.jd_path}")
        with open(self.jd_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_resumes(self) -> List[Dict[str, str]]:
        """Lists preloaded resumes with basic metadata."""
        resumes = []
        if not os.path.exists(self.resumes_dir):
            return resumes

        for file_name in os.listdir(self.resumes_dir):
            if file_name.endswith((".md", ".txt")):
                file_path = os.path.join(self.resumes_dir, file_name)
                candidate_id = os.path.splitext(file_name)[0]
                
                # Infer name from filename
                name = candidate_id.replace("_", " ").title()
                
                resumes.append({
                    "id": candidate_id,
                    "name": name,
                    "file_name": file_name,
                    "file_type": "markdown"
                })
        return resumes

    def get_resume_content(self, candidate_id: str) -> str:
        """Gets content of a preloaded resume by candidate ID."""
        for file_name in os.listdir(self.resumes_dir):
            if os.path.splitext(file_name)[0] == candidate_id:
                file_path = os.path.join(self.resumes_dir, file_name)
                with open(file_path, "r", encoding="utf-8") as f:
                    return f.read()
        raise FileNotFoundError(f"Candidate resume not found for ID: {candidate_id}")

    def parse_pdf(self, file_bytes: bytes) -> str:
        """Parses text from binary PDF data."""
        try:
            from io import BytesIO
            reader = PdfReader(BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error parsing PDF file: {e}")
            raise ValueError(f"Failed to parse PDF: {str(e)}")

    def screen_candidate(self, candidate_id: str) -> Dict[str, Any]:
        """Screens a preloaded candidate resume against the Job Description."""
        job_desc = self.load_job_description()
        resume_text = self.get_resume_content(candidate_id)
        
        evaluation = llm_service.screen_resume(job_desc, resume_text)
        
        # Add metadata
        evaluation["candidate_id"] = candidate_id
        evaluation["candidate_name"] = candidate_id.replace("_", " ").title()
        evaluation["evaluation_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        return evaluation

    def screen_custom_resume(self, file_name: str, resume_content: str) -> Dict[str, Any]:
        """Screens a custom uploaded resume content against the Job Description."""
        job_desc = self.load_job_description()
        evaluation = llm_service.screen_resume(job_desc, resume_content)
        
        # Deduce candidate name from resume text
        candidate_name = llm_service._infer_candidate_name(resume_content)
        candidate_id = "custom_" + file_name.lower().replace(" ", "_").replace(".pdf", "").replace(".txt", "").replace(".md", "")
        
        # Save the custom resume to the resumes directory so it can be retrieved and listed
        try:
            os.makedirs(self.resumes_dir, exist_ok=True)
            # Clean candidate_id to be a valid file name
            safe_id = "".join([c for c in candidate_id if c.isalnum() or c in ("_", "-")])
            custom_file_path = os.path.join(self.resumes_dir, f"{safe_id}.txt")
            with open(custom_file_path, "w", encoding="utf-8") as f:
                f.write(resume_content)
            candidate_id = safe_id
        except Exception as e:
            logger.error(f"Failed to save custom resume {candidate_id} to disk: {e}")

        evaluation["candidate_id"] = candidate_id
        evaluation["candidate_name"] = candidate_name
        evaluation["evaluation_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        return evaluation

resume_service = ResumeService()
