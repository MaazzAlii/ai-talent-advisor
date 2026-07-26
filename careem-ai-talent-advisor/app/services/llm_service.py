import json
import logging
import httpx
from typing import Dict, Any, List
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self):
        self.api_key = settings.api_key
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL
        # Pixtral is always via Mistral API regardless of provider setting
        self.pixtral_model = "pixtral-12b-2409"
        self.mistral_api_key = settings.MISTRAL_API_KEY

        if self.provider == "groq":
            if self.api_key:
                self.client = Groq(api_key=self.api_key)
            else:
                self.client = None
                logger.warning("Groq API key not configured. Check your .env file.")
        elif self.provider == "mistral":
            self.client = None  # Uses httpx directly
            if not self.api_key:
                logger.warning("Mistral API key not configured. Check your .env file.")
        else:
            self.client = None
            logger.warning(f"Unsupported LLM provider '{self.provider}'. Fallback mock will be used.")

    def _call_llm(self, system_prompt: str, user_content: str, max_tokens: int = 2000) -> str:
        """Unified LLM call for both Groq and Mistral providers. Returns raw text response."""
        if self.provider == "groq":
            if not self.client:
                raise RuntimeError("Groq client not initialized.")
            completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                model=self.model,
                temperature=0.1,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}
            )
            return completion.choices[0].message.content.strip()

        elif self.provider == "mistral":
            if not self.api_key:
                raise RuntimeError("Mistral API key not configured.")
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.1,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"}
            }
            response = httpx.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=90.0
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()

        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def _parse_json_response(self, raw_text: str) -> Dict[str, Any]:
        """Safely parse JSON from LLM response, stripping markdown code fences if present."""
        text = raw_text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            # Remove opening fence (```json or ```)
            start = 1
            # Remove closing fence
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            text = "\n".join(lines[start:end])
        return json.loads(text)

    def screen_resume(self, job_desc: Dict[str, Any], resume_text: str) -> Dict[str, Any]:
        """
        Screens a resume against the Job Description.
        Returns dimensional scores, status, summary, and 5 tailored interview questions.
        """
        if self.provider == "groq" and not self.client:
            return self._get_fallback_evaluation("Mock Candidate")
        if not self.api_key:
            return self._get_fallback_evaluation("Mock Candidate")

        system_prompt = (
            "You are an expert AI Technical Recruiter. Analyze the candidate resume against the Job Description.\n\n"
            "Score the candidate across exactly 5 dimensions (0-5 scale each):\n"
            "1. backend_skills: Python expertise (FastAPI, Django, Flask) and backend architecture.\n"
            "2. system_design: Microservices, event-driven design, concurrency, and performance.\n"
            "3. real_time_databases: Databases (PostgreSQL), caching (Redis), real-time tech (WebSockets, gRPC).\n"
            "4. cloud_devops: Docker, Kubernetes, AWS cloud deployments.\n"
            "5. domain_fit: Logistics, ride-hailing, or delivery industry experience.\n\n"
            "Weighted overall score formula:\n"
            "overall_score = (backend_skills*0.25 + system_design*0.25 + real_time_databases*0.20 + cloud_devops*0.15 + domain_fit*0.15) * 20\n"
            "Round overall_score to nearest integer.\n\n"
            "Status rules:\n"
            "- 'Shortlisted' if overall_score >= 80\n"
            "- 'Under Review' if overall_score is 50-79\n"
            "- 'Rejected' if overall_score < 50\n\n"
            "Return ONLY a valid JSON object (no markdown fences) with this exact schema:\n"
            "{\n"
            "  \"overall_score\": <int>,\n"
            "  \"status\": \"<Shortlisted|Under Review|Rejected>\",\n"
            "  \"breakdown\": {\n"
            "    \"backend_skills\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"system_design\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"real_time_databases\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"cloud_devops\": {\"score\": <int 0-5>, \"justification\": \"<text>\"},\n"
            "    \"domain_fit\": {\"score\": <int 0-5>, \"justification\": \"<text>\"}\n"
            "  },\n"
            "  \"summary\": \"<Detailed analysis summary>\",\n"
            "  \"interview_questions\": [\"<q1>\", \"<q2>\", \"<q3>\", \"<q4>\", \"<q5>\"]\n"
            "}"
        )

        user_content = (
            f"### JOB DESCRIPTION:\n{json.dumps(job_desc, indent=2)}\n\n"
            f"### CANDIDATE RESUME:\n{resume_text}\n"
        )

        try:
            raw = self._call_llm(system_prompt, user_content, max_tokens=2000)
            return self._parse_json_response(raw)
        except Exception as e:
            logger.error(f"Error calling {self.provider.upper()} screening API: {e}")
            candidate_name = self._infer_candidate_name(resume_text)
            return self._get_fallback_evaluation(candidate_name)

    def structure_resume_text(self, raw_text: str) -> str:
        """
        Uses Mistral Large to convert messy raw extracted text (from pypdf or plain text)
        into clean, well-structured Markdown. Fast single-shot call — much faster than
        document conversion libraries like MarkItDown.
        """
        if not self.api_key and self.provider == "groq" and not self.client:
            return ""  # Let heuristic fallback handle it
        if not self.api_key:
            return ""  # Let heuristic fallback handle it

        system_prompt = (
            "You are a document formatter. Convert the following raw resume text into "
            "clean, well-structured Markdown. Keep ALL information — do not summarize or omit anything. "
            "Use # for the candidate name, ## for section headers (Summary, Experience, Education, Skills, etc.), "
            "and - for bullet points. Return ONLY the formatted Markdown, nothing else."
        )
        try:
            # Use non-JSON mode (plain text response)
            if self.provider == "groq":
                if not self.client:
                    return ""
                completion = self.client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": raw_text[:8000]}  # Cap to avoid token limits
                    ],
                    model=self.model,
                    temperature=0.0,
                    max_tokens=2000
                )
                return completion.choices[0].message.content.strip()
            elif self.provider == "mistral":
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": raw_text[:8000]}
                    ],
                    "temperature": 0.0,
                    "max_tokens": 2000
                }
                response = httpx.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"Resume structuring via LLM failed, using heuristic fallback: {e}")
            return ""

    def parse_image_resume(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
        """
        Uses Pixtral (Mistral's vision model) to extract and structure text from
        a resume image (JPG, PNG, etc.). Returns clean Markdown text.
        Requires MISTRAL_API_KEY regardless of active provider.
        """
        import base64
        if not self.mistral_api_key:
            raise RuntimeError("Mistral API key required for Pixtral image parsing. Set MISTRAL_API_KEY in .env")

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{image_b64}"

        headers = {
            "Authorization": f"Bearer {self.mistral_api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.pixtral_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url}
                        },
                        {
                            "type": "text",
                            "text": (
                                "This is a resume image. Extract ALL text visible in the image and format it as clean, "
                                "structured Markdown. Use # for the candidate name, ## for section headers "
                                "(Summary, Experience, Education, Skills, Projects, etc.), and - for bullet points. "
                                "Preserve all dates, company names, job titles, and technical skills exactly as shown. "
                                "Return ONLY the formatted Markdown."
                            )
                        }
                    ]
                }
            ],
            "max_tokens": 2000
        }
        try:
            response = httpx.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Pixtral image parsing failed: {e}")
            raise RuntimeError(f"Image resume parsing failed: {str(e)}")

    def improve_resume(self, job_desc: Dict[str, Any], resume_text: str) -> Dict[str, Any]:
        """
        Analyzes the resume against the JD and returns specific improvement suggestions.
        Returns structured JSON with strengths, gaps, suggestions, improvements, and overall advice.
        Uses Mistral Large (or active LLM) for high-quality analysis.
        """
        if not self.api_key:
            return self._get_fallback_improvement("Candidate")


        system_prompt = (
            "You are a professional career coach and senior technical recruiter specializing in backend engineering roles. "
            "Your job is to analyze a candidate's resume against a specific job description and provide specific, actionable improvement advice.\n\n"
            "Analyze the resume carefully and return ONLY a valid JSON object (no markdown fences) with this exact schema:\n"
            "{\n"
            "  \"strengths\": [\"<strength 1>\", \"<strength 2>\", \"<strength 3>\"],\n"
            "  \"gaps\": [\"<critical gap 1>\", \"<critical gap 2>\", \"<critical gap 3>\"],\n"
            "  \"suggestions\": [\n"
            "    \"<specific resume writing improvement e.g. 'Quantify your Redis caching impact with metrics'>\",\n"
            "    \"<specific suggestion 2>\",\n"
            "    \"<specific suggestion 3>\",\n"
            "    \"<specific suggestion 4>\",\n"
            "    \"<specific suggestion 5>\"\n"
            "  ],\n"
            "  \"improvements\": [\n"
            "    \"<skill/experience the candidate needs to build e.g. 'Learn Kubernetes and get CKA certified'>\",\n"
            "    \"<improvement 2>\",\n"
            "    \"<improvement 3>\",\n"
            "    \"<improvement 4>\",\n"
            "    \"<improvement 5>\"\n"
            "  ],\n"
            "  \"overall_advice\": \"<2-3 sentence overall career coaching advice for this candidate>\"\n"
            "}\n\n"
            "Be specific, direct, and reference actual content from the resume and JD. "
            "Do NOT be generic. Mention exact skills, tools, or experiences that are missing or need improvement."
        )

        user_content = (
            f"### TARGET JOB DESCRIPTION:\n{json.dumps(job_desc, indent=2)}\n\n"
            f"### CANDIDATE RESUME:\n{resume_text}\n"
        )

        try:
            raw = self._call_llm(system_prompt, user_content, max_tokens=2000)
            return self._parse_json_response(raw)
        except Exception as e:
            logger.error(f"Error calling {self.provider.upper()} improvement API: {e}")
            candidate_name = self._infer_candidate_name(resume_text)
            return self._get_fallback_improvement(candidate_name)

    def _infer_candidate_name(self, resume_text: str) -> str:
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
        if lines:
            first_line = lines[0].replace("#", "").strip()
            if len(first_line) < 50:
                return first_line
        return "Unknown Candidate"

    def _get_fallback_evaluation(self, candidate_name: str) -> Dict[str, Any]:
        """Fallback evaluation when LLM API is unavailable."""
        return {
            "overall_score": 68,
            "status": "Under Review",
            "breakdown": {
                "backend_skills": {"score": 4, "justification": "Solid Python and FastAPI background, though advanced async patterns need more evidence."},
                "system_design": {"score": 3, "justification": "Demonstrates basic microservices understanding but lacks evidence of large-scale concurrency solutions."},
                "real_time_databases": {"score": 3, "justification": "Familiar with PostgreSQL and Redis, but limited WebSocket or gRPC experience shown."},
                "cloud_devops": {"score": 3, "justification": "Docker experience present, but Kubernetes and AWS depth is limited."},
                "domain_fit": {"score": 4, "justification": "Some logistics or transport exposure that aligns with Careem's domain."}
            },
            "summary": f"Fallback evaluation for {candidate_name} due to temporary API issues. Profile shows backend potential with moderate system design and cloud experience. A direct technical interview is recommended.",
            "interview_questions": [
                "Walk me through the most complex Python backend system you've built and how you handled scaling.",
                "How would you design a real-time vehicle matching system at Careem using Redis and WebSockets?",
                "Explain how you handle distributed transactions and prevent double-booking in PostgreSQL.",
                "Describe your approach to CI/CD pipelines, Docker containerization, and Kubernetes deployments.",
                "What is the most significant concurrency or performance bottleneck you've resolved in production?"
            ]
        }

    def _get_fallback_improvement(self, candidate_name: str) -> Dict[str, Any]:
        """Fallback improvement suggestions when LLM API is unavailable."""
        return {
            "strengths": [
                "Demonstrated Python backend development experience",
                "Familiarity with relational databases and basic DevOps tooling",
                "Shows initiative through project portfolio"
            ],
            "gaps": [
                "Missing explicit Kubernetes orchestration experience",
                "No evidence of real-time systems (WebSockets, gRPC) at production scale",
                "Limited ride-hailing or last-mile logistics domain exposure"
            ],
            "suggestions": [
                "Quantify all achievements with metrics (e.g., 'Reduced API latency by 40% using Redis caching')",
                "Add a dedicated 'Technical Skills' section listing FastAPI, Redis, PostgreSQL, Docker, Kubernetes explicitly",
                "Include architecture diagrams or links to system design documents in portfolio",
                "Rewrite experience bullets to follow the STAR format (Situation, Task, Action, Result)",
                "Add a brief summary/objective at the top tailored specifically to ride-hailing / transport tech"
            ],
            "improvements": [
                "Study and get hands-on with Apache Kafka for event streaming architecture",
                "Build a personal project using Kubernetes to demonstrate orchestration skills",
                "Contribute to open-source Python microservices projects to demonstrate scale experience",
                "Get AWS Certified Developer – Associate to strengthen cloud credibility",
                "Learn geospatial indexing concepts (Uber H3, PostGIS) relevant to location-based services"
            ],
            "overall_advice": f"Temporary API-generated advice for {candidate_name}. Focus on bridging the gap between basic Python development and production-scale distributed systems. Building demonstrable projects with Kafka, Kubernetes, and real-time APIs will significantly strengthen this profile for senior backend roles at companies like Careem."
        }


llm_service = LLMService()
