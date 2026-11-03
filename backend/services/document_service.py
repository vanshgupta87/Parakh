"""
PARAKH (परख) - Medical Document Storage & Validation Service
Validates file sizes, allowed MIME types, sanitizes file paths to prevent traversal,
and handles secure streaming for authorized viewing and downloading.
"""

import os
import shutil
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from auth.tokens import generate_id

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "medical_documents")

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

ALLOWED_CATEGORIES = {
    "laboratory_report",
    "dermatology_report",
    "medical_image",
    "previous_prescription",
    "medical_certificate",
    "other"
}

def validate_and_save_document(file: UploadFile, patient_id: str) -> Tuple[str, str, int, str]:
    """
    Validates file extension and content type, writes file securely to disk.
    Returns: (file_id, safe_file_path, file_size_bytes, mime_type)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not permitted. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )

    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in ALLOWED_MIME_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file MIME type '{mime_type}'. Permitted: PDF, JPEG, PNG."
        )

    # Read and verify size
    file_content = file.file.read()
    file_size = len(file_content)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Cannot upload an empty file.")

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({file_size / (1024*1024):.1f}MB) exceeds 15 MB limit."
        )

    file_id = generate_id("doc")
    safe_filename = f"{file_id}{ext}"
    patient_dir = os.path.join(UPLOAD_ROOT, patient_id)
    os.makedirs(patient_dir, exist_ok=True)

    safe_target_path = os.path.abspath(os.path.join(patient_dir, safe_filename))

    # Path traversal protection
    if not safe_target_path.startswith(os.path.abspath(UPLOAD_ROOT)):
        raise HTTPException(status_code=400, detail="Invalid file destination path.")

    with open(safe_target_path, "wb") as f:
        f.write(file_content)

    return file_id, safe_target_path, file_size, mime_type
