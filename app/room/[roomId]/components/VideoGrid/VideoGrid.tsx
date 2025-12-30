"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { VideoTrack } from "livekit-client";
import type {
  Participant,
  MediaTrack,
} from "../../../../../media/core/Participant";
import styles from "./VideoGrid.module.css";

type VideoGridProps = {
  participants: Participant[];
};

function buildStream(tracks: MediaTrack[], kind: "audio" | "video") {
  const stream = new MediaStream();
  tracks
    .filter((track) => track.kind === kind)
    .forEach((track) => stream.addTrack(track.mediaStreamTrack));
  return stream;
}

type TileVariant = "default" | "pip";

function ParticipantTile({
  participant,
  variant = "default",
}: {
  participant: Participant;
  variant?: TileVariant;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attachedVideoTrackIdRef = useRef<string | null>(null);
  const attachedVideoTrackRef = useRef<VideoTrack | null>(null);
  const isPip = variant === "pip";

  const videoTrackSignature = useMemo(
    () =>
      participant.tracks
        .filter((t) => t.kind === "video")
        .map((t) => `${t.id}:${t.mediaStreamTrack.id}`)
        .join("|"),
    [participant.tracks]
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

    const livekitVideoTrack = participant.tracks.find(
      (track) => track.kind === "video" && track.sourceTrack
    )?.sourceTrack as VideoTrack | undefined;
    const nextTrackId = livekitVideoTrack?.mediaStreamTrack.id ?? null;

    // Avoid unnecessary detach/attach to prevent flicker when track hasn't actually changed.
    if (
      livekitVideoTrack &&
      (attachedVideoTrackRef.current === livekitVideoTrack ||
        (nextTrackId && attachedVideoTrackIdRef.current === nextTrackId))
    ) {
      return;
    }

    if (livekitVideoTrack) {
      attachedVideoTrackRef.current = livekitVideoTrack;
      attachedVideoTrackIdRef.current = nextTrackId;
      livekitVideoTrack.detach(element);
      livekitVideoTrack.attach(element);
      element.play().catch(() => undefined);
      return () => {
        livekitVideoTrack.detach(element);
        attachedVideoTrackIdRef.current = null;
        attachedVideoTrackRef.current = null;
      };
    }

    const fallbackStream = buildStream(participant.tracks, "video");
    const fallbackTrackId = fallbackStream.getVideoTracks()[0]?.id ?? null;
    const currentStream =
      element.srcObject instanceof MediaStream ? element.srcObject : null;
    const currentTrackId = currentStream?.getVideoTracks()[0]?.id ?? null;
    if (fallbackTrackId && fallbackTrackId === currentTrackId) {
      attachedVideoTrackIdRef.current = fallbackTrackId;
      attachedVideoTrackRef.current = null;
      return;
    }
    element.srcObject = null;
    if (fallbackTrackId) {
      attachedVideoTrackIdRef.current = fallbackTrackId;
      attachedVideoTrackRef.current = null;
      element.srcObject = fallbackStream;
      element.play().catch(() => undefined);
      return () => {
        if (element.srcObject === fallbackStream) {
          element.srcObject = null;
        }
        attachedVideoTrackIdRef.current = null;
        attachedVideoTrackRef.current = null;
      };
    }
    attachedVideoTrackIdRef.current = null;
    attachedVideoTrackRef.current = null;
  }, [participant.isLocal, videoTrackSignature]);

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

  return (
    <div
      className={`${styles.videoTile}${isPip ? ` ${styles.videoTilePip}` : ""}`}
    >
      <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} />
      <audio ref={audioRef} autoPlay />
      {!isPip ? (
        <div className={styles.participantLabel}>
          {participant.name} {participant.isLocal ? "(You)" : ""}
        </div>
      ) : null}
    </div>
  );
}

export default function VideoGrid({ participants }: VideoGridProps) {
  if (!participants.length) {
    return <p className="subtitle">No one has joined yet. Stay ready.</p>;
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pipRef = useRef<HTMLDivElement | null>(null);
  const [pipPosition, setPipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const isSingleTile = participants.length === 1;

  const localParticipant = participants.find((p) => p.isLocal);
  const remoteParticipants = participants.filter((p) => !p.isLocal);

  useLayoutEffect(() => {
    if (!containerRef.current || !pipRef.current || pipPosition) {
      return;
    }
    const { clientWidth, clientHeight } = containerRef.current;
    const pipWidth = pipRef.current.clientWidth;
    const pipHeight = pipRef.current.clientHeight;
    setPipPosition({
      x: Math.max(8, clientWidth - pipWidth - 14),
      y: Math.max(8, clientHeight - pipHeight - 14),
    });
  }, [pipPosition]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !pipRef.current) return;
    pipRef.current.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const startPos = pipPosition ?? { x: 0, y: 0 };
    const bounds = containerRef.current.getBoundingClientRect();
    const pipBounds = pipRef.current.getBoundingClientRect();

    const onMove = (e: PointerEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const nextX = Math.min(
        Math.max(0, startPos.x + deltaX),
        bounds.width - pipBounds.width
      );
      const nextY = Math.min(
        Math.max(0, startPos.y + deltaY),
        bounds.height - pipBounds.height
      );
      setPipPosition({ x: nextX, y: nextY });
    };

    const onUp = (e: PointerEvent) => {
      pipRef.current?.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  if (localParticipant && remoteParticipants.length) {
    const [primary, ...others] = remoteParticipants;
    return (
      <div
        ref={containerRef}
        className={`${styles.videoGrid} ${styles.splitLayout}`}
      >
        <div className={styles.primaryTile}>
          <ParticipantTile participant={primary} />
        </div>
        {others.length ? (
          <div className={styles.secondaryList}>
            {others.map((participant) => (
              <ParticipantTile key={participant.id} participant={participant} />
            ))}
          </div>
        ) : null}
        <div
          ref={pipRef}
          className={styles.pipTile}
          style={
            pipPosition
              ? {
                  transform: `translate(${pipPosition.x}px, ${pipPosition.y}px)`,
                }
              : undefined
          }
          onPointerDown={beginDrag}
        >
          <ParticipantTile participant={localParticipant} variant="pip" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.videoGrid}${
        isSingleTile ? ` ${styles.singleTile}` : ""
      }`}
    >
      {participants.map((participant) => (
        <ParticipantTile key={participant.id} participant={participant} />
      ))}
    </div>
  );
}
