import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { VideoTrack } from "livekit-client";
import type { Participant } from "../../../../../../media/core/Participant";
import { buildStream } from "./useParticipantMedia.helper";

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

    const setAttachedState = (
      trackId: string | null,
      track: VideoTrack | null
    ) => {
      attachedVideoTrackIdRef.current = trackId;
      attachedVideoTrackRef.current = track;
    };
    const getCurrentTrackId = () => {
      const currentStream =
        element.srcObject instanceof MediaStream ? element.srcObject : null;
      return currentStream?.getVideoTracks()[0]?.id ?? null;
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
      setAttachedState(nextTrackId, livekitVideoTrack);
      livekitVideoTrack.detach(element);
      livekitVideoTrack.attach(element);
      element.play().catch(() => undefined);
      return () => {
        livekitVideoTrack.detach(element);
        setAttachedState(null, null);
      };
    }

    // Fall back to a synthetic MediaStream when the source track isn't present.
    const fallbackTrackId = fallbackVideoStream.getVideoTracks()[0]?.id ?? null;
    const currentTrackId = getCurrentTrackId();
    if (fallbackTrackId && fallbackTrackId === currentTrackId) {
      // Keep the current stream if it's already the expected fallback track.
      setAttachedState(fallbackTrackId, null);
      return;
    }
    // Clear any stale srcObject before applying the fallback stream.
    element.srcObject = null;
    if (fallbackTrackId) {
      setAttachedState(fallbackTrackId, null);
      element.srcObject = fallbackVideoStream;
      element.play().catch(() => undefined);
      return () => {
        if (element.srcObject === fallbackVideoStream) {
          element.srcObject = null;
        }
        setAttachedState(null, null);
      };
    }
    setAttachedState(null, null);
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
  audioStream,
  audioRef,
}: {
  participant: Participant;
  audioStream: MediaStream;
  audioRef: RefObject<HTMLAudioElement>;
}) {
  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (!audioStream.getAudioTracks().length) {
      audioRef.current.srcObject = null;
      return;
    }

    if (participant.isLocal) {
      // Never play local audio to avoid echo.
      audioRef.current.srcObject = null;
      audioRef.current.muted = true;
      return;
    }

    audioRef.current.srcObject = audioStream;
    audioRef.current.muted = false;
    audioRef.current.volume = 1;
    audioRef.current.play().catch(() => undefined);
  }, [audioRef, audioStream, participant.isLocal]);
}

function useAudioResume({
  participant,
  audioStream,
  audioRef,
}: {
  participant: Participant;
  audioStream: MediaStream;
  audioRef: RefObject<HTMLAudioElement>;
}) {
  useEffect(() => {
    if (participant.isLocal) {
      return;
    }
    const handler = () => {
      const element = audioRef.current;
      if (!element) {
        return;
      }
      if (!element.srcObject && audioStream.getAudioTracks().length) {
        element.srcObject = audioStream;
      }
      element.muted = false;
      element.volume = 1;
      element.play().catch(() => undefined);
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
  }, [audioRef, audioStream, participant.isLocal]);
}

export function useParticipantMedia(participant: Participant) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoTrackSignature = useMemo(
    () => getTrackSignature(participant, "video"),
    [participant.tracks]
  );
  const livekitVideoTrack = useLivekitVideoTrack(participant);
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
  useAudioAttachment({ participant, audioStream, audioRef });
  useAudioResume({ participant, audioStream, audioRef });

  return { videoRef, audioRef };
}
