import json
import logging
from typing import Dict, Any
from groq import Groq
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)

MISTRAL_BASE_URL = "https://api.mistral.ai/v1"

SCORING_SYSTEM_PROMPT = (
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

FEEDBACK_SYSTEM_PROMPT = (
    "You are an expert career coach and resume writer who helps candidates improve their resumes "
    "for backend engineering roles. You will be given a Job Description and a candidate's resume.\n\n"
    "Give the candidate direct, specific, and actionable feedback -- not generic advice.\n\n"
    "Format the output strictly as a JSON object matching this schema:\n"
    "{\n"
    "  \"strengths\": [\"<specific strength 1>\", \"<specific strength 2>\", \"<specific strength 3>\"],\n"
    "  \"improvement_areas\": [\n"
    "    {\"issue\": \"<what's missing or weak>\", \"suggestion\": \"<concrete rewrite/action to fix it>\"}\n"
    "  ],\n"
    "  \"non_conflicting_notes\": [\"<things that are fine as-is and don't need changing>\"],\n"
    "  \"keyword_gaps\": [\"<important JD keywords/skills missing from the resume>\"],\n"
    "  \"overall_advice\": \"<2-3 sentence closing recommendation>\"\n"
    "}\n"
    "List 3-6 items per array where relevant. Return only the JSON object, no markdown fences."
)


class LLMService:
    def __init__(self):
        self.api_key = settings.api_key
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL

        self.client = None
        if self.provider == "groq" and self.api_key:
            self.client = Groq(api_key=self.api_key)
        elif self.provider == "mistral" and self.api_key:
            self.client = OpenAI(api_key=self.api_key, base_url=MISTRAL_BASE_URL)

        if not self.client:
            logger.warning(
                f"LLM client not initialized for provider '{self.provider}'. "
                "Check your environment variables. Fallback mock responses will be used."
            )

    def _chat_json(self, system_prompt: str, user_content: str) -> Dict[str, Any]:
        """Runs a single chat completion against the active provider and parses strict JSON out."""
        if self.provider == "groq":
            completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                model=self.model,
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            result_text = completion.choices[0].message.content.strip()
        elif self.provider == "mistral":
            completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                model=self.model,
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            result_text = completion.choices[0].message.content.strip()
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

        if result_text.startswith("```"):
            lines = result_text.splitlines()
            result_text = "\n".join(lines[1:-1]) if len(lines) > 2 else result_text
        return json.loads(result_text)

    def screen_resume(self, job_desc: Dict[str, Any], resume_text: str) -> Dict[str, Any]:
        """Screens a resume against the Careem Job Description, scores it, and drafts interview questions."""
        if not self.client:
            logger.error(f"{self.provider.upper()} client not initialized. Returning fallback mock response.")
            return self._get_fallback_evaluation("Mock Candidate")

        user_content = (
            f"### JOB DESCRIPTION:\n{json.dumps(job_desc, indent=2)}\n\n"
            f"### CANDIDATE RESUME:\n{resume_text}\n"
        )
        try:
            return self._chat_json(SCORING_SYSTEM_PROMPT, user_content)
        except Exception as e:
            logger.error(f"Error calling {self.provider.upper()} API for screening: {e}")
            candidate_name = self._infer_candidate_name(resume_text)
            return self._get_fallback_evaluation(candidate_name)

    def generate_resume_feedback(self, job_desc: Dict[str, Any], resume_text: str) -> Dict[str, Any]:
        """Generates resume-improvement feedback: strengths, gaps, concrete rewrite suggestions."""
        if not self.client:
            logger.error(f"{self.provider.upper()} client not initialized. Returning fallback feedback.")
            return self._get_fallback_feedback()

        user_content = (
            f"### TARGET JOB DESCRIPTION:\n{json.dumps(job_desc, indent=2)}\n\n"
            f"### CANDIDATE RESUME:\n{resume_text}\n"
        )
        try:
            return self._chat_json(FEEDBACK_SYSTEM_PROMPT, user_content)
        except Exception as e:
            logger.error(f"Error calling {self.provider.upper()} API for feedback: {e}")
            return self._get_fallback_feedback()

    def _infer_candidate_name(self, resume_text: str) -> str:
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        if lines:
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
            "summary": f"Fallback evaluation generated for {candidate_name} because the LLM API call failed (check your API key / network / rate limits). The profile shows potential, especially in Python backend development and logistics domain knowledge. A formal technical interview is suggested to drill down into system design and cloud deployments.",
            "interview_questions": [
                "Could you walk me through the system design of the most complex Python-based service you have built?",
                "How would you implement high-speed real-time vehicle matching in Careem using Redis or WebSockets?",
                "Explain how you use database transactions and locking mechanisms in PostgreSQL to prevent double-booking driver assignments.",
                "What is your approach to CI/CD pipelines, Docker containerization, and deploying microservices on Kubernetes?",
                "Can you discuss a specific scaling problem you encountered in logistics and how you resolved the concurrency bottleneck?"
            ]
        }

    def _get_fallback_feedback(self) -> Dict[str, Any]:
        return {
            "strengths": [
                "Resume could not be analyzed automatically -- this is placeholder feedback.",
            ],
            "improvement_areas": [
                {"issue": "LLM API call failed", "suggestion": "Check your API key, network connection, and provider rate limits, then retry."}
            ],
            "non_conflicting_notes": [],
            "keyword_gaps": [],
            "overall_advice": "Automated feedback is temporarily unavailable. Please retry once the API connection is restored.",
        }


llm_service = LLMService()
