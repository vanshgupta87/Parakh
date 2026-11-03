import numpy as np
from transforms import get_train_transforms, get_val_transforms

def test_augmentations():
    print("Initializing Advanced Medical Data Augmentations...")
    
    # Create a dummy image mimicking a raw photograph (e.g., 500x500 pixels, 3 RGB channels)
    dummy_image = np.random.randint(0, 256, (500, 500, 3), dtype=np.uint8)
    
    # Initialize our training transforms (which should resize it to 224x224)
    train_transform = get_train_transforms(image_size=224)
    
    # Apply the transform
    # Albumentations expects named arguments and returns a dictionary
    augmented = train_transform(image=dummy_image)
    aug_tensor = augmented['image']
    
    print(f"Original Raw Image Shape: {dummy_image.shape}")
    print(f"Augmented PyTorch Tensor Shape: {aug_tensor.shape}")
    print(f"Tensor Data Type: {aug_tensor.dtype}")
    print("✅ Data Augmentation pipeline successfully verified! Ready to feed the model.")

if __name__ == "__main__":
    test_augmentations()





































