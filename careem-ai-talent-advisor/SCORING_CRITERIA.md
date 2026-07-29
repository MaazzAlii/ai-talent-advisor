# Scoring Criteria & Methodology

## 1. Target role

The default Job Description is a **Senior Backend Engineer (Python) - Ride Matching & Dispatch Team** at **Careem**, a ride-hailing/delivery "super-app" operating across the Middle East, Pakistan, and parts of Africa and South Asia. It was chosen because it's a realistic, publicly-recognizable engineering role in Maaz's target domain (backend + AI systems), and because Careem's dispatch/matching problem space (high concurrency, real-time state, geolocation) maps cleanly onto measurable technical dimensions. The JD is fully editable in the app, so any real job posting (copy-pasted from LinkedIn/Indeed/etc.) can be scored instead.

## 2. The five scoring dimensions

Every resume is scored by the LLM across exactly five dimensions, each on a **0-5** scale:

| Dimension | What it measures | Weight |
|---|---|---|
| `backend_skills` | Python + web framework depth (FastAPI, Django, Flask) | 25% |
| `system_design` | Microservices, event-driven design, concurrency/scale | 25% |
| `real_time_databases` | PostgreSQL, Redis caching, WebSockets/gRPC | 20% |
| `cloud_devops` | Docker, Kubernetes, AWS | 15% |
| `domain_fit` | Ride-hailing / logistics / last-mile delivery experience | 15% |

These weights were chosen to mirror how a hiring manager for this specific role would actually prioritize: core backend + system design carry the most weight (they're make-or-break for a senior IC), infra and domain fit matter but are more coachable/transferable.

## 3. Overall score formula

```
overall_score = (backend_skills*0.25 + system_design*0.25 + real_time_databases*0.20
                 + cloud_devops*0.15 + domain_fit*0.15) * 20
```

Multiplying by 20 converts the weighted 0-5 average into a 0-100 percentage.

## 4. Status thresholds

| Overall score | Status |
|---|---|
| ≥ 80 | Shortlisted |
| 50-79 | Under Review |
| < 50 | Rejected |

These thresholds were picked to be selective at the top (a true "shortlist" should be a minority of candidates) while giving a wide "Under Review" middle band, since resumes rarely map cleanly to "yes/no" and most real screening decisions need a human second look.

## 5. How the LLM is prompted

The model is given the full Job Description (as structured JSON) and the candidate's resume (as Markdown) in a single call, with a system prompt that:
- Defines exactly what each of the 5 dimensions means, so scoring is consistent across different resumes and different LLM providers.
- Forces the model to show its work via a per-dimension `justification` string, so every score is explainable, not a black box.
- Requires strict JSON output (via `response_format: json_object`) matching a fixed schema, so the score, status, and interview questions can be reliably parsed and rendered.

A second, independent LLM call (same JD + resume) generates **resume-improvement feedback** — strengths, concrete gaps with rewrite suggestions, missing JD keywords, and things that are already fine as-is. This is deliberately a separate prompt/call from scoring, so the model isn't trying to both grade and coach in the same breath.

## 6. Interview questions

Each evaluation also produces 5 tailored technical interview questions, generated in the same call as the scoring so the model can target questions at the *specific* candidate's apparent gaps (e.g. a candidate light on Kubernetes gets asked about it directly) rather than a generic question bank.

## 7. Model choice

- **Groq / `openai/gpt-oss-120b`** - a 120B open-weight model served at very low latency on Groq's LPU hardware. Chosen over smaller Groq models (e.g. Llama 3.1 8B) because resume screening is a reasoning-heavy task where model size matters for catching nuance and avoiding hallucinated justifications.
- **Mistral / `mistral-large-latest`** - Mistral's current flagship reasoning model, used as the alternate provider (switchable live in the UI) so the system isn't dependent on a single vendor.
- **Mistral / `mistral-ocr-latest`** (OCR) - Mistral's dedicated document/image OCR model, used to convert PDF and PNG/JPG resumes straight to Markdown in a single fast API call (no local document-parsing library, no separate vision chat call needed).

Both text models are intentionally full-size ("large"/flagship tier), not "small"/"mini" variants, since evaluation quality and justification depth degrade noticeably on smaller models.

## 8. Known limitations

- LLM-based scoring is inherently probabilistic; two runs on the same resume can produce slightly different scores/justifications. For a production hiring tool, this would need a calibration/consistency layer (e.g. running each resume N times and averaging, or a rubric-based rules layer as a sanity check on top of the LLM).
- The system currently has no bias-auditing step. A real deployment should periodically test the scorer against resumes with names/genders/schools randomized to check for spurious correlations.
- Fallback (mock) evaluations are returned if the LLM API call fails, so the UI never breaks - but these are clearly generic and not a real assessment, and are logged as errors server-side.
