from transformers import DetrImageProcessor, DetrForObjectDetection
import torch
from matplotlib import font_manager
from PIL import Image, ImageDraw, ImageFont
import requests
import sys
import json

# Load the image
image_path =  sys.argv[1]
image = Image.open(image_path)

# Initialize processor and model
processor = DetrImageProcessor.from_pretrained("facebook/detr-resnet-50", revision="no_timm")
model = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50", revision="no_timm")

# Prepare inputs
inputs = processor(images=image, return_tensors="pt")
outputs = model(**inputs)

# Convert outputs (bounding boxes and class logits) to COCO API format
# Only keep detections with score > 0.7
target_sizes = torch.tensor([image.size[::-1]])
results = processor.post_process_object_detection(outputs, target_sizes=target_sizes, threshold=0.7)[0]

# Draw bounding boxes and labels on the image
draw = ImageDraw.Draw(image)
font_size = max(20, image.size[0] // 50)  # Adjust font size based on image width
file = font_manager.findfont('Helvetica Neue')
font = ImageFont.truetype(file, font_size)

matches = []

for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
    box = [round(i, 2) for i in box.tolist()]
    confidence = round(score.item(), 3)
    # print(
    #     f"Detected {model.config.id2label[label.item()]} with confidence "
    #     f"{round(score.item(), 3)} at location {box}"
    # )

    label_name = model.config.id2label[label.item()]
    # if label_name == "kite":
    matches.append({ "label": label_name, "confidence": confidence })
    # Draw the bounding box
    draw.rectangle(box, outline="blue", width=1)
    
    # Draw the label and confidence score
    label_text = f"{label_name} ({round(score.item(), 2)})"
    text_width = draw.textlength(label_text, font=font)
    text_height = font.getbbox(label_text)[3]
    draw.text((box[0], box[1] - text_height), label_text, fill="white", font=font)

# Save or display the resulting image
new_file_path = image_path.replace(".jpg", "_analyzed.jpg")
image.save(new_file_path)
print(json.dumps({
    "file": new_file_path,
    "matches": matches
}))