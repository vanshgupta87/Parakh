import os
import torch
import numpy as np
from sklearn.metrics import f1_score, recall_score
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder
from PIL import Image

from src.model import DermaBackboneClassifier
from src.transforms import get_val_transforms

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = os.path.join("models", "dermapulse_efficientnet.pth")
VAL_DIR = "dataset/val"

# Load Model
model = DermaBackboneClassifier(model_name='tf_efficientnetv2_s', num_classes=7, pretrained=False)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.to(DEVICE)
model.eval()

# Load Validation Set
val_transforms = get_val_transforms(image_size=224)

class PyTorchValDataset(torch.utils.data.Dataset):
    def __init__(self, folder):
        self.ds = ImageFolder(folder)
    def __len__(self):
        return len(self.ds)
    def __getitem__(self, idx):
        img_path, label = self.ds.imgs[idx]
        img = Image.open(img_path).convert("RGB")
        transformed = val_transforms(image=np.array(img))
        return transformed['image'], label

val_loader = DataLoader(PyTorchValDataset(VAL_DIR), batch_size=32, shuffle=False)

# Collect Softmax Probabilities
all_probs = []
all_targets = []

print("Extracting validation probabilities...")
with torch.no_grad():
    for images, labels in val_loader:
        images = images.to(DEVICE)
        outputs = model(images)
        probs = torch.softmax(outputs, dim=1).cpu().numpy()
        all_probs.append(probs)
        all_targets.append(labels.numpy())

all_probs = np.vstack(all_probs)
all_targets = np.concatenate(all_targets)

# Grid Search for Optimal Threshold Ratios
# Search bounds: Melanoma (idx 4) and BCC (idx 1) prioritize low thresholds (high recall)
print("Optimizing Joint Clinical Macro F1 Score...")

best_macro_f1 = 0.0
best_thresholds = None

# Grid range for sensitive classes vs benign classes
mel_range = np.linspace(0.15, 0.40, 6)
bcc_range = np.linspace(0.20, 0.45, 6)
nv_range  = np.linspace(0.50, 0.80, 7)

for t_mel in mel_range:
    for t_bcc in bcc_range:
        for t_nv in nv_range:
            t_vec = np.array([0.50, t_bcc, 0.60, 0.50, t_mel, t_nv, 0.50])
            
            # Predict using probability ratio rule
            ratios = all_probs / t_vec
            preds = np.argmax(ratios, axis=1)
            
            # Calculate Macro F1
            macro_f1 = f1_score(all_targets, preds, average='macro')
            mel_recall = recall_score(all_targets == 4, preds == 4)
            
            # Require minimum 80% recall on Melanoma
            if mel_recall >= 0.80 and macro_f1 > best_macro_f1:
                best_macro_f1 = macro_f1
                best_thresholds = t_vec

print("\n==========================================")
print(f"🎯 OPTIMAL CLINICAL MACRO F1: {best_macro_f1:.4f}")
print(f"🔥 RECOMMENDED THRESHOLDS: {list(np.round(best_thresholds, 2))}")
print("==========================================\n")