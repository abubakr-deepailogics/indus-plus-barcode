from collections import Counter
import cv2
import numpy as np
import zxingcpp
from pyzbar.pyzbar import decode as zbar_decode, ZBarSymbol


SHARPEN_KERNEL = np.array([
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0]
])

BINARIZERS = [
    zxingcpp.Binarizer.LocalAverage,
    zxingcpp.Binarizer.GlobalHistogram,
    zxingcpp.Binarizer.FixedThreshold,
]


def _cluster_1d(values, tol):
    values = sorted(values)
    clusters = []
    for v in values:
        if not clusters or abs(v - np.mean(clusters[-1])) > tol:
            clusters.append([v])
        else:
            clusters[-1].append(v)
    return [float(np.median(c)) for c in clusters]


def _box(corners):
    xs = [p[0] for p in corners]
    ys = [p[1] for p in corners]
    return min(xs), min(ys), max(xs), max(ys)


def _overlaps(a, b):
    ax1, ay1, ax2, ay2 = _box(a)
    bx1, by1, bx2, by2 = _box(b)
    iw = min(ax2, bx2) - max(ax1, bx1)
    ih = min(ay2, by2) - max(ay1, by1)
    if iw <= 0 or ih <= 0:
        return False
    inter = iw * ih
    smaller = min((ax2 - ax1) * (ay2 - ay1), (bx2 - bx1) * (by2 - by1))
    if smaller > 0 and inter / smaller > 0.35:
        return True
    # Also check center distance relative to QR size
    acx, acy = (ax1 + ax2) / 2.0, (ay1 + ay2) / 2.0
    bcx, bcy = (bx1 + bx2) / 2.0, (by1 + by2) / 2.0
    size = max(ax2 - ax1, ay2 - ay1, bx2 - bx1, by2 - by1, 1)
    return abs(acx - bcx) < size * 0.6 and abs(acy - bcy) < size * 0.6


class Detector:
    """
    Robust multi-QR detector for photos of label sheets.

    1. Full-image passes at several scales / binarizers / sharpening.
    2. Spatial deduplication: merges detections that occupy the same physical
       spot on the sheet while keeping duplicate QR texts printed on different
       stickers.
    3. Grid-slot recovery: labels are laid out in a grid, so any empty
       grid slot is cropped and retried with aggressive preprocessing.

    All corners are returned in ORIGINAL image coordinates.

    Returns (found, missed): found = [{"text", "corners"}]; missed = corners
    of grid slots that have something printed but could not be decoded.
    """

    def detect(self, image):
        gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # List of physical QR slots: [{"corners": [...], "texts": Counter()}]
        slots = []

        self._full_image_passes(gray, slots)
        print(f"Full image passes found {len(slots)}")

        missed = self._grid_recovery(gray, slots)
        print(f"After grid recovery found {len(slots)}, unreadable {len(missed)}")

        return self._finalize(slots), missed

    # ------------------------------------------------------------------ #

    @staticmethod
    def _add(slots, text, corners):
        text = (text or "").strip()
        if not text:
            return
        for slot in slots:
            if _overlaps(corners, slot["corners"]):
                slot["texts"][text] += 1
                return
        slots.append({
            "corners": corners,
            "texts": Counter({text: 1})
        })

    @staticmethod
    def _zx_corners(r, scale=1.0, ox=0, oy=0):
        p = r.position
        return [
            [int(ox + p.top_left.x / scale), int(oy + p.top_left.y / scale)],
            [int(ox + p.top_right.x / scale), int(oy + p.top_right.y / scale)],
            [int(ox + p.bottom_right.x / scale), int(oy + p.bottom_right.y / scale)],
            [int(ox + p.bottom_left.x / scale), int(oy + p.bottom_left.y / scale)],
        ]

    def _zx_read(self, img, binarizer):
        try:
            return zxingcpp.read_barcodes(
                img,
                formats=zxingcpp.BarcodeFormat.QRCode,
                binarizer=binarizer
            )
        except Exception:
            return []

    def _full_image_passes(self, gray, slots):
        for scale in (1, 2, 3):
            img = gray if scale == 1 else cv2.resize(
                gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
            )
            sharp = cv2.filter2D(img, -1, SHARPEN_KERNEL)

            for variant in (img, sharp):
                for b in BINARIZERS:
                    for r in self._zx_read(variant, b):
                        if r.valid and r.text:
                            self._add(slots, r.text, self._zx_corners(r, scale))

    # ponytail: only slots in rows/columns that already have a read QR are
    # checked, so a fully unreadable row or column is not reported as missed.
    def _grid_recovery(self, gray, slots):
        missed = []
        if len(slots) < 6:
            return missed

        H, W = gray.shape
        boxes = [_box(s["corners"]) for s in slots]
        sizes = [max(x2 - x1, y2 - y1) for x1, y1, x2, y2 in boxes]
        q = int(np.median(sizes))

        col_centers = _cluster_1d([b[0] for b in boxes], tol=q)
        row_centers = _cluster_1d([b[1] for b in boxes], tol=q)

        for ry in row_centers:
            for cx in col_centers:
                occupied = any(
                    abs(b[0] - cx) < q * 0.8 and abs(b[1] - ry) < q * 0.8
                    for b in (_box(s["corners"]) for s in slots)
                )
                if occupied:
                    continue

                pad = int(q * 0.6)
                x1, y1 = max(0, int(cx) - pad), max(0, int(ry) - pad)
                x2, y2 = min(W, int(cx) + q + pad), min(H, int(ry) + q + pad)
                crop = gray[y1:y2, x1:x2]

                # Skip blank slots (no QR printed there)
                if crop.size == 0 or crop.std() < 35:
                    continue

                text, corners = self._decode_crop(crop, x1, y1)
                if text:
                    self._add(slots, text, corners)
                else:
                    gx, gy = int(cx), int(ry)
                    missed.append([[gx, gy], [gx + q, gy], [gx + q, gy + q], [gx, gy + q]])
        return missed

    def _decode_crop(self, crop, ox, oy):
        for scale in (2, 3, 4, 5):
            for interp in (cv2.INTER_CUBIC, cv2.INTER_LANCZOS4):
                up = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=interp)
                sharp = cv2.filter2D(up, -1, SHARPEN_KERNEL)

                for variant in (up, sharp):
                    for b in BINARIZERS:
                        for r in self._zx_read(variant, b):
                            if r.valid and r.text:
                                return r.text, self._zx_corners(r, scale, ox, oy)

            up = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            for th in range(70, 205, 5):
                _, bw = cv2.threshold(up, th, 255, cv2.THRESH_BINARY)

                for r in self._zx_read(bw, zxingcpp.Binarizer.BoolCast):
                    if r.valid and r.text:
                        return r.text, self._zx_corners(r, scale, ox, oy)

                for z in zbar_decode(bw, symbols=[ZBarSymbol.QRCODE]):
                    t = z.data.decode("utf-8", errors="ignore").strip()
                    if t and len(z.polygon) == 4:
                        return t, [[int(ox + p.x / scale), int(oy + p.y / scale)] for p in z.polygon]

        return None, None

    @staticmethod
    def _finalize(slots):
        kept = []
        for s in slots:
            # Pick the text with the most votes (and prefer longer text on ties)
            best_text = max(s["texts"].items(), key=lambda kv: (kv[1], len(kv[0])))[0]
            kept.append({"text": best_text, "corners": s["corners"]})

        # Filter out isolated 1-vote noise reads that are much shorter than the sheet's QR codes
        if len(kept) >= 6:
            med_len = np.median([len(k["text"]) for k in kept])
            kept = [k for k in kept if len(k["text"]) >= max(5, med_len * 0.5)]

        # Reading order: top-to-bottom, left-to-right
        if kept:
            q = int(np.median([_box(k["corners"])[3] - _box(k["corners"])[1] for k in kept])) or 40
            rows = _cluster_1d([_box(k["corners"])[1] for k in kept], tol=q)

            def order(k):
                x1, y1, _, _ = _box(k["corners"])
                row = min(range(len(rows)), key=lambda i: abs(rows[i] - y1))
                return row, x1

            kept.sort(key=order)
        return kept
