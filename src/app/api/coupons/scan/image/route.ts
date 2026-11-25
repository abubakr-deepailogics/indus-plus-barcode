import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_BYTES,
  readQrCodesFromImage,
} from "@/features/coupon-scanning/services/qr-image-scan.service";
import { withRoute } from "@/lib/logger/with-route";

// Photo of a coupon sheet (multipart field "file") → every QR code text on it,
// in reading order, with box corners for read and unreadable codes. Only reads the image; marking coupons scanned is still
// done by POST /api/coupons/scan/batch.
export const POST = withRoute("/api/coupons/scan/image", async function POST(request: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Expected a multipart form with an image file." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (!IMAGE_EXTENSIONS[file.type]) {
    return Response.json({ error: "Unsupported image type. Use JPG, PNG, WEBP or BMP." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image is too large (max 20 MB)." }, { status: 400 });
  }

  const result = await readQrCodesFromImage(file);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
});
