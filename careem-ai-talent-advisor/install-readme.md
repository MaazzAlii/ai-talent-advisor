# 📄 PDF to Markdown Converter (MarkItDown with Streamlit UI)

This guide provides step-by-step instructions on how to install, configure, and run **MarkItDown** (by Microsoft) and its accompanying **Streamlit Web UI** on Windows.

---

## 🛠️ Step 1: Prerequisites
Make sure you have the following installed on your system:
- **Python 3.10 or higher** (Python 3.14.3 is installed on your system and is supported).
- **Git** (optional).

---

## 📦 Step 2: Setup and Installation

### 1. Open your Terminal / PowerShell
Navigate to the project root directory:
```powershell
cd "c:\Users\maaza\OneDrive\Desktop\100 days of code praactice\pdf-to-markitdown-with-ui-by-microsoft-and-Me"
```

### 2. Create a Virtual Environment
Creating a virtual environment isolates your dependencies and keeps your system clean:
```powershell
python -m venv .venv
```
*(This has already been set up in your folder!)*

### 3. Activate the Virtual Environment
Activate it using **PowerShell**:
```powershell
.venv\Scripts\Activate.ps1
```
If you are using a standard **Command Prompt (cmd)**, run:
```cmd
.venv\Scripts\activate.bat
```

### 4. Install MarkItDown and Streamlit
Install the local Microsoft MarkItDown package in **editable mode** with all dependencies, along with Streamlit:
```powershell
pip install -e packages/markitdown[all] streamlit
```
*(This has already been completed successfully in your current workspace!)*

---

## 🚀 How to Run the Project

### Option A: Run the Streamlit Web UI (Recommended)
To run the interactive web interface:
1. Open PowerShell in the project directory.
2. Activate your virtual environment: `.venv\Scripts\Activate.ps1`
3. Run the Streamlit application:
   ```powershell
   streamlit run pdf_converter_ui.py
   ```
4. A browser window will automatically open at `http://localhost:8501`.
5. Upload any supported file (PDF, Word, Excel, PowerPoint, HTML, CSV, JSON, etc.) to view, analyze, and download its markdown output.

---

### Option B: Use the Command-Line Interface (CLI)
You can run the converter directly from your terminal:

- **Output to screen:**
  ```powershell
  markitdown path\to\your\document.pdf
  ```

- **Output to a file:**
  ```powershell
  markitdown path\to\your\document.pdf -o output.md
  ```

---

### Option C: Python API
You can integrate MarkItDown into your own scripts:

```python
from markitdown import MarkItDown

# Initialize the converter
md = MarkItDown()

# Convert a file
result = md.convert("example.pdf")

# Print the extracted markdown content
print(result.text_content)
```

---

## 💡 Advanced Configurations

### 🖼️ Image Descriptions and OCR
To allow MarkItDown to run OCR on images or generate descriptions for slide graphics, pass a Large Language Model (LLM) client when initializing:

```python
from markitdown import MarkItDown
from openai import OpenAI

client = OpenAI()
md = MarkItDown(llm_client=client, llm_model="gpt-4o")

result = md.convert("scanned_document.pdf")
print(result.text_content)
```

### 🎵 Audio Transcription
If you wish to use the audio transcription features (converting wav/mp3 to text), you will need `ffmpeg` installed on your machine.
- Install `ffmpeg` on Windows using the Command Line:
  ```powershell
  winget install Gyan.FFmpeg
  ```
- Restart your terminal after installing for it to register.

---

## 🔍 Troubleshooting
- **PowerShell Script Execution Error:**
  If you receive a script execution error while running `.venv\Scripts\Activate.ps1`, run the following command in PowerShell and try again:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  ```
