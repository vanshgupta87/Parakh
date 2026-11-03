import os
import torch
import numpy as np
from sklearn.metrics import classification_report, accuracy_score
from src.model import DermaBackboneClassifier
from src.transforms import get_val_transforms
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder
from PIL import Image

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = os.path.join("models", "dermapulse_efficientnet.pth")
VAL_DIR = "dataset/val" # Path to validation dataset

print("Initializing Evaluation...")

# 1. Load model
model = DermaBackboneClassifier(model_name='tf_efficientnetv2_s', num_classes=7, pretrained=False)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.to(DEVICE)
model.eval()

# 2. Load validation data
val_transforms = get_val_transforms(image_size=224)

class PyTorchValDataset(torch.utils.data.Dataset):
    def __init__(self, folder):
        self.ds = ImageFolder(folder)
    def __len__(self):
        return len(self.ds)
    def __getitem__(self, idx):
        img_path, label = self.ds.imgs[idx]
        # Open image with PIL, convert to RGB, then to NumPy array
        img = Image.open(img_path).convert("RGB")
        img_np = np.array(img)
        transformed = val_transforms(image=img_np)
        return transformed['image'], label

val_dataset = PyTorchValDataset(VAL_DIR)
val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

all_preds = []
all_targets = []

print("Running inference on validation set... This will just take a moment.")

with torch.no_grad():
    for images, labels in val_loader:
        images = images.to(DEVICE)
        outputs = model(images)
        preds = torch.argmax(outputs, dim=1).cpu().numpy()
        all_preds.extend(preds)
        all_targets.extend(labels.numpy())

# 3. Calculate and print metrics
acc = accuracy_score(all_targets, all_preds)
print(f"\n==========================================")
print(f"🎯 EXACT MODEL ACCURACY: {acc * 100:.2f}%")
print(f"==========================================\n")
print(classification_report(all_targets, all_preds, target_names=["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]))


#can show the accuracy of the model on the validation set by running the eval.py file
