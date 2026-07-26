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

    DEFAULT_CAREEM_JD = {
        "title": "Senior Backend Engineer (Python) - Ride Matching & Dispatch Team",
        "company": "Careem",
        "department": "Ride Hailing Core",
        "location": "Dubai, UAE (Remote Friendly)",
        "description": "Careem is looking for a Senior Backend Engineer to join our Core Matching & Dispatch Team. In this role, you will design, build, and optimize high-throughput, low-latency backend systems and APIs that power our real-time vehicle matching, dynamic surge pricing, and driver routing algorithms. You will work on distributed state machines processing millions of concurrent bookings daily, ensuring system availability, sub-second latency, and horizontal scalability.",
        "requirements": [
            "5+ years of production experience designing and building scalable backend systems in Python.",
            "Strong proficiency in modern Python frameworks such as FastAPI, Django, or Flask.",
            "Deep understanding of microservices architecture, event-driven design, and API patterns (REST, gRPC, WebSockets).",
            "Hands-on experience with relational databases (PostgreSQL), data modeling, and caching mechanisms (Redis).",
            "Experience with message brokers and event streaming networks (Apache Kafka, RabbitMQ).",
            "Familiarity with cloud infrastructures (AWS), Docker, and Kubernetes deployment workflows.",
            "Proven track record of optimizing systems for high concurrency, distributed locking, and microsecond latencies."
        ],
        "preferred_qualifications": [
            "Prior experience working in ride-hailing, delivery, logistics, or last-mile transit companies.",
            "Knowledge of Go or Java for cross-service development and integration.",
            "Familiarity with geospatial index libraries (Uber H3, Google S2) or PostGIS for location-based query optimization."
        ]
    }

    def load_job_description(self) -> Dict[str, Any]:
        """Loads the active Job Description from JSON."""
        if not os.path.exists(self.jd_path):
            self.save_job_description(self.DEFAULT_CAREEM_JD)
            return self.DEFAULT_CAREEM_JD
        with open(self.jd_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_job_description(self, jd_data: Dict[str, Any]) -> Dict[str, Any]:
        """Saves updated Job Description data to disk."""
        os.makedirs(os.path.dirname(self.jd_path), exist_ok=True)
        with open(self.jd_path, "w", encoding="utf-8") as f:
            json.dump(jd_data, f, indent=2)
        return jd_data

    def reset_job_description(self) -> Dict[str, Any]:
        """Resets the Job Description back to the default Careem JD."""
        return self.save_job_description(self.DEFAULT_CAREEM_JD)

    def normalize_resume_to_markdown(self, raw_text: str, file_path: Optional[str] = None) -> str:
        """Converts raw extracted resume text or file into clean Markdown structure using Microsoft MarkItDown."""
        if file_path and os.path.exists(file_path):
            try:
                from markitdown import MarkItDown
                md_converter = MarkItDown()
                result = md_converter.convert(file_path)
                if result and result.text_content and result.text_content.strip():
                    return result.text_content.strip()
            except Exception as e:
                logger.warning(f"MarkItDown conversion failed for {file_path}: {e}")

        if not raw_text or not raw_text.strip():
            return "# Empty Resume\n\nNo content extracted."

        # If it already contains markdown headers, return clean text
        if raw_text.strip().startswith("#") or "\n## " in raw_text:
            return raw_text.strip()

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return "# Resume\n\n" + raw_text

        # First non-empty line as Candidate Name Header
        markdown = f"# {lines[0].replace('#', '').strip()}\n\n"
        
        # Format key sections with markdown headers
        section_headers = ["SUMMARY", "EXPERIENCE", "WORK EXPERIENCE", "EDUCATION", "SKILLS", "TECHNICAL SKILLS", "PROJECTS", "CERTIFICATIONS"]
        
        body_lines = lines[1:]
        for line in body_lines:
            upper_line = line.upper().replace(":", "").strip()
            if any(upper_line == sec or upper_line.startswith(sec) for sec in section_headers):
                markdown += f"\n## {line.replace(':', '').title()}\n\n"
            elif line.startswith(("-", "*", "•")):
                clean_bullet = line.lstrip("-*• ").strip()
                markdown += f"- {clean_bullet}\n"
            else:
                markdown += f"{line}\n\n"

        return markdown.strip()


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
        # Convert/normalize resume content into clean Markdown format
        markdown_content = self.normalize_resume_to_markdown(resume_content)
        
        job_desc = self.load_job_description()
        evaluation = llm_service.screen_resume(job_desc, markdown_content)
        
        # Deduce candidate name from resume text
        candidate_name = llm_service._infer_candidate_name(markdown_content)
        candidate_id = "custom_" + file_name.lower().replace(" ", "_").replace(".pdf", "").replace(".txt", "").replace(".md", "")
        
        # Save the custom resume to the resumes directory so it can be retrieved and listed
        try:
            os.makedirs(self.resumes_dir, exist_ok=True)
            # Clean candidate_id to be a valid file name
            safe_id = "".join([c for c in candidate_id if c.isalnum() or c in ("_", "-")])
            custom_file_path = os.path.join(self.resumes_dir, f"{safe_id}.txt")
            with open(custom_file_path, "w", encoding="utf-8") as f:
                f.write(markdown_content)
            candidate_id = safe_id
        except Exception as e:
            logger.error(f"Failed to save custom resume {candidate_id} to disk: {e}")

        evaluation["candidate_id"] = candidate_id
        evaluation["candidate_name"] = candidate_name
        evaluation["evaluation_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        return evaluation

resume_service = ResumeService()
