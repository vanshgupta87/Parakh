<div align="center">

<img width="100%" alt="divider" src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif">

# DERMAPULSE

### `AI-Powered Dermatological Screening & Explainable Diagnostics`

<em>Precision skin lesion classification, backed by visual proof — not blind trust.</em>

<br>

<img src="https://img.shields.io/badge/BUILD-RESEARCH_GRADE-6C5CE7?style=for-the-badge&labelColor=1a1a2e">
<img src="https://img.shields.io/badge/MODEL-EfficientNetV2-e17055?style=for-the-badge&labelColor=1a1a2e">
<img src="https://img.shields.io/badge/API-FastAPI-00b894?style=for-the-badge&labelColor=1a1a2e">
<img src="https://img.shields.io/badge/UI-React_%2B_Tailwind-0984e3?style=for-the-badge&labelColor=1a1a2e">

<br><br>

`7-CLASS TAXONOMY`  •  `GRAD-CAM EXPLAINABILITY`  •  `UNCERTAINTY-AWARE`  •  `CLINICAL TRIAGE`

</div>

<br>

## 🧭 Table of Contents

<table>
<tr>
<td width="25%" align="center"><a href="#-overview">🔎<br>Overview</a></td>
<td width="25%" align="center"><a href="#-key-features">🧩<br>Key Features</a></td>
<td width="25%" align="center"><a href="#-system-architecture">🏗️<br>Architecture</a></td>
<td width="25%" align="center"><a href="#-machine-learning-pipeline">🧠<br>ML Pipeline</a></td>
</tr>
</table>

<br>

## 🔎 Overview

Dermatological misdiagnosis is rarely a knowledge problem — it's a **bandwidth and consistency** problem. Specialists are scarce, image quality varies, and even trained eyes disagree on ambiguous lesions.

**Parakh** is a full-stack diagnostic co-pilot that classifies dermatoscopic lesion images across **7 clinical categories** using a custom-trained **EfficientNetV2** model, then explains *why* — through Grad-CAM heatmaps, calibrated uncertainty bounds, and automated risk triage — inside a cinematic, glassmorphic interface built for real clinical presentation.

> The goal isn't to replace a dermatologist. It's to make sure the *right* cases reach one — fast, and with evidence attached.

<br>

## 🧩 Key Features

<details open>
<summary><b>🧠 Core Diagnostic Intelligence</b></summary>
<br>

| Feature | What It Does |
|---|---|
| 🎯 **Clinical-Grade Classification** | Multi-class prediction across all **7 HAM10000 categories**, powered by a fine-tuned EfficientNetV2 backbone with a custom classification head. |
| 🔥 **Grad-CAM Explainability Engine** | Every prediction ships with a gradient-weighted activation heatmap, pinpointing exactly which pixels drove the model's verdict. |
| 🎚️ **Custom Diagnostic Thresholding** | Per-class decision thresholds calibrated to minimize false negatives on high-risk lesion types. |
| 📐 **Uncertainty Quantification** | 50-pass Monte Carlo Dropout inference yields a **95% Epistemic Confidence Interval** and variance score — low-certainty predictions auto-flag for clinical over-read. |

</details>

<details open>
<summary><b>🩻 Advanced Clinical Decision-Support</b></summary>
<br>

| Feature | What It Does |
|---|---|
| 🎨 **Customizable Grad-CAM Controls** | Live palette switching (**Jet · Inferno · Viridis · Magma**) plus an adjustable Peak Activation Threshold slider for fine-tuned boundary analysis. |
| 🚦 **Automated Risk Triaging** | Generates a **Priority Score (0–100)** with severity labeling and time-bound guidance — e.g. *"Dermatologist Follow-Up Recommended within 4–6 Weeks."* |
| 📍 **Geospatial Provider Matchmaking** | In-dashboard map surfacing nearby certified dermatology specialists, prioritized by assessed risk level. |
| 📈 **Longitudinal Lesion Tracking** | A visual timeline tracking morphology, size, color, and structural drift across repeated scans. |
| 🧬 **Patient Metadata Fusion** | Blends CV predictions with demographic and history data for a holistic, context-aware evaluation. |
| 📄 **Automated Report Generator** | One click compiles classification, confidence intervals, heatmap, and risk guidance into a shareable clinical report. |

</details>

<details open>
<summary><b>🎨 Presentation & Experience Layer</b></summary>
<br>

| Feature | What It Does |
|---|---|
| 📊 **Animated Probability Bars** | Framer Motion–driven confidence distribution across all 7 classes — the full picture, not just the top guess. |
| 🖼️ **Interactive Diagnostic Viewer** | Side-by-side comparison of the raw lesion image against its Grad-CAM overlay. |
| 💎 **Glassmorphism Interface** | Frosted-glass Tailwind design with soft depth and layered blur for a calm, premium clinical feel. |
| 🎬 **Fluid Motion Design** | Choreographed transitions across upload, inference, and reveal states. |

</details>

<br>

## 🚀 Quick Start Guide

### 1. Backend Setup & Startup
```powershell
cd backend
python seed_admin.py
python main.py
```
*Backend runs on `http://localhost:8000` (docs at `http://localhost:8000/docs`).*

### 2. Frontend Setup & Startup
```powershell
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

### 3. Run Automated Auth Test Suite
```powershell
cd backend
python test_auth_suite.py
```

<br>

## 🏗️ System Architecture

<div align="center">

```
┌─────────────────────────────┐        ┌─────────────────────────────┐        ┌─────────────────────────────┐
│         🎨 FRONTEND          │        │          ⚙️ BACKEND          │        │      🧠 ML INFERENCE CORE     │
│  React · Tailwind · Framer  │  REST  │     FastAPI · Uvicorn        │ Tensor │          PyTorch             │
│                              │ ─────▶ │                              │ ─────▶ │                              │
│  Upload · Viewer · Bars     │        │  Validate · Preprocess ·     │        │  EfficientNetV2 · MC Dropout │
│  Risk Panel · Map · Report  │ ◀───── │  Orchestrate · Serialize    │ ◀───── │  Grad-CAM · Thresholding     │
└─────────────────────────────┘  JSON  └─────────────────────────────┘  Logits └─────────────────────────────┘
```

</div>

**Request Lifecycle**

| Step | Layer | Action |
|:---:|---|---|
| **1** | Frontend | Lesion image uploaded; UI transitions to a processing state via Framer Motion |
| **2** | Backend | FastAPI validates the payload and runs Albumentations-based preprocessing |
| **3** | ML Core | EfficientNetV2 produces class logits; parallel Grad-CAM hooks fire; MC Dropout runs 50 stochastic passes for uncertainty bounds |
| **4** | Backend | Probabilities, confidence intervals, risk score, and heatmap buffer are serialized into one JSON response |
| **5** | Frontend | Probability bars, diagnostic viewer, risk panel, and provider map animate into place |

<br>

## 🧠 Machine Learning Pipeline

<div align="center">

**📚 Dataset&nbsp; → &nbsp;⚖️ Imbalance Handling&nbsp; → &nbsp;🏗️ Architecture&nbsp; → &nbsp;🎓 Training&nbsp; → &nbsp;🎚️ Thresholding&nbsp; → &nbsp;🔥 Explainability**

</div>

<br>

**📚 Dataset — HAM10000**
7-class dermatoscopic benchmark, marked by severe class imbalance between common benign nevi and rare, high-risk lesions like melanoma.

**⚖️ Imbalance Handling**
- Inverse-frequency **weighted loss** to penalize minority-class errors harder
- **Stratified sampling** to keep rare classes consistently represented per batch
- **Albumentations-driven augmentation** — rotation, flip, brightness/contrast jitter, artifact simulation

**🏗️ Architecture**
- **Backbone:** Custom-trained EfficientNetV2, chosen for its accuracy-to-compute efficiency on medical imaging
- **Head:** Bespoke fully-connected classifier fine-tuned for the 7-class taxonomy
- **Strategy:** Pretrained initialization with progressive layer unfreezing

**🎓 Training**
- **50 epochs** with best-checkpoint retention
- Learning-rate scheduling for stable convergence
- Validation tracked via accuracy, macro-F1, and per-class recall

**🎚️ Custom Thresholding**
Calibrated per-class decision boundaries — biased deliberately toward minimizing false negatives on malignant classes.

**🔥 Grad-CAM + Uncertainty**
Gradient-weighted activation maps from the final convolutional block, paired with 50-pass Monte Carlo Dropout inference to quantify epistemic uncertainty alongside every visual explanation.

<br>

<div align="center">

## ⚠️ Medical Disclaimer

</div>

> **Parakh is an academic research prototype — not a certified medical device.**
> It has not been evaluated or approved by any regulatory health authority (FDA, CE, or equivalent) and must never substitute for professional medical diagnosis or treatment. All outputs — classifications, confidence intervals, risk scores, and heatmaps — are experimental results from a model trained on a public research dataset and may be inaccurate or incomplete. **Anyone concerned about a skin lesion should consult a licensed dermatologist.** The creators assume no liability for decisions made based on this tool.

<br>

<div align="center">

<img width="100%" alt="divider" src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif">

**Parakh** — *Precision. Transparency. Trust.*

<sub>🔒 Private Research Project — All Rights Reserved</sub>

</div>
