from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
import time
from vision_new import setup_model, post_process, CLASSES, IMG_SIZE
import cv2
from coco_utils import COCO_test_helper

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

    img_src = cv2.imread(image_path)
    if img_src is None:
        raise Exception("Failed to load image")

    co_helper = COCO_test_helper(enable_letter_box=True)
    img = co_helper.letter_box(im= img_src.copy(), new_shape=(IMG_SIZE[1], IMG_SIZE[0]), pad_color=(0,0,0))
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