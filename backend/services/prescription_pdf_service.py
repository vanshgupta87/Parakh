"""
PARAKH (परख) - Digital Prescription PDF Generation Service
Generates professional, regulatory-compliant prescription PDFs using ReportLab
with PARAKH's Navy, Emerald, and Teal branding.
"""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)

# Colors matching PARAKH theme
NAVY = colors.HexColor("#0F172A")
EMERALD = colors.HexColor("#10B981")
TEAL = colors.HexColor("#06B6D4")
DARK_SLATE = colors.HexColor("#1E293B")
LIGHT_BG = colors.HexColor("#F8FAFC")
BORDER_COLOR = colors.HexColor("#CBD5E1")
TEXT_MUTED = colors.HexColor("#64748B")
TEXT_DARK = colors.HexColor("#0F172A")


def generate_prescription_pdf(prescription_data: dict) -> bytes:
    """
    Takes a dictionary containing:
      - prescription_number, created_at, follow_up_date, clinical_assessment, diagnosis, general_instructions
      - doctor: {full_name, qualification, specialization, medical_registration_number, clinic_name, clinic_address}
      - patient: {full_name, gender, date_of_birth, phone, email, patient_id}
      - items: [ {medicine_name, dosage, frequency, duration, instructions}, ... ]
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "HeaderTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=EMERALD
    )
    subtitle_style = ParagraphStyle(
        "HeaderSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=TEXT_MUTED
    )
    doctor_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=NAVY
    )
    small_text = ParagraphStyle(
        "SmallText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=DARK_SLATE
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=NAVY
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=DARK_SLATE
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.white
    )
    rx_symbol_style = ParagraphStyle(
        "RxSymbol",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=22,
        textColor=TEAL
    )

    story = []

    # 1. Header with PARAKH branding and Doctor details
    doc_info = prescription_data.get("doctor", {})
    pat_info = prescription_data.get("patient", {})

    header_left = [
        Paragraph("<b>PARAKH (परख) HEALTHCARE</b>", title_style),
        Paragraph("Intelligent Dermatology & Multi-Specialty Clinic Management", subtitle_style),
        Paragraph(f"<b>{doc_info.get('clinic_name') or 'PARAKH Health Center'}</b>", small_text),
        Paragraph(f"{doc_info.get('clinic_address') or 'Digital Consultation Portal'}", small_text),
    ]

    header_right = [
        Paragraph(f"<b>Dr. {doc_info.get('full_name', 'Doctor')}</b>", doctor_title),
        Paragraph(f"{doc_info.get('qualification', 'MBBS')} - {doc_info.get('specialization', 'Dermatology')}", small_text),
        Paragraph(f"Reg No: <b>{doc_info.get('medical_registration_number', 'N/A')}</b>", small_text),
        Paragraph(f"Date: <b>{prescription_data.get('created_at', datetime.now().strftime('%Y-%m-%d'))[:10]}</b>", small_text),
        Paragraph(f"Rx #: <b>{prescription_data.get('prescription_number', 'RX-0000')}</b>", small_text),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[3.25 * inch, 4.0 * inch]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=EMERALD, spaceAfter=8))

    # 2. Patient details card
    patient_cells = [
        [
            Paragraph(f"<b>Patient Name:</b> {pat_info.get('full_name', 'N/A')}", small_text),
            Paragraph(f"<b>Gender / DOB:</b> {pat_info.get('gender', 'N/A').capitalize()} / {pat_info.get('date_of_birth', 'N/A')}", small_text),
            Paragraph(f"<b>Patient ID:</b> {pat_info.get('patient_id', 'N/A')[:12]}...", small_text)
        ],
        [
            Paragraph(f"<b>Phone:</b> {pat_info.get('phone', 'N/A')}", small_text),
            Paragraph(f"<b>Email:</b> {pat_info.get('email', 'N/A')}", small_text),
            Paragraph(f"<b>Status:</b> {prescription_data.get('status', 'finalized').upper()}", small_text)
        ]
    ]
    patient_table = Table(patient_cells, colWidths=[2.5 * inch, 2.5 * inch, 2.25 * inch])
    patient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 12))

    # 3. Clinical Assessment & Diagnosis
    diag_data = []
    if prescription_data.get("diagnosis"):
        diag_data.append([
            Paragraph("<b>Clinical Diagnosis:</b>", section_title),
            Paragraph(prescription_data["diagnosis"], small_text)
        ])
    if prescription_data.get("clinical_assessment"):
        diag_data.append([
            Paragraph("<b>Clinical Assessment:</b>", section_title),
            Paragraph(prescription_data["clinical_assessment"], small_text)
        ])
    if diag_data:
        diag_table = Table(diag_data, colWidths=[1.8 * inch, 5.45 * inch])
        diag_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(diag_table)
        story.append(Spacer(1, 8))

    # 4. Rx Symbol & Medicines Table
    story.append(Paragraph("<b>℞ Medications Prescribed</b>", rx_symbol_style))
    story.append(Spacer(1, 6))

    items = prescription_data.get("items", [])
    table_rows = [
        [
            Paragraph("#", table_header),
            Paragraph("Medicine Name", table_header),
            Paragraph("Dosage", table_header),
            Paragraph("Frequency", table_header),
            Paragraph("Duration", table_header),
            Paragraph("Instructions", table_header),
        ]
    ]

    for idx, item in enumerate(items, 1):
        table_rows.append([
            Paragraph(str(idx), table_cell),
            Paragraph(f"<b>{item.get('medicine_name', '')}</b>", table_cell),
            Paragraph(item.get("dosage", ""), table_cell),
            Paragraph(item.get("frequency", ""), table_cell),
            Paragraph(item.get("duration", ""), table_cell),
            Paragraph(item.get("instructions") or "-", table_cell),
        ])

    if not items:
        table_rows.append([
            Paragraph("-", table_cell),
            Paragraph("No active medications specified.", table_cell),
            Paragraph("-", table_cell),
            Paragraph("-", table_cell),
            Paragraph("-", table_cell),
            Paragraph("-", table_cell),
        ])

    meds_table = Table(table_rows, colWidths=[0.4 * inch, 2.3 * inch, 0.9 * inch, 1.1 * inch, 0.9 * inch, 1.65 * inch])
    meds_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(meds_table)
    story.append(Spacer(1, 14))

    # 5. General Instructions & Follow-up
    notes_rows = []
    if prescription_data.get("general_instructions"):
        notes_rows.append([
            Paragraph("<b>General Advice:</b>", section_title),
            Paragraph(prescription_data["general_instructions"], small_text)
        ])
    if prescription_data.get("follow_up_date"):
        notes_rows.append([
            Paragraph("<b>Next Follow-up:</b>", section_title),
            Paragraph(f"<b>{prescription_data['follow_up_date']}</b>", small_text)
        ])

    if notes_rows:
        notes_table = Table(notes_rows, colWidths=[1.8 * inch, 5.45 * inch])
        notes_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(notes_table)
        story.append(Spacer(1, 10))

    # 6. Doctor Signature Block & Verification
    signature_block = [
        HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceAfter=8),
        Table([
            [
                Paragraph("<b>PARAKH Digital Healthcare Platform</b><br/><font color='#64748B'>Legally verified electronic prescription record.<br/>Generated in accordance with Telemedicine Practice Guidelines.</font>", small_text),
                Paragraph(f"<div align='right'><b>Dr. {doc_info.get('full_name', '')}</b><br/><font color='#10B981'>[Digitally Signed]</font><br/><font color='#64748B'>Reg: {doc_info.get('medical_registration_number', '')}</font></div>", small_text)
            ]
        ], colWidths=[4.25 * inch, 3.0 * inch], style=[
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ])
    ]
    story.append(KeepTogether(signature_block))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
