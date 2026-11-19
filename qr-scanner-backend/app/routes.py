import cv2
import numpy as np
from fastapi.concurrency import run_in_threadpool
from app.services.detector import Detector
from app.schemas import ScanResponse

from fastapi import (
    APIRouter,
    File,
    UploadFile,
    HTTPException
)

from app.utils import (
    is_allowed_file
)

from app.config import (
    MAX_IMAGE_SIZE_MB
)

router = APIRouter()
detector = Detector()


@router.get("/")
def home():
    return {
        "message": "QR Scanner API Running"
    }


def _scan_image(contents: bytes):
    image = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Unable to read image."
        )

    found, missed = detector.detect(image)
    height, width = image.shape[:2]

    return ScanResponse(
        success=True,
        count=len(found),
        qr_codes=[qr["text"] for qr in found],
        width=width,
        height=height,
        found=found,
        missed=missed
    )


@router.post("/scan", response_model=ScanResponse)
async def scan_qr(file: UploadFile = File(...)):

    if not is_allowed_file(file.filename or ""):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )

    # Decoded in memory: scans are never written to disk.
    contents = await file.read()

    if len(contents) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image is too large."
        )

    return await run_in_threadpool(_scan_image, contents)
