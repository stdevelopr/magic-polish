'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { VideoTrack } from 'livekit-client';
import type { Participant, MediaTrack } from '../../../../../media/core/Participant';
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const audioLimiterRef = useRef<DynamicsCompressorNode | null>(null);
  const audioHighpassRef = useRef<BiquadFilterNode | null>(null);
  const audioPresenceRef = useRef<BiquadFilterNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [volume, setVolume] = useState(250);
  const isPip = variant === 'pip';

  const trackSignature = useMemo(
    () =>
      participant.tracks
        .map((t) => `${t.kind}:${t.id}:${t.mediaStreamTrack.id}:${t.mediaStreamTrack.readyState}`)
        .join('|'),
    [participant.tracks]
  );

  const audioStream = useMemo(() => buildStream(participant.tracks, 'audio'), [trackSignature]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    element.muted = participant.isLocal;
    element.playsInline = true;

    const livekitVideoTrack = participant.tracks.find((track) => track.kind === 'video' && track.sourceTrack)
      ?.sourceTrack as VideoTrack | undefined;

    if (livekitVideoTrack) {
      livekitVideoTrack.detach(element);
      livekitVideoTrack.attach(element);
      element.play().catch(() => undefined);
      return () => {
        livekitVideoTrack.detach(element);
      };
    }

    const fallbackStream = buildStream(participant.tracks, 'video');
    element.srcObject = null;
    element.srcObject = fallbackStream;
    element.play().catch(() => undefined);
    return () => {
      if (element.srcObject === fallbackStream) {
        element.srcObject = null;
      }
    };
  }, [participant.tracks, participant.isLocal, trackSignature]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    // Clean up any previous audio graph
    audioSourceRef.current?.disconnect();
    audioCompressorRef.current?.disconnect();
    audioLimiterRef.current?.disconnect();
    audioHighpassRef.current?.disconnect();
    audioPresenceRef.current?.disconnect();
    audioGainRef.current?.disconnect();
    audioDestinationRef.current?.disconnect();
    audioSourceRef.current = null;
    audioCompressorRef.current = null;
    audioLimiterRef.current = null;
    audioHighpassRef.current = null;
    audioPresenceRef.current = null;
    audioGainRef.current = null;
    audioDestinationRef.current = null;

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

    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') {
      context.resume().catch(() => undefined);
    }

    const source = context.createMediaStreamSource(audioStream);
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80;

    const presence = context.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3200;
    presence.Q.value = 1;
    presence.gain.value = 2.5;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;

    const gainNode = context.createGain();
    const destination = context.createMediaStreamDestination();
    source.connect(highpass);
    highpass.connect(presence);
    presence.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(gainNode);
    gainNode.connect(destination);
    audioRef.current.srcObject = destination.stream;
    audioRef.current.muted = false;
    audioRef.current.play().catch(() => undefined);

    audioSourceRef.current = source;
    audioCompressorRef.current = compressor;
    audioLimiterRef.current = limiter;
    audioHighpassRef.current = highpass;
    audioPresenceRef.current = presence;
    audioGainRef.current = gainNode;
    audioDestinationRef.current = destination;
  }, [audioStream, participant.isLocal, volume]);

  useEffect(() => {
    if (participant.isLocal) {
      return;
    }
    if (audioGainRef.current) {
      audioGainRef.current.gain.value = Math.min(3.5, Math.max(0, volume / 100));
    }
  }, [volume, participant.isLocal]);

  useEffect(() => {
    return () => {
      audioSourceRef.current?.disconnect();
      audioCompressorRef.current?.disconnect();
      audioLimiterRef.current?.disconnect();
      audioHighpassRef.current?.disconnect();
      audioPresenceRef.current?.disconnect();
      audioGainRef.current?.disconnect();
      audioDestinationRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

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
            max={400}
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
