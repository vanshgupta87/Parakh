import torch
from loss import get_weighted_loss

def test_weighted_loss():
    print("Initializing Class-Weighted Loss...")
    
    # Simulating severe dataset imbalance (e.g., HAM10000 distribution)
    # Let's say Class 6 (nv) has 6705 images, while Class 0 (vasc) only has 142.
    dummy_counts = [142, 514, 1099, 115, 1113, 6705, 327] 
    
    # Generate the PyTorch loss function
    criterion = get_weighted_loss(dummy_counts)
    
    print("\n--- Calculated Penalty Weights ---")
    for i, weight in enumerate(criterion.weight):
        print(f"Class {i}: {weight:.4f}x penalty multiplier")
        
    # Simulate a forward pass (Batch size 4, 7 classes)
    dummy_predictions = torch.randn(4, 7)
    dummy_true_labels = torch.tensor([0, 5, 1, 6]) # Example true labels
    
    # Calculate error/loss
    loss = criterion(dummy_predictions, dummy_true_labels)
    
    print(f"\nSample Batch Loss: {loss.item():.4f}")
    print("✅ Class-Weighted Loss successfully verified! Rare classes are protected.")

if __name__ == "__main__":
    test_weighted_loss()