from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
import time
from vision_new import setup_model, post_process, verify_image_size, CLASSES
import cv2

model = None
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global model
    model, _ = setup_model(model_path='./model/yolo11.rknn')
    yield
    # Shutdown
    if model:
        model.release()

app = FastAPI(lifespan=lifespan)

def analyze_image(image_path):
    print(f"Starting image analyzation for: {image_path}")
    start_time = time.time()

    real_path = image_path.replace("/usr/src/web/images", "../../data")
    img_src = cv2.imread(real_path)

    if img_src is None:
        raise Exception("Failed to load image")

    # Get original image dimensions
    original_height, original_width = img_src.shape[:2]

    img = verify_image_size(img_src.copy())
    # Get padded image dimensions
    padded_height, padded_width = img.shape[:2]

    # Calculate letterboxing offset (padding)
    # For a landscape image, letterboxing adds padding at top and bottom
    vertical_padding = (padded_height - (padded_width * original_height / original_width)) / 2

    outputs = model.run([img])
    boxes, classes, scores = post_process(outputs)

    matches = []
    if boxes is not None:
        for box, score, cl in zip(boxes, scores, classes):
            matches.append({"label": CLASSES[cl], "confidence": float(score)})

            # Scale bounding box coordinates to original image dimensions
            top, left, right, bottom = [int(_b) for _b in box]

            # Adjust vertical coordinates to account for letterboxing
            left = max(0, left - vertical_padding)
            bottom = max(0, bottom - vertical_padding)

            # Calculate effective scaling factors
            width_scale = original_width / padded_width
            height_scale = original_height / (padded_height - 2 * vertical_padding)

            # Apply scaling to coordinates
            scaled_top = int(top * width_scale)
            scaled_left = int(left * height_scale)
            scaled_right = int(right * width_scale)
            scaled_bottom = int(bottom * height_scale)

            # Draw visualization on original image
            cv2.rectangle(img_src, (scaled_top, scaled_left), (scaled_right, scaled_bottom), (255, 0, 0), 2)
            cv2.putText(img_src, f'{CLASSES[cl]} {score:.2f}',
                        (scaled_top, scaled_left - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    analyzed_path = image_path.replace(".jpg", "_analyzed.jpg")
    analyzed_real_path = real_path.replace(".jpg", "_analyzed.jpg")
    cv2.imwrite(analyzed_real_path, img_src)

    end_time = time.time()
    inference_time = f"{end_time - start_time:.4f}s"
    print(f"Inference time: {inference_time}")

    return {
        "file": image_path,
        "analyzedFile": analyzed_path,
        "matches": matches,
        "inferenceTime": inference_time,
    }

@app.get("/")
def read_root(imagePath: str = Query(..., description="Path to the image to be analyzed")):
    return analyze_image(imagePath)