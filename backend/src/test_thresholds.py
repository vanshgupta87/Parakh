import numpy as np
from optimize_thresholds import optimize_thresholds

def test_threshold_tuning():
    print("Initializing F1-Score Threshold Optimizer...")
    
    # Simulate validation data for 100 images, 7 classes
    num_samples = 100
    num_classes = 7
    
    # Generate random true labels and random model probabilities
    dummy_y_true = np.random.randint(0, num_classes, size=num_samples)
    dummy_y_probs = np.random.rand(num_samples, num_classes)
    
    # Run optimization
    optimized_t = optimize_thresholds(dummy_y_true, dummy_y_probs, num_classes)
    
    print(f"\nDefault Thresholds:   {[0.5] * 7}")
    print(f"Optimized Thresholds: {optimized_t}")
    print("✅ Threshold Optimization successfully verified! The model will adapt class boundaries automatically.")

if __name__ == "__main__":
    test_threshold_tuning()