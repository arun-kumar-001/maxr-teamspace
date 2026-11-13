import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from '../../../components/ui';
import type { AttendanceLocation } from '../types';

export interface AttendanceCaptureModalProps {
  isOpen: boolean;
  mode: 'check-in' | 'check-out';
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: { location: AttendanceLocation; photoDataUrl: string }) => Promise<void>;
}

/**
 * Captures both a live webcam selfie and current GPS coordinates before
 * allowing an employee to complete Check-In or Check-Out.
 */
export function AttendanceCaptureModal({
  isOpen,
  mode,
  isSubmitting = false,
  onClose,
  onConfirm,
}: AttendanceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submittingRef = useRef(false);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [location, setLocation] = useState<AttendanceLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError('Camera access denied or unavailable. Please allow camera permission.');
    }
  }, []);

  const fetchLocation = useCallback(() => {
    setLocationStatus('loading');
    setLocationError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        void (async () => {
          let resolvedAddress = 'Current GPS Location';
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`,
              { headers: { Accept: 'application/json' }, signal: controller.signal },
            );
            clearTimeout(timer);
            if (nomRes.ok) {
              const nom = (await nomRes.json()) as {
                display_name?: string;
                address?: {
                  house_number?: string;
                  road?: string;
                  pedestrian?: string;
                  residential?: string;
                  neighbourhood?: string;
                  suburb?: string;
                  quarter?: string;
                  city_district?: string;
                  city?: string;
                  town?: string;
                  village?: string;
                  state?: string;
                  postcode?: string;
                };
              };
              const a = nom.address;
              if (a) {
                const street = [a.house_number, a.road || a.pedestrian || a.residential]
                  .filter(Boolean)
                  .join(', ');
                const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
                const city = a.city || a.town || a.village;
                const parts = [street, area, city, a.state, a.postcode]
                  .filter((p): p is string => Boolean(p && p.trim()))
                  .filter((p, idx, arr) => arr.indexOf(p) === idx);
                if (parts.length > 0) {
                  resolvedAddress = parts.join(', ').slice(0, 250);
                } else if (nom.display_name) {
                  resolvedAddress = nom.display_name.slice(0, 250);
                }
              } else if (nom.display_name) {
                resolvedAddress = nom.display_name.slice(0, 250);
              }
            } else {
              const geoRes = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
              );
              if (geoRes.ok) {
                const geo = (await geoRes.json()) as {
                  locality?: string;
                  city?: string;
                  principalSubdivision?: string;
                };
                const parts = [geo.locality, geo.city, geo.principalSubdivision]
                  .filter((p): p is string => Boolean(p && p.trim()))
                  .filter((p, idx, arr) => arr.indexOf(p) === idx);
                if (parts.length > 0) resolvedAddress = parts.join(', ').slice(0, 250);
              }
            }
          } catch {
            // Keep clean fallback text when offline
          }
          setLocation({
            latitude: lat,
            longitude: lng,
            address: resolvedAddress,
            workMode: 'office',
          });
          setLocationStatus('ready');
        })();
      },
      () => {
        setLocationStatus('error');
        setLocationError('Location permission denied or timed out. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    setPhotoDataUrl(null);
    setSubmitError(null);
    void startCamera();
    fetchLocation();

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, fetchLocation, stopCamera]);

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const targetWidth = 480;
    const targetHeight = Math.round((video.videoHeight / video.videoWidth) * targetWidth);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setPhotoDataUrl(null);
    void startCamera();
  };

  const handleConfirm = async () => {
    if (!photoDataUrl || !location || submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setSubmitError(null);
    try {
      await onConfirm({ location, photoDataUrl });
      stopCamera();
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save attendance record.');
    } finally {
      submittingRef.current = false;
    }
  };

  const title = mode === 'check-in' ? 'Check In Verification' : 'Check Out Verification';
  const canConfirm = Boolean(photoDataUrl && location && !isSubmitting);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title={title}
      subtitle="Capture your live selfie and GPS location to continue."
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-danger font-medium"
          >
            {submitError}
          </div>
        )}

        {/* Camera / Captured Photo Box */}
        <div className="rounded-tile border border-border bg-surface-muted/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">1. Live Selfie Capture</span>
            {photoDataUrl ? (
              <span className="text-[11px] font-semibold text-primary-ink">Photo captured</span>
            ) : cameraReady ? (
              <span className="text-[11px] font-semibold text-primary-ink">Camera ready</span>
            ) : null}
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-sidebar/95 aspect-[4/3] flex items-center justify-center">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="Captured attendance verification"
                className="w-full h-full object-cover"
              />
            ) : cameraError ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-white/90 text-xs">{cameraError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void startCamera()}
                >
                  Retry Camera
                </Button>
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            {photoDataUrl ? (
              <Button type="button" size="sm" variant="outline" onClick={handleRetake}>
                Retake Photo
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={!cameraReady}
                onClick={handleCapturePhoto}
              >
                Capture Photo
              </Button>
            )}
          </div>
        </div>

        {/* GPS Location Box */}
        <div className="rounded-tile border border-border bg-surface-muted/60 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-text">2. GPS Location</span>
            {locationStatus === 'ready' && location ? (
              <span className="text-[11px] font-semibold text-primary-ink">Location captured</span>
            ) : locationStatus === 'loading' ? (
              <span className="text-[11px] text-text-muted">Detecting location...</span>
            ) : (
              <button
                type="button"
                onClick={fetchLocation}
                className="text-[11px] font-semibold text-primary-ink hover:underline"
              >
                Retry Location
              </button>
            )}
          </div>

          {locationStatus === 'ready' && location ? (
            <p className="text-xs font-medium text-text">
              {location.address || 'Location verified'}
            </p>
          ) : locationError ? (
            <p className="text-[11px] text-danger">{locationError}</p>
          ) : (
            <p className="text-[11px] text-text-subtle">Waiting for browser GPS coordinates...</p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
          >
            {isSubmitting
              ? 'Saving...'
              : mode === 'check-in'
                ? 'Confirm Check In'
                : 'Confirm Check Out'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
