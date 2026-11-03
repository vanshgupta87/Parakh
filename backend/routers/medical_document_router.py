"""
PARAKH (परख) - Medical Documents Router
Handles secure multi-format document uploads, search, filtering, and protected streaming/downloads.
"""

import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse

from database.db import get_db
from auth.dependencies import get_current_user, require_role
from services.document_service import validate_and_save_document, ALLOWED_CATEGORIES
from services.clinical_audit_service import log_clinical_audit
from routers.emr_router import check_patient_access

router = APIRouter(prefix="/api/v1/medical-documents", tags=["Medical Documents"])


@router.post("/upload", status_code=201)
async def upload_medical_document(
    request: Request,
    patient_id: str = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Securely uploads a patient medical document (PDF, JPG, PNG up to 15 MB).
    Authorized for the patient themself, an authorized doctor, or an administrator.
    """
    client_ip = request.client.host if request.client else "unknown"

    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Allowed: {', '.join(sorted(ALLOWED_CATEGORIES))}."
        )

    with get_db() as db:
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have authorization to upload documents for this patient."
            )

        doc_id, safe_path, file_size, mime_type = validate_and_save_document(file, patient_id)

        db.execute(
            """
            INSERT INTO medical_documents
            (id, patient_id, uploaded_by_user_id, title, category, file_name, file_path, mime_type, file_size_bytes, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id, patient_id, current_user["id"], title.strip(),
                category, file.filename, safe_path, mime_type, file_size, notes
            )
        )

        log_clinical_audit(
            record_type="medical_document",
            record_id=doc_id,
            patient_id=patient_id,
            action="uploaded",
            performed_by_user_id=current_user["id"],
            new_data={
                "title": title, "category": category,
                "file_name": file.filename, "file_size_bytes": file_size, "mime_type": mime_type
            },
            reason="Medical document uploaded",
            ip_address=client_ip,
            conn=db
        )

        return {
            "status": "success",
            "document_id": doc_id,
            "title": title,
            "category": category,
            "file_name": file.filename,
            "file_size_bytes": file_size,
            "mime_type": mime_type,
            "message": "Document uploaded securely."
        }


@router.get("/patient/{patient_id}")
def list_patient_documents(
    patient_id: str,
    search: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Lists medical documents for a patient with search, category, and date filtering.
    """
    with get_db() as db:
        if not check_patient_access(current_user, patient_id, db):
            raise HTTPException(status_code=403, detail="Unauthorized.")

        query = """
        SELECT md.*, u.full_name as uploaded_by_name, u.role as uploaded_by_role
        FROM medical_documents md
        JOIN users u ON md.uploaded_by_user_id = u.id
        WHERE md.patient_id = ?
        """
        params = [patient_id]

        if search:
            query += " AND (md.title LIKE ? OR md.file_name LIKE ? OR md.notes LIKE ?)"
            s_param = f"%{search.strip()}%"
            params.extend([s_param, s_param, s_param])

        if category:
            query += " AND md.category = ?"
            params.append(category)

        if start_date:
            query += " AND DATE(md.created_at) >= ?"
            params.append(start_date)

        if end_date:
            query += " AND DATE(md.created_at) <= ?"
            params.append(end_date)

        query += " ORDER BY md.created_at DESC"

        docs = db.execute(query, tuple(params)).fetchall()

        # Omit internal file_path from public output
        sanitized = []
        for d in docs:
            item = dict(d)
            item.pop("file_path", None)
            sanitized.append(item)

        return {"status": "success", "documents": sanitized}


@router.get("/my")
def list_my_documents(
    search: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role("patient"))
):
    """Convenience endpoint for patient to list their own documents."""
    pat_profile = current_user.get("patient_profile")
    if not pat_profile:
        raise HTTPException(status_code=400, detail="Patient profile not found.")
    return list_patient_documents(
        patient_id=pat_profile["patient_id"],
        search=search,
        category=category,
        start_date=start_date,
        end_date=end_date,
        current_user=current_user
    )


@router.get("/{document_id}/download")
def download_medical_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Securely downloads a medical file with attachment header."""
    with get_db() as db:
        doc = db.execute("SELECT * FROM medical_documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Medical document not found.")

        if not check_patient_access(current_user, doc["patient_id"], db):
            raise HTTPException(status_code=403, detail="Unauthorized to download this document.")

        file_path = doc["file_path"]
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File on storage volume was not found.")

        return FileResponse(
            path=file_path,
            filename=doc["file_name"],
            media_type=doc["mime_type"],
            headers={"Content-Disposition": f"attachment; filename=\"{doc['file_name']}\""}
        )


@router.get("/{document_id}/view")
def view_medical_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Securely streams a medical file inline (e.g. for previewing in browser)."""
    with get_db() as db:
        doc = db.execute("SELECT * FROM medical_documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Medical document not found.")

        if not check_patient_access(current_user, doc["patient_id"], db):
            raise HTTPException(status_code=403, detail="Unauthorized to view this document.")

        file_path = doc["file_path"]
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File on storage volume was not found.")

        return FileResponse(
            path=file_path,
            media_type=doc["mime_type"],
            headers={"Content-Disposition": f"inline; filename=\"{doc['file_name']}\""}
        )


@router.delete("/{document_id}")
def delete_medical_document(
    document_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Deletes a medical document and removes file from disk with audit preservation."""
    client_ip = request.client.host if request.client else "unknown"
    with get_db() as db:
        doc = db.execute("SELECT * FROM medical_documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        # Only uploader, owner patient, or admin can delete
        is_uploader = doc["uploaded_by_user_id"] == current_user["id"]
        is_admin = current_user.get("role") == "admin"
        pat_profile = current_user.get("patient_profile")
        is_owner = pat_profile and pat_profile["patient_id"] == doc["patient_id"]

        if not (is_uploader or is_owner or is_admin):
            raise HTTPException(status_code=403, detail="Unauthorized to delete this document.")

        file_path = doc["file_path"]
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        db.execute("DELETE FROM medical_documents WHERE id = ?", (document_id,))

        log_clinical_audit(
            record_type="medical_document",
            record_id=document_id,
            patient_id=doc["patient_id"],
            action="deleted",
            performed_by_user_id=current_user["id"],
            previous_data=dict(doc),
            reason="Medical document removed",
            ip_address=client_ip,
            conn=db
        )

        return {"status": "success", "message": "Document deleted successfully."}
