# Careem AI Talent Advisor - FastAPI + static frontend, single-container image.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY frontend ./frontend

# Persisted at runtime so newly-screened/uploaded resumes and JD edits survive restarts
# (mount a volume at /app/app/data in production if you want that to be permanent).
RUN mkdir -p /app/app/data/resumes

EXPOSE 8000

ENV PORT=8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
