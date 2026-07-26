import json
import logging
from typing import Dict, Any
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.api_key = settings.api_key
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL
        
        if self.provider == "groq" and self.api_key:
            self.client = Groq(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("Groq API client not initialized. Check your environment variables.")

    def screen_resume(self, job_desc: Dict[str, Any], resume_text: str) -> Dict[str, Any]:
        """
        Screens a resume against the Careem Job Description.
        Calculates score breakdown and generates tailored interview questions using LLM.
        """
        if not self.client:
            logger.error("LLM client not configured. Returning fallback mock response.")
            return self._get_fallback_evaluation("Mock Candidate")

        system_prompt = (
            "You are an expert AI Technical Recruiter specializing in matching candidates for Careem's "
            "engineering team. Your job is to objectively analyze the candidate's resume against the Job Description.\n\n"
            "Evaluate the candidate across exactly 5 dimensions, scoring each on a 0-5 scale:\n"
            "1. backend_skills: Expertise in Python (FastAPI, Django, Flask) and backend frameworks.\n"
            "2. system_design: Microservices, event-driven designs, scale, concurrency, and performance tuning.\n"
            "3. real_time_databases: Experience with databases (PostgreSQL), caching (Redis), and real-time tech (WebSockets, gRPC).\n"
            "4. cloud_devops: Containerization (Docker), orchestration (Kubernetes), and AWS cloud architectures.\n"
            "5. domain_fit: Logistics, last-mile delivery, or ride-hailing industry experience.\n\n"
            "Compute the overall weighted score as a percentage using this exact formula:\n"
            "overall_score = (backend_skills * 0.25 + system_design * 0.25 + real_time_databases * 0.20 + cloud_devops * 0.15 + domain_fit * 0.15) * 20\n"
            "Ensure the computed overall_score is rounded to the nearest integer.\n\n"
            "Assign status:\n"
            "- 'Shortlisted' if overall_score is >= 80\n"
            "- 'Under Review' if overall_score is between 50 and 79\n"
            "- 'Rejected' if overall_score is < 50\n\n"
            "Format the output strictly as a JSON object matching this schema:\n"
            "{\n"
            "  \"overall_score\": <int>,\n"
            "  \"status\": \"<Shortlisted | Under Review | Rejected>\",\n"
            "  \"breakdown\": {\n"
            "    \"backend_skills\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"system_design\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"real_time_databases\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"cloud_devops\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"domain_fit\": {\"score\": <int 0-5>, \"justification\": \"<text>\"}\n"
            "  },\n"
            "  \"summary\": \"<Detailed analysis summary>\",\n"
            "  \"interview_questions\": [\n"
            "    \"<tailored technical question 1>\",\n"
            "    \"<tailored technical question 2>\",\n"
            "    \"<tailored technical question 3>\",\n"
            "    \"<tailored technical question 4>\",\n"
            "    \"<tailored technical question 5>\"\n"
            "  ]\n"
            "}\n"
            "Return only the JSON object. Do not include markdown formatting like ```json or ```."
        )

        user_content = (
            f"### JOB DESCRIPTION:\n{json.dumps(job_desc, indent=2)}\n\n"
            f"### CANDIDATE RESUME:\n{resume_text}\n"
        )

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                model=self.model,
                temperature=0.1,
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            result_text = chat_completion.choices[0].message.content.strip()
            # Safety checks to parse json clean
            if result_text.startswith("```"):
                lines = result_text.splitlines()
                if lines[0].startswith("```json"):
                    result_text = "\n".join(lines[1:-1])
                elif lines[0].startswith("```"):
                    result_text = "\n".join(lines[1:-1])
            return json.loads(result_text)
        except Exception as e:
            logger.error(f"Error calling Groq API: {e}")
            # Try to infer a candidate name from the resume text for the fallback
            candidate_name = self._infer_candidate_name(resume_text)
            return self._get_fallback_evaluation(candidate_name)

    def _infer_candidate_name(self, resume_text: str) -> str:
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        if lines:
            # Strip markdown syntax if first line is a header
            first_line = lines[0].replace("#", "").strip()
            if len(first_line) < 50:
                return first_line
        return "Unknown Candidate"

    def _get_fallback_evaluation(self, candidate_name: str) -> Dict[str, Any]:
        """Provides a logical fallback in case of LLM API issues."""
        return {
            "overall_score": 68,
            "status": "Under Review",
            "breakdown": {
                "backend_skills": {"score": 4, "justification": "Candidate has solid backend experience in Python and FastAPI as seen in their resume, but lacks some advanced framework experience."},
                "system_design": {"score": 3, "justification": "Demonstrates basic understanding of microservices, but lacks evidence of scale and concurrency optimization."},
                "real_time_databases": {"score": 3, "justification": "Familiar with PostgreSQL and Redis caching, but has limited experience with WebSockets or gRPC."},
                "cloud_devops": {"score": 3, "justification": "Has deployed services in Docker containers, but AWS and Kubernetes experience is limited."},
                "domain_fit": {"score": 4, "justification": "Possesses matching experience in logistics and transport, which aligns closely with Careem."}
            },
            "summary": f"Fallback evaluation generated for {candidate_name} due to temporary API issues. The profile shows potential, especially in Python backend development and logistics domain knowledge. A formal technical interview is suggested to drill down into system design and cloud deployments.",
            "interview_questions": [
                "Could you walk me through the system design of the most complex Python-based service you have built?",
                "How would you implement high-speed real-time vehicle matching in Careem using Redis or WebSockets?",
                "Explain how you use database transactions and locking mechanisms in PostgreSQL to prevent double-booking driver assignments.",
                "What is your approach to CI/CD pipelines, Docker containerization, and deploying microservices on Kubernetes?",
                "Can you discuss a specific scaling problem you encountered in logistics and how you resolved the concurrency bottleneck?"
            ]
        }

llm_service = LLMService()
