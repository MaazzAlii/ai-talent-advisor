import base64
import os
from pathlib import Path

import requests
import streamlit as st

MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"
MIME_BY_EXT = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}

st.set_page_config(page_title="Resume to Markdown Converter", page_icon="📄", layout="wide")

st.title("📄 Resume to Markdown Converter")
st.markdown("Powered by **Mistral OCR** (`mistral-ocr-latest`) - convert a PDF or photo/scan of a resume to clean Markdown instantly.")

with st.sidebar:
    st.markdown("### About")
    st.markdown(
        """
        This is a standalone demo of the same conversion pipeline used by the
        Careem AI Talent Advisor app.

        **Supports:** PDF, PNG, JPG (via Mistral OCR) and DOCX (parsed locally).
        """
    )
    api_key = st.text_input(
        "Mistral API key",
        value=os.environ.get("MISTRAL_API_KEY", ""),
        type="password",
        help="Only needed for PDF/PNG/JPG. Not required for DOCX.",
    )

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("📤 Upload File")
    uploaded_file = st.file_uploader(
        "Choose a file to convert",
        type=["pdf", "docx", "png", "jpg", "jpeg"],
        help="Select a resume file to convert to Markdown",
    )

with col2:
    st.subheader("📋 File Types")
    st.caption("✓ PDF (OCR)\n\n✓ PNG / JPG (OCR)\n\n✓ DOCX (local parse)")


def convert_via_mistral_ocr(file_bytes: bytes, ext: str, key: str) -> str:
    mime_type = MIME_BY_EXT[ext]
    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{b64_data}"
    document_payload = (
        {"type": "image_url", "image_url": data_uri}
        if ext in {".png", ".jpg", ".jpeg"}
        else {"type": "document_url", "document_url": data_uri}
    )
    response = requests.post(
        MISTRAL_OCR_URL,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": "mistral-ocr-latest", "document": document_payload},
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return "\n\n".join(page.get("markdown", "") for page in data.get("pages", [])).strip()


def convert_docx(file_bytes: bytes) -> str:
    from io import BytesIO
    from docx import Document

    doc = Document(BytesIO(file_bytes))
    lines = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        style = (para.style.name or "").lower()
        if "heading 1" in style or "title" in style:
            lines.append(f"# {text}")
        elif "heading" in style:
            lines.append(f"## {text}")
        elif "list" in style:
            lines.append(f"- {text}")
        else:
            lines.append(text)
    return "\n".join(lines).strip()


if uploaded_file is not None:
    st.divider()
    ext = Path(uploaded_file.name).suffix.lower()
    file_size = len(uploaded_file.getvalue()) / 1024
    st.info(f"📄 **{uploaded_file.name}** | Size: {file_size:.1f} KB")

    try:
        with st.spinner("🔄 Converting to Markdown..."):
            file_bytes = uploaded_file.getvalue()
            if ext == ".docx":
                markdown_content = convert_docx(file_bytes)
            elif ext in MIME_BY_EXT:
                if not api_key:
                    st.warning("⚠️ Enter your Mistral API key in the sidebar to OCR PDF/PNG/JPG files.")
                    st.stop()
                markdown_content = convert_via_mistral_ocr(file_bytes, ext, api_key)
            else:
                st.error(f"Unsupported file type: {ext}")
                st.stop()

        if not markdown_content.strip():
            st.warning("⚠️ No text could be extracted. The file might be blank or unreadable.")
        else:
            st.success("✅ Conversion completed successfully!")

            st.subheader("📋 Preview")
            with st.expander("View Markdown Content", expanded=True):
                display_content = markdown_content[:3000]
                if len(markdown_content) > 3000:
                    display_content += "\n\n... (truncated for preview)"
                st.markdown(display_content)

            col1, col2 = st.columns(2)
            with col1:
                st.subheader("📥 Download")
                markdown_filename = Path(uploaded_file.name).stem + ".md"
                st.download_button(
                    label="⬇️ Download as Markdown",
                    data=markdown_content,
                    file_name=markdown_filename,
                    mime="text/markdown",
                    use_container_width=True,
                )
            with col2:
                st.subheader("📊 Statistics")
                st.metric("Characters", f"{len(markdown_content):,}")
                st.metric("Words", f"{len(markdown_content.split()):,}")
                st.metric("Lines", len(markdown_content.split("\n")))

    except requests.HTTPError as e:
        st.error(f"❌ Mistral OCR request failed: {e}")
    except Exception as e:
        st.error(f"❌ Error: {str(e)}")
        st.info("Try uploading a different file or check the file format.")

st.divider()
st.markdown(
    """
    <div style='text-align: center; padding: 10px; color: #888;'>
        <p style='font-size: 12px;'>Built with Streamlit • Powered by Mistral OCR</p>
    </div>
    """,
    unsafe_allow_html=True,
)
