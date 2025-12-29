'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Participant, MediaTrack } from '../../../../media/core/Participant';
import styles from './VideoGrid.module.css';

type VideoGridProps = {
  participants: Participant[];
};

function buildStream(tracks: MediaTrack[], kind: 'audio' | 'video') {
  const stream = new MediaStream();
  tracks
    .filter((track) => track.kind === kind)
    .forEach((track) => stream.addTrack(track.mediaStreamTrack));
  return stream;
}

type TileVariant = 'default' | 'pip';

function ParticipantTile({ participant, variant = 'default' }: { participant: Participant; variant?: TileVariant }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(100);
  const isPip = variant === 'pip';

  const videoStream = useMemo(() => buildStream(participant.tracks, 'video'), [participant]);
  const audioStream = useMemo(() => buildStream(participant.tracks, 'audio'), [participant]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = videoStream;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = audioStream;
    }
  }, [videoStream, audioStream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, volume / 100));
    }
  }, [volume]);

  return (
    <div className={`${styles.videoTile}${isPip ? ` ${styles.videoTilePip}` : ''}`}>
      <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} />
      <audio ref={audioRef} autoPlay />
      {!isPip ? (
        <div className={styles.participantLabel}>
          {participant.name} {participant.isLocal ? '(You)' : ''}
        </div>
      ) : null}
      {!isPip ? (
        <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Volume {participant.isLocal ? '(Local)' : ''}: {volume}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            disabled={participant.isLocal}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
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
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);

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
      y: Math.max(8, clientHeight - pipHeight - 14)
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
      const nextX = Math.min(Math.max(0, startPos.x + deltaX), bounds.width - pipBounds.width);
      const nextY = Math.min(Math.max(0, startPos.y + deltaY), bounds.height - pipBounds.height);
      setPipPosition({ x: nextX, y: nextY });
    };

    const onUp = (e: PointerEvent) => {
      pipRef.current?.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  if (localParticipant && remoteParticipants.length) {
    const [primary, ...others] = remoteParticipants;
    return (
      <div ref={containerRef} className={`${styles.videoGrid} ${styles.splitLayout}`}>
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
          style={pipPosition ? { transform: `translate(${pipPosition.x}px, ${pipPosition.y}px)` } : undefined}
          onPointerDown={beginDrag}
        >
          <ParticipantTile participant={localParticipant} variant="pip" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.videoGrid}>
      {participants.map((participant) => (
        <ParticipantTile key={participant.id} participant={participant} />
      ))}
    </div>
  );
}
