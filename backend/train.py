import os
import torch
import numpy as np
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import datasets
import torch.optim as optim
from tqdm import tqdm

# Import our custom advanced modules
from src.model import DermaBackboneClassifier
from src.transforms import get_train_transforms, get_val_transforms
from src.loss import get_weighted_loss
from src.optimize_thresholds import optimize_thresholds

# --- 1. CONFIGURATION ---
DATA_DIR = "dataset" # Folder containing 'train' and 'val' subfolders
EPOCHS = 50
BATCH_SIZE = 32
LEARNING_RATE = 1e-4
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SAVE_PATH = "models/dermapulse_efficientnet.pth"

# --- 2. CUSTOM DATASET FOR ALBUMENTATIONS ---
# Standard PyTorch ImageFolder uses PIL, but Albumentations needs Numpy arrays
class AlbumentationsDataset(datasets.ImageFolder):
    def __init__(self, root, transform=None):
        super().__init__(root)
        self.transform = transform

    def __getitem__(self, index):
        path, target = self.samples[index]
        image = np.array(Image.open(path).convert("RGB"))
        
        if self.transform is not None:
            augmented = self.transform(image=image)
            image = augmented['image']
            
        return image, target

def train_model():
    print(f"Initializing Training Pipeline on {DEVICE}...")

    # Ensure save directory exists
    os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)

    # --- 3. LOAD DATA & TRANSFORMS ---
    train_transform = get_train_transforms()
    val_transform = get_val_transforms()

    train_dataset = AlbumentationsDataset(os.path.join(DATA_DIR, 'train'), transform=train_transform)
    val_dataset = AlbumentationsDataset(os.path.join(DATA_DIR, 'val'), transform=val_transform)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

    # Calculate class distribution for Weighted Loss
    class_counts = [0] * len(train_dataset.classes)
    for _, target in train_dataset.samples:
        class_counts[target] += 1
        
    print(f"Dataset Class Counts: {class_counts}")

    # --- 4. INITIALIZE MODEL, LOSS, & OPTIMIZER ---
    model = DermaBackboneClassifier(model_name='tf_efficientnetv2_s', num_classes=7, pretrained=True)
    model = model.to(DEVICE)
    
    criterion = get_weighted_loss(class_counts).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

    # --- 5. TRAINING LOOP ---
    best_val_loss = float('inf')

    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        
        print(f"\nEpoch {epoch+1}/{EPOCHS}")
        progress_bar = tqdm(train_loader, desc="Training")
        
        for images, labels in progress_bar:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            progress_bar.set_postfix(loss=loss.item())

        # --- 6. VALIDATION & THRESHOLD OPTIMIZATION ---
        model.eval()
        val_loss = 0.0
        all_preds = []
        all_labels = []

        with torch.no_grad():
            for images, labels in tqdm(val_loader, desc="Validating"):
                images, labels = images.to(DEVICE), labels.to(DEVICE)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                
                probs = torch.softmax(outputs, dim=1)
                all_preds.extend(probs.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        avg_val_loss = val_loss / len(val_loader)
        print(f"Validation Loss: {avg_val_loss:.4f}")

        # Save the best model
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save(model.state_dict(), SAVE_PATH)
            print(f"🔥 New best model saved to {SAVE_PATH}")

    # After all epochs, run F1-Score threshold optimization on the final validation set
    print("\nOptimizing Clinical Decision Thresholds...")
    optimized_thresholds = optimize_thresholds(np.array(all_labels), np.array(all_preds), num_classes=7)
    print(f"✅ Final Optimized Class Thresholds: {optimized_thresholds}")
    print("Copy these thresholds into your main.py decision logic!")

if __name__ == "__main__":
    # Note: Requires a 'dataset' folder with 'train' and 'val' subfolders containing the 7 disease classes
    train_model()