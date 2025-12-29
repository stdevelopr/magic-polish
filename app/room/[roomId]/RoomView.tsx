'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaRoom, ChatMessage, RoomState } from '../../../media/core/MediaRoom';
import type { Participant } from '../../../media/core/Participant';
import { createMediaProvider } from '../../../media/MediaProvider';
import VideoGrid from './VideoGrid';
import ChatPanel from './ChatPanel';
import Controls from './Controls';

type RoomViewProps = {
  roomId: string;
};

type Role = 'teacher' | 'student';

export default function RoomView({ roomId }: RoomViewProps) {
  const router = useRouter();
  const provider = useMemo(() => createMediaProvider(), []);
  const [room, setRoom] = useState<MediaRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomState, setRoomState] = useState<RoomState>('disconnected');
  const [participantName] = useState(() => `Student ${Math.floor(1000 + Math.random() * 9000)}`);
  const role: Role = 'student';
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const joinInFlightRef = useRef(false);

  useEffect(() => {
    if (!room) {
      return;
    }
    const stopParticipants = room.onParticipantsChanged(setParticipants);
    const stopChat = room.onChatMessage((message) => {
      setMessages((prev) => [...prev, message]);
    });
    const stopState = room.onStateChanged(setRoomState);

    return () => {
      stopParticipants();
      stopChat();
      stopState();
    };
  }, [room]);

  const joinRoom = useCallback(async () => {
    if (joinInFlightRef.current || room) {
      return;
    }
    joinInFlightRef.current = true;
    setError(null);
    setAutoJoinAttempted(true);
    const response = await fetch('/api/media/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, participantName, role })
    });

    if (!response.ok) {
      setError('Unable to join the room. Please try again.');
      return;
    }

    const { token } = (await response.json()) as { token: string };
    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!url) {
      setError('Missing LiveKit URL.');
      return;
    }

    const nextRoom = provider.createRoom();
    setRoom(nextRoom);
    try {
      await nextRoom.connect({ url, token });
      setAudioEnabled(true);
      setVideoEnabled(true);
    } catch (connectError) {
      setRoom(null);
      setError('Unable to connect to the room. Please try again.');
    } finally {
      joinInFlightRef.current = false;
    }
  }, [participantName, provider, role, room, roomId]);

  useEffect(() => {
    if (!room && !autoJoinAttempted) {
      joinRoom();
    }
  }, [autoJoinAttempted, joinRoom, room]);

  const leaveRoom = useCallback(async () => {
    if (!room) {
      return;
    }
    await room.disconnect();
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    router.push('/');
  }, [room, router]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!room) {
        return;
      }
      const local = room.getLocalParticipant();
      const chat: ChatMessage = {
        id: crypto.randomUUID(),
        participantId: local?.id ?? 'local',
        participantName: local?.name ?? participantName,
        message,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, chat]);
      room.sendChatMessage(message);
    },
    [participantName, room]
  );

  const toggleAudio = useCallback(async () => {
    if (!room) {
      return;
    }
    const next = !audioEnabled;
    await room.setLocalAudioEnabled(next);
    setAudioEnabled(next);
  }, [audioEnabled, room]);

  const toggleVideo = useCallback(async () => {
    if (!room) {
      return;
    }
    const next = !videoEnabled;
    await room.setLocalVideoEnabled(next);
    setVideoEnabled(next);
  }, [room, videoEnabled]);

  if (!room) {
    return (
      <section className="card fade-in" style={{ maxWidth: 520 }}>
        <h1 style={{ marginTop: 0 }}>Room {roomId}</h1>
        <p className="subtitle">
          Joining the live class now. We'll place you in with a friendly name.
        </p>
        <div className="grid">
          {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
          <button className="button" onClick={joinRoom}>
            {error ? 'Try again' : 'Connecting...'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Live session</h2>
            <p className="subtitle" style={{ marginBottom: 0 }}>
              {roomState === 'connected' ? 'Connected' : 'Connecting'} · {participants.length}{' '}
              participant{participants.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="badge">Room {roomId}</div>
        </div>
      </div>

      <div className="room-layout">
        <div className="grid">
          <div className="card">
            <VideoGrid participants={participants} />
          </div>
          <div className="card">
            <Controls
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onLeave={leaveRoom}
            />
          </div>
        </div>

        <div className="card">
          <ChatPanel messages={messages} onSend={sendMessage} />
        </div>
      </div>
    </section>
  );
}
