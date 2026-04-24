from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

def build_analysis_pdf(file_name: str, result: dict):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, "SkillScan Resume Report")
    y -= 30

    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"File: {file_name or 'Resume'}")
    y -= 20
    c.drawString(50, y, f"ATS Score: {result.get('ats_score', '-')}")
    y -= 25

    def draw_block(title, items):
        nonlocal y
        c.setFont("Helvetica-Bold", 13)
        c.drawString(50, y, title)
        y -= 18
        c.setFont("Helvetica", 11)
        if isinstance(items, str):
            lines = [items]
        else:
            lines = items or []
        for line in lines:
            if y < 60:
                c.showPage()
                y = height - 50
            c.drawString(65, y, f"- {str(line)[:100]}")
            y -= 16
        y -= 8

    draw_block("Summary", result.get("summary", ""))
    draw_block("Strengths", result.get("strengths", []))
    draw_block("Missing Skills", result.get("missing_skills", []))
    draw_block("Suggestions", result.get("suggestions", []))

    c.save()
    buffer.seek(0)
    return buffer
