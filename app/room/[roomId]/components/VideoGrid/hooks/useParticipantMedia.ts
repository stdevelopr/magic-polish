import { useEffect, useMemo, useRef } from "react";
import type { VideoTrack } from "livekit-client";
import type { Participant } from "../../../../../../media/core/Participant";
import { buildStream } from "./useParticipantMedia.helper";

export function useParticipantMedia(participant: Participant) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attachedVideoTrackIdRef = useRef<string | null>(null);
  const attachedVideoTrackRef = useRef<VideoTrack | null>(null);
  const fallbackVideoStreamRef = useRef<MediaStream | null>(null);
  const fallbackVideoSignatureRef = useRef<string>("");

  const videoTrackSignature = useMemo(
    () =>
      participant.tracks
        .filter((t) => t.kind === "video")
        .map((t) => `${t.id}:${t.mediaStreamTrack.id}`)
        .join("|"),
    [participant.tracks]
  );

  const livekitVideoTrack = useMemo(
    () =>
      participant.tracks.find(
        (track) => track.kind === "video" && track.sourceTrack
      )?.sourceTrack as VideoTrack | undefined,
    [participant.tracks, videoTrackSignature]
  );

  const fallbackVideoStream = useMemo(
    () => {
      if (
        !fallbackVideoStreamRef.current ||
        fallbackVideoSignatureRef.current !== videoTrackSignature
      ) {
        fallbackVideoSignatureRef.current = videoTrackSignature;
        fallbackVideoStreamRef.current = buildStream(
          participant.tracks,
          "video"
        );
      }
      return fallbackVideoStreamRef.current;
    },
    [participant.tracks, videoTrackSignature]
  );

  const audioTrackSignature = useMemo(
    () =>
      participant.tracks
        .filter((t) => t.kind === "audio")
        .map(
          (t) =>
            `${t.id}:${t.mediaStreamTrack.id}:${t.mediaStreamTrack.readyState}`
        )
        .join("|"),
    [participant.tracks]
  );

  const audioStream = useMemo(
    () => buildStream(participant.tracks, "audio"),
    [audioTrackSignature]
  );

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
  ]);

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
  }, [audioStream, participant.isLocal]);

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
  }, [audioStream, participant.isLocal]);

  return { videoRef, audioRef };
}
