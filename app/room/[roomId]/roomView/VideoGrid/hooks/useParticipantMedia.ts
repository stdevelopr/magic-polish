import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { AudioTrack, VideoTrack } from "livekit-client";
import type { Participant } from "../../../../../../media/core/Participant";
import { buildStream } from "./useParticipantMedia.helper";

type EnhancedAudioNodes = {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
};

let sharedAudioContext: AudioContext | null = null;
const mediaElementSourceMap = new WeakMap<
  HTMLMediaElement,
  MediaElementAudioSourceNode
>();

function getSharedAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!sharedAudioContext) {
    const AudioContextCtor =
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    sharedAudioContext = new AudioContextCtor();
  }
  return sharedAudioContext;
}

function resumeSharedAudioContext() {
  if (sharedAudioContext?.state === "suspended") {
    sharedAudioContext.resume().catch(() => undefined);
  }
}

function playSafely(element: HTMLMediaElement) {
  element.play().catch(() => undefined);
}

function getCurrentTrackId(
  element: HTMLMediaElement,
  kind: "audio" | "video"
) {
  const currentStream =
    element.srcObject instanceof MediaStream ? element.srcObject : null;
  const tracks =
    kind === "audio"
      ? currentStream?.getAudioTracks()
      : currentStream?.getVideoTracks();
  return tracks?.[0]?.id ?? null;
}

function getTrackSignature(participant: Participant, kind: "audio" | "video") {
  return participant.tracks
    .filter((track) => track.kind === kind)
    .map((track) =>
      kind === "audio"
        ? `${track.id}:${track.mediaStreamTrack.id}:${track.mediaStreamTrack.readyState}`
        : `${track.id}:${track.mediaStreamTrack.id}`
    )
    .join("|");
}

function useLivekitVideoTrack(participant: Participant) {
  return useMemo(
    () =>
      participant.tracks.find(
        (track) => track.kind === "video" && track.sourceTrack
      )?.sourceTrack as VideoTrack | undefined,
    [participant.tracks]
  );
}

function useLivekitAudioTrack(participant: Participant) {
  return useMemo(
    () =>
      participant.tracks.find(
        (track) => track.kind === "audio" && track.sourceTrack
      )?.sourceTrack as AudioTrack | undefined,
    [participant.tracks]
  );
}

function useFallbackVideoStream(participant: Participant, signature: string) {
  const fallbackVideoStreamRef = useRef<MediaStream | null>(null);
  const fallbackVideoSignatureRef = useRef<string>("");

  return useMemo(() => {
    if (
      !fallbackVideoStreamRef.current ||
      fallbackVideoSignatureRef.current !== signature
    ) {
      fallbackVideoSignatureRef.current = signature;
      fallbackVideoStreamRef.current = buildStream(participant.tracks, "video");
    }
    return fallbackVideoStreamRef.current;
  }, [participant.tracks, signature]);
}

function useAudioStream(participant: Participant) {
  return useMemo(
    () => buildStream(participant.tracks, "audio"),
    [participant.tracks]
  );
}

function attachLivekitTrack<T extends AudioTrack | VideoTrack>({
  track,
  element,
  setAttachedState,
}: {
  track: T;
  element: HTMLMediaElement;
  setAttachedState: (trackId: string | null, track: T | null) => void;
}) {
  const nextTrackId = track.mediaStreamTrack.id;
  setAttachedState(nextTrackId, track);
  track.detach(element);
  track.attach(element);
  playSafely(element);
  return () => {
    track.detach(element);
    setAttachedState(null, null);
  };
}

function attachFallbackStream({
  element,
  stream,
  kind,
  resumeOnSameTrack = false,
  setAttachedState,
}: {
  element: HTMLMediaElement;
  stream: MediaStream;
  kind: "audio" | "video";
  resumeOnSameTrack?: boolean;
  setAttachedState: (trackId: string | null, track: null) => void;
}) {
  const fallbackTrackId =
    kind === "audio"
      ? stream.getAudioTracks()[0]?.id ?? null
      : stream.getVideoTracks()[0]?.id ?? null;
  const currentTrackId = getCurrentTrackId(element, kind);
  if (fallbackTrackId && fallbackTrackId === currentTrackId) {
    setAttachedState(fallbackTrackId, null);
    if (resumeOnSameTrack) {
      playSafely(element);
    }
    return;
  }

  element.srcObject = null;
  if (fallbackTrackId) {
    setAttachedState(fallbackTrackId, null);
    element.srcObject = stream;
    playSafely(element);
    return () => {
      if (element.srcObject === stream) {
        element.srcObject = null;
      }
      setAttachedState(null, null);
    };
  }
  setAttachedState(null, null);
}

function useVideoAttachment({
  participant,
  livekitVideoTrack,
  fallbackVideoStream,
  videoRef,
  videoTrackSignature,
}: {
  participant: Participant;
  livekitVideoTrack: VideoTrack | undefined;
  fallbackVideoStream: MediaStream;
  videoRef: RefObject<HTMLVideoElement>;
  videoTrackSignature: string;
}) {
  const attachedVideoTrackIdRef = useRef<string | null>(null);
  const attachedVideoTrackRef = useRef<VideoTrack | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    element.muted = participant.isLocal;
    element.playsInline = true;
    element.autoplay = true;

    const setAttachedState = (
      trackId: string | null,
      track: VideoTrack | null
    ) => {
      attachedVideoTrackIdRef.current = trackId;
      attachedVideoTrackRef.current = track;
    };
    const nextTrackId = livekitVideoTrack?.mediaStreamTrack.id ?? null;

    // Prefer the LiveKit source track when available; avoid reattaching the same track to prevent flicker.
    if (
      livekitVideoTrack &&
      (attachedVideoTrackRef.current === livekitVideoTrack ||
        (nextTrackId && attachedVideoTrackIdRef.current === nextTrackId))
    ) {
      return;
    }

    if (livekitVideoTrack) {
      return attachLivekitTrack({
        track: livekitVideoTrack,
        element,
        setAttachedState,
      });
    }

    // Fall back to a synthetic MediaStream when the source track isn't present.
    return attachFallbackStream({
      element,
      stream: fallbackVideoStream,
      kind: "video",
      setAttachedState,
    });
  }, [
    participant.isLocal,
    livekitVideoTrack,
    fallbackVideoStream,
    videoTrackSignature,
    videoRef,
  ]);
}

function useAudioAttachment({
  participant,
  livekitAudioTrack,
  audioStream,
  audioRef,
  audioTrackSignature,
}: {
  participant: Participant;
  livekitAudioTrack: AudioTrack | undefined;
  audioStream: MediaStream;
  audioRef: RefObject<HTMLAudioElement>;
  audioTrackSignature: string;
}) {
  const attachedAudioTrackIdRef = useRef<string | null>(null);
  const attachedAudioTrackRef = useRef<AudioTrack | null>(null);

  useEffect(() => {
    /**
     * Audio is the primary UX surface; we aggressively prefer LiveKit's attach
     * path because it is more resilient across browsers. The fallback stream
     * exists as a safety net for cases where the SDK does not provide a
     * source track (or it transiently disappears).
     */
    const element = audioRef.current;
    if (!element) {
      return;
    }

    if (participant.isLocal) {
      // Never play local audio to avoid echo.
      if (livekitAudioTrack) {
        livekitAudioTrack.detach(element);
      }
      element.srcObject = null;
      element.muted = true;
      return;
    }

    element.muted = false;
    element.volume = 1;
    element.autoplay = true;
    element.preload = "auto";

    const setAttachedState = (
      trackId: string | null,
      track: AudioTrack | null
    ) => {
      attachedAudioTrackIdRef.current = trackId;
      attachedAudioTrackRef.current = track;
    };
    const nextTrackId = livekitAudioTrack?.mediaStreamTrack.id ?? null;

    // Prefer LiveKit's attach for broader browser support.
    if (
      livekitAudioTrack &&
      (attachedAudioTrackRef.current === livekitAudioTrack ||
        (nextTrackId && attachedAudioTrackIdRef.current === nextTrackId))
    ) {
      element.play().catch(() => undefined);
      return;
    }

    if (livekitAudioTrack) {
      return attachLivekitTrack({
        track: livekitAudioTrack,
        element,
        setAttachedState,
      });
    }

    if (!audioStream.getAudioTracks().length) {
      element.srcObject = null;
      setAttachedState(null, null);
      return;
    }

    return attachFallbackStream({
      element,
      stream: audioStream,
      kind: "audio",
      resumeOnSameTrack: true,
      setAttachedState,
    });
  }, [
    participant.isLocal,
    livekitAudioTrack,
    audioStream,
    audioRef,
    audioTrackSignature,
  ]);
}

function useAudioEnhancer({
  participant,
  audioRef,
}: {
  participant: Participant;
  audioRef: RefObject<HTMLAudioElement>;
}) {
  const nodesRef = useRef<EnhancedAudioNodes | null>(null);

  useEffect(() => {
    if (participant.isLocal) {
      return;
    }
    const element = audioRef.current;
    if (!element) {
      return;
    }
    const context = getSharedAudioContext();
    if (!context) {
      return;
    }
    if (nodesRef.current?.element === element) {
      return;
    }

    // A light compressor + gain lift keeps quiet voices audible without harsh peaks.
    let source = mediaElementSourceMap.get(element);
    if (!source) {
      source = context.createMediaElementSource(element);
      mediaElementSourceMap.set(element, source);
    }
    source.disconnect();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -26;
    compressor.knee.value = 30;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const gain = context.createGain();
    gain.gain.value = 1.4;

    source.connect(compressor);
    compressor.connect(gain);
    gain.connect(context.destination);
    nodesRef.current = { element, source, compressor, gain };
    resumeSharedAudioContext();

    return () => {
      source.disconnect();
      compressor.disconnect();
      gain.disconnect();
      if (nodesRef.current?.element === element) {
        nodesRef.current = null;
      }
    };
  }, [audioRef, participant.isLocal]);
}

function useAudioResume({
  participant,
  livekitAudioTrack,
  audioStream,
  audioRef,
}: {
  participant: Participant;
  livekitAudioTrack: AudioTrack | undefined;
  audioStream: MediaStream;
  audioRef: RefObject<HTMLAudioElement>;
}) {
  useEffect(() => {
    /**
     * Mobile browsers can suspend autoplay; on user gestures or visibility
     * changes we replay and, if needed, reattach the track source.
     */
    if (participant.isLocal) {
      return;
    }
    const handler = () => {
      const element = audioRef.current;
      if (!element) {
        return;
      }
      if (!element.srcObject && livekitAudioTrack) {
        livekitAudioTrack.attach(element);
      } else if (!element.srcObject && audioStream.getAudioTracks().length) {
        element.srcObject = audioStream;
      }
      element.muted = false;
      element.volume = 1;
      resumeSharedAudioContext();
      playSafely(element);
    };
    window.addEventListener("media:resume-audio", handler);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handler();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("media:resume-audio", handler);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [audioRef, audioStream, livekitAudioTrack, participant.isLocal]);
}

export function useParticipantMedia(participant: Participant) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoTrackSignature = useMemo(
    () => getTrackSignature(participant, "video"),
    [participant.tracks]
  );
  const audioTrackSignature = useMemo(
    () => getTrackSignature(participant, "audio"),
    [participant.tracks]
  );
  const livekitVideoTrack = useLivekitVideoTrack(participant);
  const livekitAudioTrack = useLivekitAudioTrack(participant);
  const fallbackVideoStream = useFallbackVideoStream(
    participant,
    videoTrackSignature
  );
  const audioStream = useAudioStream(participant);

  useVideoAttachment({
    participant,
    livekitVideoTrack,
    fallbackVideoStream,
    videoRef,
    videoTrackSignature,
  });
  useAudioAttachment({
    participant,
    livekitAudioTrack,
    audioStream,
    audioRef,
    audioTrackSignature,
  });
  useAudioEnhancer({ participant, audioRef });
  useAudioResume({ participant, livekitAudioTrack, audioStream, audioRef });

  return { videoRef, audioRef };
}
