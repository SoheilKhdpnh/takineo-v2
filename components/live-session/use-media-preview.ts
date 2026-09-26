"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function useMediaPreview(options: {
  active: boolean;
  videoEnabled: boolean;
}) {
  const { active, videoEnabled } = options;
  const [audioInputs, setAudioInputs] = useState<MediaDeviceOption[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceOption[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [permission, setPermission] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(
    null,
  );
  const meterFillRef = useRef<HTMLSpanElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audio = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
    const video = devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));

    setAudioInputs(audio);
    setVideoInputs(video);

    setAudioDeviceId((current) =>
      current && audio.some((device) => device.deviceId === current)
        ? current
        : (audio[0]?.deviceId ?? ""),
    );
    setVideoDeviceId((current) =>
      current && video.some((device) => device.deviceId === current)
        ? current
        : (video[0]?.deviceId ?? ""),
    );
  }, []);

  const stopPreview = useCallback(() => {
    const current = streamRef.current;
    streamRef.current = null;
    stopMediaStream(current);
  }, []);

  const selectedVideoDeviceId = videoEnabled ? videoDeviceId : "";

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    const constraints: MediaStreamConstraints = {
      audio: audioDeviceId
        ? { deviceId: { exact: audioDeviceId } }
        : true,
      video: videoEnabled
        ? selectedVideoDeviceId
          ? { deviceId: { exact: selectedVideoDeviceId } }
          : true
        : false,
    };

    void Promise.resolve()
      .then(() => {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("media-unsupported");
        }

        return navigator.mediaDevices.getUserMedia(constraints);
      })
      .then(async (next) => {
        if (cancelled) {
          stopMediaStream(next);
          return;
        }

        const previous = streamRef.current;
        streamRef.current = next;
        stopMediaStream(previous);
        setPreviewStream(next);
        setPermission("granted");
        await refreshDevices();
      })
      .catch(() => {
        if (!cancelled) {
          setPermission("denied");
        }
      });

    return () => {
      cancelled = true;
      const current = streamRef.current;
      streamRef.current = null;
      stopMediaStream(current);
    };
  }, [active, audioDeviceId, refreshDevices, selectedVideoDeviceId, videoEnabled]);

  useEffect(() => {
    const fill = meterFillRef.current;
    const stream = active ? previewStream : null;
    const audioTrack = stream?.getAudioTracks()[0];

    if (!fill || !stream || !audioTrack || audioTrack.readyState !== "live") {
      if (fill) {
        fill.style.transform = "scaleX(0)";
      }
      return;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (
        window as Window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    let frame = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      fill.style.transform = `scaleX(${Math.min(1, rms * 3.2).toFixed(3)})`;
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      void context.close();
    };
  }, [active, previewStream]);

  return {
    audioInputs,
    videoInputs,
    audioDeviceId,
    videoDeviceId,
    setAudioDeviceId,
    setVideoDeviceId,
    permission,
    previewStream,
    meterFillRef,
    stopPreview,
  };
}
