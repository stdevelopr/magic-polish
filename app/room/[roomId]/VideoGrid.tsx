'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Participant, MediaTrack } from '../../../media/core/Participant';

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

function ParticipantTile({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <div className="video-tile">
      <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} />
      <audio ref={audioRef} autoPlay />
      <div className="participant-label">
        {participant.name} {participant.isLocal ? '(You)' : ''}
      </div>
    </div>
  );
}

export default function VideoGrid({ participants }: VideoGridProps) {
  if (!participants.length) {
    return <p className="subtitle">No one has joined yet. Stay ready.</p>;
  }

  return (
    <div className="video-grid">
      {participants.map((participant) => (
        <ParticipantTile key={participant.id} participant={participant} />
      ))}
    </div>
  );
}
