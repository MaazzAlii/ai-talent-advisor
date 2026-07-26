import streamlit as st
import tempfile
import os
from pathlib import Path

from markitdown import MarkItDown

st.set_page_config(
    page_title="PDF to Markdown Converter",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("📄 PDF to Markdown Converter")
st.markdown("Powered by Microsoft's **MarkItDown** - Convert PDFs to clean Markdown instantly!")

with st.sidebar:
    st.markdown("### About MarkItDown")
    st.markdown("""
    MarkItDown is a lightweight Python utility for converting various files to Markdown.
    
    **Supports:**
    - PDFs
    - Word documents
    - PowerPoint
    - Excel sheets
    - Images
    - Audio files
    - HTML & more!
    """)
    st.markdown("[📖 Read the Docs](https://github.com/microsoft/markitdown)")

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("📤 Upload File")
    uploaded_file = st.file_uploader(
        "Choose a file to convert",
        type=["pdf", "docx", "xlsx", "pptx", "html", "txt", "csv", "json"],
        help="Select a file to convert to Markdown"
    )

with col2:
    st.subheader("📋 File Types")
    st.caption("""
    ✓ PDF\n
    ✓ DOCX\n
    ✓ XLSX\n
    ✓ PPTX\n
    ✓ HTML\n
    ✓ And more...
    """)

if uploaded_file is not None:
    st.divider()
    
    file_size = len(uploaded_file.getvalue()) / 1024
    st.info(f"📄 **{uploaded_file.name}** | Size: {file_size:.1f} KB | Type: {uploaded_file.type}")
    
    try:
        with st.spinner("🔄 Converting to Markdown..."):
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded_file.name).suffix) as tmp_file:
                tmp_file.write(uploaded_file.getvalue())
                tmp_path = tmp_file.name
            
            try:
                md = MarkItDown()
                result = md.convert(tmp_path)
                markdown_content = result.text_content
                
                if not markdown_content.strip():
                    st.warning("⚠️ No text could be extracted. The file might be image-based or encrypted.")
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
                            use_container_width=True
                        )
                    
                    with col2:
                        st.subheader("📊 Statistics")
                        st.metric("Characters", f"{len(markdown_content):,}")
                        st.metric("Words", f"{len(markdown_content.split()):,}")
                        st.metric("Lines", len(markdown_content.split('\n')))
                        
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                    
    except Exception as e:
        st.error(f"❌ Error: {str(e)}")
        st.info("Try uploading a different file or check the file format.")

st.divider()
st.markdown("""
---
<div style='text-align: center; padding: 20px; color: #888;'>
    <p style='font-size: 12px;'>Built with Streamlit • Powered by Microsoft MarkItDown</p>
    <p style='font-size: 11px;'><a href="https://github.com/microsoft/markitdown" style="text-decoration: none; color: #666;">GitHub Repository</a></p>
</div>
""", unsafe_allow_html=True)

st.divider()
st.markdown("""
---
<div style='text-align: center'>
    <p style='color: gray; font-size: 12px;'>Powered by <strong>MarkItDown</strong> & <strong>Streamlit</strong></p>
</div>
""", unsafe_allow_html=True)
