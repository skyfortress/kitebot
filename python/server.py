from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
import time
from vision_new import setup_model, post_process, CLASSES
import os
import cv2
import numpy as np
import argparse

# Initialize model outside of app
parser = argparse.ArgumentParser()
parser.add_argument('--model_path', type=str, default='./model/vision.rknn')
args = parser.parse_args([])
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global model
    model, _ = setup_model(args)
    yield
    # Shutdown
    if model:
        model.release()

app = FastAPI(lifespan=lifespan)

def analyze_image(image_path):
    print(f"Starting image analyzation for: {image_path}")
    start_time = time.time()

    img_src = cv2.imread(image_path)
    if img_src is None:
        raise Exception("Failed to load image")

    img = cv2.cvtColor(img_src, cv2.COLOR_BGR2RGB)
    outputs = model.run([img])
    boxes, classes, scores = post_process(outputs)

    matches = []
    if boxes is not None:
        for box, score, cl in zip(boxes, scores, classes):
            matches.append({"label": CLASSES[cl], "confidence": float(score)})

            # Draw visualization
            top, left, right, bottom = [int(_b) for _b in box]
            cv2.rectangle(img_src, (top, left), (right, bottom), (255, 0, 0), 2)
            cv2.putText(img_src, f'{CLASSES[cl]} {score:.2f}',
                        (top, left - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    analyzed_path = image_path.replace(".jpg", "_analyzed.jpg")
    cv2.imwrite(analyzed_path, img_src)

    end_time = time.time()
    print(f"Inference time: {end_time - start_time:.4f} seconds")

    return {
        "file": image_path,
        "analyzedFile": analyzed_path,
        "matches": matches
    }

@app.get("/")
def read_root(imagePath: str = Query(..., description="Path to the image to be analyzed")):
    return analyze_image(imagePath)