import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  createLocalTracks,
  Track,
  type LocalTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";

const DEFAULT_PREVIEW_STATUS = "idle" as const;

type PreviewStatus = "idle" | "loading" | "ready" | "error";

type PreviewTracks = {
  audio?: LocalAudioTrack;
  video?: LocalVideoTrack;
};

type UseRoomPreviewOptions = {
  audioGain: number;
};

function splitPreviewTracks(tracks: LocalTrack[]) {
  const next: PreviewTracks = {};
  tracks.forEach((track) => {
    if (track.kind === Track.Kind.Audio) {
      next.audio = track as LocalAudioTrack;
    }
    if (track.kind === Track.Kind.Video) {
      next.video = track as LocalVideoTrack;
    }
  });
  return next;
}

function stopPreviewTracks(current: PreviewTracks) {
  current.audio?.stop();
  current.video?.stop();
}

function usePreviewTracks() {
  const [previewTracks, setPreviewTracks] = useState<PreviewTracks>({});
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>(
    DEFAULT_PREVIEW_STATUS
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewStatusRef = useRef<PreviewStatus>(DEFAULT_PREVIEW_STATUS);

  const stopPreview = useCallback(() => {
    setPreviewTracks((current) => {
      stopPreviewTracks(current);
      return {};
    });
  }, []);

  const startPreview = useCallback(async () => {
    if (previewStatusRef.current === "loading") {
      return;
    }
    previewStatusRef.current = "loading";
    setPreviewStatus("loading");
    setPreviewError(null);
    try {
      const tracks = await createLocalTracks({ audio: true, video: true });
      const next = splitPreviewTracks(tracks);
      setPreviewTracks((current) => {
        stopPreviewTracks(current);
        return next;
      });
      previewStatusRef.current = "ready";
      setPreviewStatus("ready");
    } catch (previewErr) {
      const reason =
        previewErr instanceof Error
          ? previewErr.message
          : "Unable to start preview";
      previewStatusRef.current = "error";
      setPreviewStatus("error");
      setPreviewError(reason);
    }
  }, []);

  useEffect(() => {
    startPreview();
    return () => {
      stopPreview();
    };
  }, [startPreview, stopPreview]);

  return {
    previewTracks,
    previewStatus,
    previewError,
    startPreview,
    stopPreview,
  };
}

function usePreviewVideo(
  previewTracks: PreviewTracks,
  previewVideoRef: RefObject<HTMLVideoElement>
) {
  useEffect(() => {
    if (previewVideoRef.current && previewTracks.video) {
      const stream = new MediaStream([previewTracks.video.mediaStreamTrack]);
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play().catch(() => undefined);
    }
  }, [previewTracks.video, previewVideoRef]);
}

function usePreviewAudioLevel(previewTracks: PreviewTracks, audioGain: number) {
  const [previewLevel, setPreviewLevel] = useState(0);
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewAnalyserRef = useRef<AnalyserNode | null>(null);
  const previewAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const previewLevelRafRef = useRef<number>();

  useEffect(() => {
    if (!previewTracks.audio) {
      setPreviewLevel(0);
      previewAudioSourceRef.current?.disconnect();
      previewAnalyserRef.current?.disconnect();
      if (previewLevelRafRef.current) {
        cancelAnimationFrame(previewLevelRafRef.current);
      }
      return;
    }

    const context = previewAudioContextRef.current ?? new AudioContext();
    previewAudioContextRef.current = context;
    if (context.state === "suspended") {
      context.resume().catch(() => undefined);
    }

    previewAudioSourceRef.current?.disconnect();
    previewAnalyserRef.current?.disconnect();
    if (previewLevelRafRef.current) {
      cancelAnimationFrame(previewLevelRafRef.current);
    }

    const source = context.createMediaStreamSource(
      new MediaStream([previewTracks.audio.mediaStreamTrack])
    );
    const gain = context.createGain();
    gain.gain.value = audioGain;
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);
    source.connect(gain);
    gain.connect(analyser);
    previewAudioSourceRef.current = source;
    previewAnalyserRef.current = analyser;

    const updateLevel = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setPreviewLevel(rms);
      previewLevelRafRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    return () => {
      source.disconnect();
      analyser.disconnect();
      if (previewLevelRafRef.current) {
        cancelAnimationFrame(previewLevelRafRef.current);
      }
    };
  }, [previewTracks.audio, audioGain]);

  return previewLevel;
}

export function useRoomPreview({ audioGain }: UseRoomPreviewOptions) {
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const {
    previewTracks,
    previewStatus,
    previewError,
    startPreview,
    stopPreview,
  } = usePreviewTracks();
  const previewLevel = usePreviewAudioLevel(previewTracks, audioGain);

  usePreviewVideo(previewTracks, previewVideoRef);

  return {
    previewVideoRef,
    previewStatus,
    previewError,
    previewLevel,
    startPreview,
    stopPreview,
  };
}
