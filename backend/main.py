import os
import io
import base64
import torch
import torch.nn as nn
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

# --- IMPORT DATABASE & ROUTERS ---
from database.db import init_db
from routers.auth_router import router as auth_router
from routers.admin_router import router as admin_router
from routers.doctor_router import router as doctor_router
from routers.patient_router import router as patient_router
from routers.appointment_router import router as appointment_router
from routers.notification_router import router as notification_router
from routers.emr_router import router as emr_router
from routers.prescription_router import router as prescription_router
from routers.medical_document_router import router as medical_document_router
from routers.timeline_router import router as timeline_router

# --- IMPORT EXISTING ADVANCED MODULES ---
from src.model import DermaBackboneClassifier
from src.transforms import get_val_transforms

# Initialize database schema
init_db()

app = FastAPI(
    title="PARAKH (परख) AI Dermatology & Healthcare Platform",
    description="Intelligent Dermatology. Better Skin Health. Complete multi-role clinic management and AI diagnostic engine.",
    version="1.0.0"
)

# Enable CORS for React Frontend with credential and cookie support
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(doctor_router)
app.include_router(patient_router)
app.include_router(appointment_router)
app.include_router(notification_router)
app.include_router(emr_router)
app.include_router(prescription_router)
app.include_router(medical_document_router)
app.include_router(timeline_router)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "dermapulse_efficientnet.pth")

# Metadata mapping for the 7 classes (Order: akiec=0, bcc=1, bkl=2, df=3, mel=4, nv=5, vasc=6)
CLASSES = [
    {"id": "akiec", "name": "Actinic Keratosis", "risk": "Moderate", "score": 55, "rec": "Pre-cancerous lesion. Follow up with skin care specialist."},
    {"id": "bcc", "name": "Basal Cell Carcinoma", "risk": "Moderate", "score": 65, "rec": "Common skin cancer. Consult a dermatologist for surgical evaluation or localized therapy."},
    {"id": "bkl", "name": "Benign Keratosis", "risk": "Low", "score": 10, "rec": "Benign condition. No treatment required unless irritated."},
    {"id": "df", "name": "Dermatofibroma", "risk": "Low", "score": 15, "rec": "Harmless nodule. Regular self-examination recommended."},
    {"id": "mel", "name": "Melanoma", "risk": "Critical", "score": 95, "rec": "Urgent dermatological evaluation and biopsy recommended."},
    {"id": "nv", "name": "Melanocytic Nevus", "risk": "Low", "score": 12, "rec": "Routine monitoring during annual skin checks."},
    {"id": "vasc", "name": "Vascular Lesion", "risk": "Low", "score": 10, "rec": "Typically benign. Monitor for abrupt changes."}
]

# --- 1. LOAD EFFICIENTNET-V2 BACKBONE ---
def load_model():
    model = DermaBackboneClassifier(model_name='tf_efficientnetv2_s', num_classes=7, pretrained=False)
    
    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
        print(f"[OK] Successfully loaded custom trained weights from {MODEL_PATH}")
    else:
        print(f"[WARNING] Model weights not found at {MODEL_PATH}.")
        
    model.to(DEVICE)
    model.eval()
    return model

model = load_model()

# --- 2. LOAD ALBUMENTATIONS TRANSFORMS ---
val_transforms = get_val_transforms(image_size=224)

def ndarray_to_base64(img_array):
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode('.png', img_bgr)
    b64_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{b64_str}"

@app.get("/")
def read_root():
    return {
        "status": "PARAKH Healthcare Platform Operational",
        "platform": "PARAKH (परख)",
        "tagline": "Intelligent Dermatology. Better Skin Health.",
        "device": str(DEVICE)
    }

MAX_UPLOAD_SIZE = 15 * 1024 * 1024  # 15 MB
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

@app.post("/api/v1/diagnose")
async def analyze_image(file: UploadFile = File(...)):
    # 1. Validate file extension and MIME type
    ext = os.path.splitext(file.filename or "")[1].lower()
    if file.content_type not in ALLOWED_IMAGE_MIMES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported image formats: JPEG, PNG, WebP, BMP."
        )

    contents = await file.read()
    # 2. Enforce maximum payload limit (15 MB) to prevent memory exhaustion DoS
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file size exceeds the maximum allowed limit of 15 MB."
        )

    try:
        raw_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Corrupted or invalid image file. Unable to decode image.")

    try:
        resized_img = raw_img.resize((224, 224))
        
        # Apply Albumentations Transformations
        image_np = np.array(resized_img)
        transformed = val_transforms(image=image_np)
        input_tensor = transformed['image'].unsqueeze(0).to(DEVICE)
        
        with torch.no_grad():
            outputs = model(input_tensor)
            logits = outputs[0] if isinstance(outputs, tuple) else outputs
            probabilities = torch.softmax(logits, dim=1)[0]

        # --- OPTIMIZED CLINICAL DECISION THRESHOLDS ---
        class_thresholds = np.array([0.50, 0.30, 0.60, 0.50, 0.20, 0.65, 0.50])
        probs_np = probabilities.cpu().numpy()
        
        threshold_ratios = probs_np / class_thresholds
        pred_idx = int(np.argmax(threshold_ratios))
        
        # Send raw decimal confidence (e.g., 0.45)
        confidence = float(probs_np[pred_idx])
        predicted_info = CLASSES[pred_idx]

        # --- 3. SAFE GRAD-CAM TARGET LAYER ---
        try:
            target_layers = [model.backbone.conv_head]
        except AttributeError:
            target_layers = [list(model.children())[-2]]
        
        cam = GradCAM(model=model, target_layers=target_layers)
        grayscale_cam = cam(input_tensor=input_tensor, targets=[ClassifierOutputTarget(pred_idx)])[0]
        
        rgb_img_np = np.float32(resized_img) / 255.0
        cam_visualization = show_cam_on_image(rgb_img_np, grayscale_cam, use_rgb=True)
        gradcam_b64 = ndarray_to_base64(cam_visualization)

        # Class Probabilities Breakdown as raw decimals
        prob_dict = {}
        for i, class_info in enumerate(CLASSES):
            prob_dict[class_info["name"]] = float(probs_np[i])

        return {
            "prediction": predicted_info["name"],
            "confidence": confidence,
            "risk_score": predicted_info["score"],
            "risk_level": predicted_info["risk"],
            "recommendation": predicted_info["rec"],
            "heatmap_base64": gradcam_b64,
            "probabilities": prob_dict
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
