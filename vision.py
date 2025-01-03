import onnxruntime as ort
import json
import torch
from matplotlib import font_manager
from PIL import Image, ImageDraw, ImageFont
import json
from transformers import DetrImageProcessor
from fastapi import FastAPI, Query
import time

app = FastAPI()

class Output:
    def __init__(self, logits, pred_boxes):
        self.logits = logits
        self.pred_boxes = pred_boxes

# Open and read the JSON file
with open('./detr-resnet-101/config.json', 'r') as file:
    model_config = json.load(file)

onnx_model_path = "./detr-resnet-101/model.onnx"
ort_session = ort.InferenceSession(onnx_model_path)

# Initialize processor
processor = DetrImageProcessor.from_pretrained("facebook/detr-resnet-101", revision="no_timm")

def analyze_image(image_path):
    print(f"Starting image analyzation for: {image_path}")
    start_time = time.time()
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="np")


    # Run inference
    ort_inputs = {ort_session.get_inputs()[0].name: inputs['pixel_values']}
    ort_outs = ort_session.run(None, ort_inputs)

    # Convert outputs (bounding boxes and class logits) to COCO API format
    # Only keep detections with score > 0.7
    target_sizes = torch.tensor([image.size[::-1]])
    outputs = Output(torch.tensor(ort_outs[0]), torch.tensor(ort_outs[1]))
    results = processor.post_process_object_detection(
        outputs, 
        target_sizes=target_sizes, 
        threshold=0.7
    )[0]

    # Draw bounding boxes and labels on the image
    draw = ImageDraw.Draw(image)
    font_size = max(20, image.size[0] // 50)  # Adjust font size based on image width
    file = font_manager.findfont('Helvetica Neue')
    font = ImageFont.truetype(file, font_size)

    matches = []

    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        box = [round(i, 2) for i in box.tolist()]
        confidence = round(score.item(), 3)

        label_name = model_config["id2label"].get(str(label.item()))
        matches.append({"label": label_name, "confidence": confidence})
        
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
    print(f"Analyzed image saved at: {new_file_path}")

    end_time = time.time()
    inference_time = end_time - start_time
    print(f"Inference time: {inference_time:.4f} seconds")

    return {
        "file": new_file_path,
        "matches": matches
    }


@app.get("/")
def read_root(imagePath: str = Query(..., description="Path to the image to be analyzed")):
    return analyze_image(imagePath)