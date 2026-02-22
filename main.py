from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import os
import qrcode
from PIL import Image

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict to ["http://localhost:5177"] if you want
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Folder setup
UPLOAD_FOLDER = "photos"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Serve static files (photos + QR codes)
app.mount("/photos", StaticFiles(directory="photos"), name="photos")

# ✅ Existing endpoint: single photo upload
@app.post("/upload/")
async def upload_photo(file: UploadFile = File(...)):
    print(f"Received single photo upload: {file.filename}")  # 🔹 log incoming file
    unique_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_FOLDER}/{unique_id}.png"

    # Save uploaded file
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # Build download URL
    download_url = f"http://127.0.0.1:8000/photos/{unique_id}.png"

    # Generate QR code for single photo
    qr = qrcode.make(download_url)
    qr_path = f"{UPLOAD_FOLDER}/{unique_id}_qr.png"
    qr.save(qr_path)

    print(f"Saved photo at {file_path}, QR at {qr_path}")  # 🔹 log saved paths

    return {
        "photo_id": unique_id,
        "image_url": download_url,
        "qr_url": f"http://127.0.0.1:8000/photos/{unique_id}_qr.png"
    }

# ✅ New endpoint: finalize full strip collage
@app.post("/finalize_strip/")
async def finalize_strip(files: list[UploadFile] = File(...)):
    print(f"Received finalize_strip request with {len(files)} files")  # 🔹 log number of files
    photo_paths = []
    for file in files:
        print(f"Processing file: {file.filename}")  # 🔹 log each file name
        file_path = f"{UPLOAD_FOLDER}/{file.filename}"
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        photo_paths.append(file_path)

    # Build strip collage
    images = [Image.open(p) for p in photo_paths]
    widths, heights = zip(*(i.size for i in images))
    total_height = sum(heights)
    max_width = max(widths)
    strip = Image.new("RGB", (max_width, total_height), "white")

    y_offset = 0
    for img in images:
        strip.paste(img, (0, y_offset))
        y_offset += img.size[1]

    strip_filename = f"{UPLOAD_FOLDER}/strip.png"
    strip.save(strip_filename)

    strip_url = f"http://127.0.0.1:8000/photos/strip.png"

    # Generate QR pointing to strip
    qr = qrcode.make(strip_url)
    qr_path = f"{UPLOAD_FOLDER}/strip_qr.png"
    qr.save(qr_path)

    print(f"Collage saved at {strip_filename}, QR at {qr_path}")  # 🔹 log saved paths

    return {
        "strip_url": strip_url,
        "strip_qr_url": f"http://127.0.0.1:8000/photos/strip_qr.png"
    }