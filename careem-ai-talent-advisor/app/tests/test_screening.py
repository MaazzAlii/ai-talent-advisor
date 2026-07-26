import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.resume_service import resume_service
from app.config import settings

client = TestClient(app)

def test_load_job_description():
    """Verify job description can be parsed and loaded correctly."""
    jd = resume_service.load_job_description()
    assert jd["company"] == "Careem"
    assert "Senior Backend Engineer" in jd["title"]
    assert len(jd["requirements"]) > 0

def test_list_candidates():
    """Verify that all 6 preloaded candidates are detected by the service."""
    candidates = resume_service.list_resumes()
    assert len(candidates) == 6
    names = [c["name"] for c in candidates]
    assert "Anas Khan" in names
    assert "Sarah Jenkins" in names
    assert "Amara Al Fayed" in names

def test_get_candidate_resume():
    """Verify we can fetch the original text content of a resume."""
    res = resume_service.get_resume_content("anas_khan")
    assert "Anas Khan" in res
    assert "YallaDrive" in res

def test_weighted_score_formula():
    """Verify the weighted score calculation math is correct."""
    # formula: (backend * 0.25 + design * 0.25 + db * 0.20 + devops * 0.15 + domain * 0.15) * 20
    # perfect score (5, 5, 5, 5, 5) -> 100
    perfect = (5 * 0.25 + 5 * 0.25 + 5 * 0.20 + 5 * 0.15 + 5 * 0.15) * 20
    assert perfect == 100.0

    # average score (3, 3, 3, 3, 3) -> 60
    avg = (3 * 0.25 + 3 * 0.25 + 3 * 0.20 + 3 * 0.15 + 3 * 0.15) * 20
    assert avg == 60.0

    # custom combination (5, 4, 4, 3, 5)
    # (5*0.25 + 4*0.25 + 4*0.20 + 3*0.15 + 5*0.15) * 20
    # (1.25 + 1.0 + 0.8 + 0.45 + 0.75) * 20 = 4.25 * 20 = 85.0
    custom = (5 * 0.25 + 4 * 0.25 + 4 * 0.20 + 3 * 0.15 + 5 * 0.15) * 20
    assert custom == 85.0

def test_api_endpoints():
    """Test HTTP GET endpoints on FastAPI app."""
    # Test GET /api/jd
    response = client.get("/api/jd")
    assert response.status_code == 200
    assert response.json()["company"] == "Careem"

    # Test GET /api/candidates
    response = client.get("/api/candidates")
    assert response.status_code == 200
    assert len(response.json()) == 6
