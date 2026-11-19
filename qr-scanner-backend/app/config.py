from dotenv import load_dotenv
import os

load_dotenv()

MAX_IMAGE_SIZE_MB = int(
    os.getenv("MAX_IMAGE_SIZE_MB", 20)
)

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp"
}