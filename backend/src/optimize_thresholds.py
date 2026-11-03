import numpy as np
from sklearn.metrics import f1_score

def optimize_thresholds(y_true, y_probs, num_classes=7):
    """
    Finesse classification thresholds per class to maximize F1-score 
    and protect critical malignant categories like Melanoma (mel).
    """
    best_thresholds = [0.5] * num_classes
    
    for c in range(num_classes):
        best_f1 = 0
        best_t = 0.5
        for t in np.arange(0.1, 0.9, 0.05):
            preds = (y_probs[:, c] >= t).astype(int)
            targets = (y_true == c).astype(int)
            score = f1_score(targets, preds, zero_division=0)
            
            if score > best_f1:
                best_f1 = score
                best_t = t
                
        best_thresholds[c] = best_t
        
    print("Optimized Class-Specific Thresholds:", best_thresholds)
    return best_thresholds