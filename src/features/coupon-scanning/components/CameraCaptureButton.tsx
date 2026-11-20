"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  disabled: boolean;
  photosPending: number;
  onCapture: (files: File[]) => void;
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Camera permission was denied. Allow camera access for this site in the browser settings.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app.";
  return "Could not start the camera.";
}

// The chosen camera is remembered per browser so an operator who uses a
// phone-as-webcam picks it once. Storage can be unavailable (private mode),
// so every access is guarded and falls back to automatic selection.
const CAMERA_STORAGE_KEY = "coupon-scanning:camera-id";

function readRememberedCamera(): string {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberCamera(id: string) {
  try {
    if (id) localStorage.setItem(CAMERA_STORAGE_KEY, id);
    else localStorage.removeItem(CAMERA_STORAGE_KEY);
  } catch {
    // ignore — selection just won't be remembered
  }
}

// Highest resolution the camera offers: small QR codes on a full sheet need
// every pixel.
const RESOLUTION = { width: { ideal: 3840 }, height: { ideal: 2160 } };

// "Automatic" camera: the back camera on phones, the default webcam on
// computers. facingMode must be `exact` — as `ideal` it is weighed against the
// resolution ideals, so a phone's front camera can win. Webcams usually report
// no facing mode, so `exact` fails there and we retry without it.
async function openAutomaticCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...RESOLUTION, facingMode: { exact: "environment" } },
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name !== "OverconstrainedError" && name !== "NotFoundError") throw err;
    return navigator.mediaDevices.getUserMedia({ audio: false, video: RESOLUTION });
  }
}

// Opens a live in-page camera to photograph coupon sheets, with a camera
// picker; it stays open so several pages can be shot in a row. Phones use it
// too: the native file input's `capture` is only a hint (Android often opens
// the front camera, iOS can show a black screen), so it can't pin the back camera.
// Each shot is handed to onCapture immediately and read in the background.
// Live camera access needs HTTPS or localhost; without it, we fall back to
// the native file input.
export function CameraCaptureButton({ disabled, photosPending, onCapture }: Props) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [shots, setShots] = useState(0);
  // "" = automatic (back camera on phones, default webcam on computers).
  const [deviceId, setDeviceId] = useState("");
  const [cameras, setCameras] = useState<{ value: string; label: string }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let active: MediaStream | null = null;
    let cancelled = false;

    // Camera names are only exposed after permission is granted, and a phone
    // connected as a webcam can appear/disappear while the dialog is open.
    const refreshCameras = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          if (cancelled) return;
          setCameras(
            list
              .filter((d) => d.kind === "videoinput" && d.deviceId)
              .map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` })),
          );
        })
        .catch(() => {});
    navigator.mediaDevices.addEventListener("devicechange", refreshCameras);

    (deviceId
      ? navigator.mediaDevices.getUserMedia({ audio: false, video: { ...RESOLUTION, deviceId: { exact: deviceId } } })
      : openAutomaticCamera()
    )
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        active = s;
        setStream(s);
        void refreshCameras();
      })
      .catch((err) => {
        if (cancelled) return;
        if (deviceId) {
          // Remembered camera is gone (e.g. phone disconnected) — fall back to automatic.
          rememberCamera("");
          setDeviceId("");
          return;
        }
        setError(cameraErrorMessage(err));
      });

    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", refreshCameras);
      active?.getTracks().forEach((t) => t.stop());
    };
  }, [open, deviceId]);

  const openCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      nativeCameraInputRef.current?.click();
      return;
    }
    setError("");
    setShots(0);
    setStream(null);
    setDeviceId(readRememberedCamera());
    setOpen(true);
  };

  const switchCamera = (id: string) => {
    if (id === deviceId) return;
    rememberCamera(id);
    setError("");
    setStream(null);
    setDeviceId(id);
  };

  // Show the camera actually streaming when "automatic" picked one.
  const activeDeviceId = deviceId || stream?.getVideoTracks()[0]?.getSettings().deviceId || "";

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture the photo. Try again.");
          return;
        }
        onCapture([new File([blob], `coupon-sheet-${Date.now()}.jpg`, { type: "image/jpeg" })]);
        setShots((n) => n + 1);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={openCamera}
        className="w-fit bg-indigo-600 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
      >
        <Camera />
        Scan from Camera
      </Button>
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onCapture(Array.from(e.target.files ?? []));
          e.target.value = ""; // allow re-picking the same file
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photograph coupon sheet</DialogTitle>
            <DialogDescription>
              Fit the whole sheet in the frame, hold steady, then capture. You can capture several pages in a row.
            </DialogDescription>
          </DialogHeader>

          {cameras.length > 0 && (
            <div className="flex flex-col gap-1">
              <Select
                items={cameras}
                value={activeDeviceId || null}
                onValueChange={(value) => value && switchCamera(value)}
              >
                <SelectTrigger size="sm" aria-label="Camera" className="w-full">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((cam) => (
                    <SelectItem key={cam.value} value={cam.value}>
                      {cam.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 pointer-coarse:hidden">
                Using a phone? Connect it as a webcam (Continuity Camera on Mac, Phone Link on Windows, or an app
                like DroidCam/Camo), then pick it here.
              </p>
            </div>
          )}

          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-slate-900">
            {error ? (
              <p className="px-6 text-center text-xs font-semibold text-red-300">{error}</p>
            ) : (
              <>
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                      // Safari (WebKit) can leave the preview black unless
                      // muted is set as a property and play() is called.
                      el.muted = true;
                      void el.play().catch(() => {});
                    }
                  }}
                  // iOS can ignore the early play() above; retry once frames are ready.
                  onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => {})}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                />
                {!stream && <p className="absolute text-xs font-semibold text-slate-300">Starting camera…</p>}
              </>
            )}
          </div>

          <p className="text-xs text-slate-500" aria-live="polite">
            {shots > 0 && `${shots} photo${shots > 1 ? "s" : ""} captured. `}
            {photosPending > 0 && `Reading ${photosPending}…`}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
            <Button type="button" onClick={capture} disabled={!stream || !!error}>
              <Camera />
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
