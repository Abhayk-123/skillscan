import io
import pdfplumber
from docx import Document

def parse_resume(file_storage):
    filename = (file_storage.filename or "").lower()

    if filename.endswith(".pdf"):
        file_storage.stream.seek(0)
        with pdfplumber.open(file_storage.stream) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
            return text.strip()

    if filename.endswith(".docx"):
        file_storage.stream.seek(0)
        doc = Document(io.BytesIO(file_storage.read()))
        return "\n".join(p.text for p in doc.paragraphs).strip()

    raise ValueError("Only PDF and DOCX files are supported.")
