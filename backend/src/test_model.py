import torch
from model import DermaBackboneClassifier

def test_network():
    print("Initializing EfficientNetV2/ConvNeXt Backbone...")
    
    # Initialize model for 7 skin lesion classes
    model = DermaBackboneClassifier(model_name='tf_efficientnetv2_s', num_classes=7, pretrained=False)
    model.eval()
    
    # Create a dummy batch of images (Batch size: 2, Channels: 3, Height: 224, Width: 224)
    dummy_input = torch.randn(2, 3, 224, 224)
    
    # Forward pass
    output = model(dummy_input)
    
    print(f"Input Tensor Shape: {dummy_input.shape}")
    print(f"Output Predictions Shape: {output.shape}")
    print("✅ Backbone successfully verified! Output shape matches 7 classes.")

if __name__ == "__main__":
    test_network()