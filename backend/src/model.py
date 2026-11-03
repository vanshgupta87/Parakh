import torch
import torch.nn as nn
import timm

class DermaBackboneClassifier(nn.Module):
    def __init__(self, model_name='tf_efficientnetv2_s', num_classes=7, pretrained=True, freeze_backbone=False):
        super().__init__()
        
        # Load the state-of-the-art backbone using timm
        self.backbone = timm.create_model(
            model_name, 
            pretrained=pretrained, 
            num_classes=0 # timm automatically pools and flattens features here
        )
        
        # Get the feature dimension output size dynamically (1280 for efficientnetv2_s)
        in_features = self.backbone.num_features
        
        if freeze_backbone:
            for param in self.backbone.parameters():
                param.requires_grad = False
                
        # Custom Clinical Classification Head
        # Removed AdaptiveAvgPool2d and Flatten since timm handles it
        self.head = nn.Sequential(
            nn.Dropout(p=0.4), # Prevents overfitting
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.2),
            nn.Linear(512, num_classes) # Outputs probabilities for 7 classes
        )

    def forward(self, x):
        features = self.backbone(x)
        out = self.head(features)
        return out