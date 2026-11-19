from pydantic import BaseModel
from typing import List


class FoundQr(BaseModel):
    text: str
    corners: List[List[int]]


class ScanResponse(BaseModel):
    success: bool
    count: int
    qr_codes: List[str]
    # Image size the corners refer to, so a client can overlay them.
    width: int
    height: int
    found: List[FoundQr]
    # Corners of spots that look like a QR label but could not be decoded.
    missed: List[List[List[int]]]
