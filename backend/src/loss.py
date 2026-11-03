import torch
import torch.nn as nn
import numpy as np

def get_weighted_loss(class_counts):
    """
    class_counts: list or tensor containing the count of samples in each of the 7 classes.
    """
    total_samples = sum(class_counts)
    num_classes = len(class_counts)
    
    # Compute inverse frequency weights
    weights = [total_samples / (num_classes * count) if count > 0 else 1.0 for count in class_counts]
    class_weights = torch.FloatTensor(weights)
    
    # Return weighted cross entropy loss
    return nn.CrossEntropyLoss(weight=class_weights)