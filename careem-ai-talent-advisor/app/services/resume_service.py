import os
import json
import logging
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from io import BytesIO
from app.config import settings
from app.schemas.api_schemas import ResumeProfile, JobDescription, EvaluationResult
from app.services.llm_service import llm_service
from datetime import datetime

logger = logging.getLogger(__name__)


class ResumeService:
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.resumes_dir = os.path.join(base_dir, "data", "resumes")
        self.jd_path = os.path.join(base_dir, "data", "job_description.json")


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

    # ─────────────────────── Job Description ───────────────────────

    def load_job_description(self) -> Dict[str, Any]:
        """Loads the active Job Description from JSON file."""
        if not os.path.exists(self.jd_path):
            self.save_job_description(self.DEFAULT_CAREEM_JD)
            return self.DEFAULT_CAREEM_JD
        with open(self.jd_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_job_description(self, jd_data: Dict[str, Any]) -> Dict[str, Any]:
        """Persists updated Job Description data to disk."""
        os.makedirs(os.path.dirname(self.jd_path), exist_ok=True)
        with open(self.jd_path, "w", encoding="utf-8") as f:
            json.dump(jd_data, f, indent=2)
        return jd_data

    def reset_job_description(self) -> Dict[str, Any]:
        """Resets Job Description back to the default Careem JD."""
        return self.save_job_description(self.DEFAULT_CAREEM_JD)

    # ─────────────────────── Document Parsing ───────────────────────

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """
        Extracts raw text from a PDF using pypdf (fast, no external API needed).
        Returns the combined text of all pages.
        """
        try:
            reader = PdfReader(BytesIO(file_bytes))
            pages_text = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    pages_text.append(page_text)
            return "\n".join(pages_text).strip()
        except Exception as e:
            logger.error(f"pypdf extraction failed: {e}")
            raise ValueError(f"Failed to extract PDF text: {str(e)}")

    def normalize_resume_text(self, raw_text: str) -> str:
        """
        Normalizes raw resume text into clean Markdown using Mistral Large.
        Fast single-shot API call — much quicker than document conversion libraries.
        Falls back to basic text formatting if API call fails.
        """
        if not raw_text or not raw_text.strip():
            return "# Empty Resume\n\nNo content extracted."

        # Already structured markdown — return as-is
        if raw_text.strip().startswith("#") or "\n## " in raw_text:
            return raw_text.strip()

        # Use Mistral Large to structure the text into clean Markdown
        structured = llm_service.structure_resume_text(raw_text)
        if structured and structured.strip():
            return structured

        # Fallback: basic heuristic formatting
        return self._heuristic_format(raw_text)

    def _heuristic_format(self, raw_text: str) -> str:
        """Basic fallback: format raw resume text using simple heuristics."""
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return "# Resume\n\n" + raw_text

        markdown = f"# {lines[0].replace('#', '').strip()}\n\n"
        section_headers = [
            "SUMMARY", "EXPERIENCE", "WORK EXPERIENCE", "EDUCATION",
            "SKILLS", "TECHNICAL SKILLS", "PROJECTS", "CERTIFICATIONS",
            "ACHIEVEMENTS", "LANGUAGES", "CONTACT"
        ]

        for line in lines[1:]:
            upper_line = line.upper().replace(":", "").strip()
            if any(upper_line == sec or upper_line.startswith(sec) for sec in section_headers):
                markdown += f"\n## {line.replace(':', '').title()}\n\n"
            elif line.startswith(("-", "*", "•", "–")):
                clean = line.lstrip("-*•– ").strip()
                markdown += f"- {clean}\n"
            else:
                markdown += f"{line}\n\n"

        return markdown.strip()

    # ─────────────────────── Candidate Access ───────────────────────

    def list_resumes(self) -> List[Dict[str, str]]:
        """Lists all pre-loaded resumes from the data directory."""
        resumes = []
        if not os.path.exists(self.resumes_dir):
            return resumes
        for file_name in os.listdir(self.resumes_dir):
            if file_name.endswith((".md", ".txt")):
                candidate_id = os.path.splitext(file_name)[0]
                name = candidate_id.replace("_", " ").title()
                resumes.append({
                    "id": candidate_id,
                    "name": name,
                    "file_name": file_name,
                    "file_type": "markdown"
                })
        return resumes

    def get_resume_content(self, candidate_id: str) -> str:
        """Reads a pre-loaded resume by candidate ID."""
        for file_name in os.listdir(self.resumes_dir):
            if os.path.splitext(file_name)[0] == candidate_id:
                with open(os.path.join(self.resumes_dir, file_name), "r", encoding="utf-8") as f:
                    return f.read()
        raise FileNotFoundError(f"Resume not found for ID: {candidate_id}")

    # ─────────────────────── Screening ───────────────────────

    def screen_candidate(self, candidate_id: str) -> Dict[str, Any]:
        """Screens a pre-loaded candidate against the active Job Description."""
        job_desc = self.load_job_description()
        resume_text = self.get_resume_content(candidate_id)
        evaluation = llm_service.screen_resume(job_desc, resume_text)
        evaluation["candidate_id"] = candidate_id
        evaluation["candidate_name"] = candidate_id.replace("_", " ").title()
        evaluation["evaluation_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return evaluation

    def screen_custom_resume(self, file_name: str, resume_content: str) -> Dict[str, Any]:
        """Screens a custom uploaded resume against the active Job Description."""
        # Normalize the raw text into clean Markdown via Mistral Large
        markdown_content = self.normalize_resume_text(resume_content)
        job_desc = self.load_job_description()
        evaluation = llm_service.screen_resume(job_desc, markdown_content)

        candidate_name = llm_service._infer_candidate_name(markdown_content)
        raw_id = "custom_" + file_name.lower().replace(" ", "_")
        for ext in (".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg"):
            raw_id = raw_id.replace(ext, "")
        candidate_id = "".join(c for c in raw_id if c.isalnum() or c in ("_", "-"))

        # Persist the normalized resume so it appears in the candidate list
        try:
            os.makedirs(self.resumes_dir, exist_ok=True)
            with open(os.path.join(self.resumes_dir, f"{candidate_id}.txt"), "w", encoding="utf-8") as f:
                f.write(markdown_content)
        except Exception as e:
            logger.error(f"Failed to save custom resume: {e}")

        evaluation["candidate_id"] = candidate_id
        evaluation["candidate_name"] = candidate_name
        evaluation["evaluation_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return evaluation

    # ─────────────────────── Improvements ───────────────────────

    def improve_candidate(self, candidate_id: str) -> Dict[str, Any]:
        """Generates resume improvement suggestions for a pre-loaded candidate."""
        job_desc = self.load_job_description()
        resume_text = self.get_resume_content(candidate_id)
        result = llm_service.improve_resume(job_desc, resume_text)
        result["candidate_id"] = candidate_id
        result["candidate_name"] = candidate_id.replace("_", " ").title()
        return result

    def improve_custom_resume(self, resume_content: str, candidate_id: str, candidate_name: str) -> Dict[str, Any]:
        """Generates resume improvement suggestions for a custom uploaded resume."""
        job_desc = self.load_job_description()
        result = llm_service.improve_resume(job_desc, resume_content)
        result["candidate_id"] = candidate_id
        result["candidate_name"] = candidate_name
        return result


resume_service = ResumeService()
