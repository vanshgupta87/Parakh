import os
import shutil
import pandas as pd
from sklearn.model_selection import train_test_split
from tqdm import tqdm

def setup_dataset():
    # Paths
    raw_dir = "raw_data"
    csv_path = os.path.join(raw_dir, "HAM10000_metadata.csv")
    base_out_dir = "dataset"

    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found. Please put the CSV and images in the 'raw_data' folder.")
        return

    print("Reading metadata...")
    df = pd.read_csv(csv_path)

    # Perform an 80/20 stratified split (keeps the ratio of rare diseases balanced in both sets)
    train_df, val_df = train_test_split(df, test_size=0.2, stratify=df['dx'], random_state=42)

    def move_images(dataframe, split_name):
        print(f"\nOrganizing {split_name} set ({len(dataframe)} images)...")
        
        for _, row in tqdm(dataframe.iterrows(), total=len(dataframe)):
            img_id = row['image_id']
            disease = row['dx']
            
            src_path = os.path.join(raw_dir, f"{img_id}.jpg")
            dest_dir = os.path.join(base_out_dir, split_name, disease)
            
            # Create the disease subfolder if it doesn't exist
            os.makedirs(dest_dir, exist_ok=True)
            
            # Copy the image if it exists in raw_data
            if os.path.exists(src_path):
                shutil.copy(src_path, os.path.join(dest_dir, f"{img_id}.jpg"))
            else:
                print(f"Missing image: {src_path}")

    # Run the organization
    move_images(train_df, "train")
    move_images(val_df, "val")
    print("\n✅ Dataset successfully organized! You are ready to run train.py.")

if __name__ == "__main__":
    setup_dataset()