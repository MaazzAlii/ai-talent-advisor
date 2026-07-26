from pydantic import BaseModel, Field
from typing import List, Optional


class JobDescription(BaseModel):
    title: str
    company: str
    department: str
    location: str
    description: str
    requirements: List[str]
    preferred_qualifications: List[str]
    raw_text: Optional[str] = None


class ResumeProfile(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    file_name: str
    content: str


class ScoreDimension(BaseModel):
    score: int = Field(..., description="Score from 0 to 5", ge=0, le=5)
    justification: str = Field(..., description="Detailed justification for the score")


class ScoreBreakdown(BaseModel):
    backend_skills: ScoreDimension = Field(..., description="Python language & web frameworks (e.g. FastAPI, Django, Flask)")
    system_design: ScoreDimension = Field(..., description="Microservices architecture, event-driven pattern, scale and concurrency optimization")
    real_time_databases: ScoreDimension = Field(..., description="Real-time web sockets/gRPC, and database/caching systems (PostgreSql, Redis)")
    cloud_devops: ScoreDimension = Field(..., description="Containerization (Docker), orchestration (Kubernetes), and cloud infra (AWS)")
    domain_fit: ScoreDimension = Field(..., description="Prior logistics, ride-hailing or delivery industry domain knowledge")


class EvaluationResult(BaseModel):
    candidate_id: str
    candidate_name: str
    overall_score: int = Field(..., description="Weighted average score from 0 to 100", ge=0, le=100)
    status: str = Field(..., description="'Shortlisted' (>= 80), 'Under Review' (50-79), or 'Rejected' (< 50)")
    breakdown: ScoreBreakdown
    summary: str = Field(..., description="General summary of candidate suitability and assessment explanation")
    interview_questions: List[str] = Field(..., description="5 customized technical interview questions designed for the candidate")
    evaluation_date: str


class ImprovementResult(BaseModel):
    candidate_id: str
    candidate_name: str
    strengths: List[str] = Field(..., description="Key strengths found in the resume that match the JD well")
    gaps: List[str] = Field(..., description="Critical gaps or missing skills compared to the job description")
    suggestions: List[str] = Field(..., description="Specific actionable suggestions to improve the resume")
    improvements: List[str] = Field(..., description="Concrete improvements the candidate should make to their profile/skills")
    overall_advice: str = Field(..., description="Overall career advice and summary improvement note")
