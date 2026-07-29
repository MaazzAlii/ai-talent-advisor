# 📄 Resume to Markdown Converter (Mistral OCR + Streamlit UI)

Step-by-step instructions to run the standalone `pdf_converter_ui.py` demo tool, which converts a PDF/PNG/JPG/DOCX resume to Markdown using Mistral's OCR API (or a local parse for DOCX).

This is a separate, lightweight companion tool to the main Careem AI Talent Advisor app — useful if you just want to quickly convert a single file without running the full FastAPI app.

---

## 🛠️ Step 1: Prerequisites
- Python 3.10 or higher
- A Mistral API key (only needed for PDF/PNG/JPG — not for DOCX): https://console.mistral.ai/api-keys

---

## 📦 Step 2: Setup and Installation

### 1. Open your terminal and navigate to the project root
```powershell
cd path\to\careem-ai-talent-advisor
```

### 2. Create and activate a virtual environment
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1        # PowerShell
# or: .venv\Scripts\activate.bat  # cmd
```

### 3. Install dependencies
```powershell
pip install streamlit requests python-docx
```
(If you've already run `pip install -r requirements.txt` for the main app, `requests` and `python-docx` are already installed — you just need `streamlit` extra.)

---

## 🚀 How to run it

```powershell
streamlit run pdf_converter_ui.py
```

A browser window opens at `http://localhost:8501`. Paste your Mistral API key into the sidebar (only required for PDF/PNG/JPG), upload a resume file, and download the converted Markdown.

---

## How the conversion works

- **PDF / PNG / JPG** → sent directly to Mistral's OCR API (`mistral-ocr-latest` via `POST https://api.mistral.ai/v1/ocr`), which returns Markdown per page.
- **DOCX** → parsed locally with `python-docx` (headings/paragraphs/tables → Markdown). No API call needed since DOCX already has a text layer.

---

## 🔍 Troubleshooting
- **PowerShell script execution error** activating the venv: run
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  ```
  then retry.
- **401/403 from Mistral OCR**: double-check the API key pasted into the sidebar and that it hasn't been rotated/revoked.
