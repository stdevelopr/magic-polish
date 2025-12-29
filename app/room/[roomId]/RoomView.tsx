'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaRoom, ChatMessage, RoomState, LocalAudioSettings } from '../../../media/core/MediaRoom';
import type { Participant } from '../../../media/core/Participant';
import { createMediaProvider } from '../../../media/MediaProvider';
import VideoGrid from './components/VideoGrid/VideoGrid';
import SettingsSheet from './components/SettingsSheet/SettingsSheet';
import styles from './RoomView.module.css';
import { Mic, MicOff, PhoneOff, Video, VideoOff, MoreVertical } from 'lucide-react';

type RoomViewProps = {
  roomId: string;
};

type Role = 'teacher' | 'student';

function RoomHeader({
  roomId,
  roomState,
  participantCount
}: {
  roomId: string;
  roomState: RoomState;
  participantCount: number;
}) {
  const isLive = roomState === 'connected';
  const lessonTheme = 'Interactive class';

  return (
    <div className={styles.topBar}>
      <div className={styles.headerLeft}>
        <div className={`${styles.liveBadge} ${isLive ? styles.liveBadgeOn : styles.liveBadgeIdle}`}>
          <span className={`${styles.liveDot} ${isLive ? styles.liveDotOn : ''}`} />
          <span>{isLive ? 'On air' : 'Connecting'}</span>
        </div>
        <div className={styles.roomMeta}>
          <p className={styles.roomEyebrow}>Room {roomId}</p>
          <h2 className={styles.roomTitle}>{lessonTheme}</h2>
          <p className={styles.roomSubtitle}>Stay present and keep your mic ready.</p>
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>In room</span>
          <span className={styles.statValue}>{participantCount}</span>
        </div>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Status</span>
          <span className={styles.statValue}>{isLive ? 'Connected' : 'Joining…'}</span>
        </div>
      </div>

      <div className={styles.headerCompact}>
        <span className={`${styles.compactDot} ${isLive ? styles.compactDotOn : ''}`} />
        <span className={styles.compactStatus}>{isLive ? 'Connected' : 'Connecting'}</span>
        <span className={styles.compactDivider}>•</span>
        <span className={styles.compactTheme}>{lessonTheme}</span>
      </div>
    </div>
  );
}

function ActionBar({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onOpenSettings
}: {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className={styles.actionBar}>
      <button
        className={`${styles.quickButton}${!audioEnabled ? ` ${styles.quickButtonMuted}` : ''}`}
        type="button"
        onClick={onToggleAudio}
        aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {audioEnabled ? (
          <Mic className={styles.quickIcon} strokeWidth={2.4} />
        ) : (
          <MicOff className={styles.quickIcon} strokeWidth={2.4} />
        )}
      </button>
      <button
        className={`${styles.quickButton}${!videoEnabled ? ` ${styles.quickButtonMuted}` : ''}`}
        type="button"
        onClick={onToggleVideo}
        aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
      >
        {videoEnabled ? (
          <Video className={styles.quickIcon} strokeWidth={2.4} />
        ) : (
          <VideoOff className={styles.quickIcon} strokeWidth={2.4} />
        )}
      </button>
      <button
        className={`${styles.quickButton} ${styles.quickButtonLeave}`}
        type="button"
        onClick={onLeave}
        aria-label="Leave call"
      >
        <PhoneOff className={styles.quickIcon} strokeWidth={2.6} />
      </button>
      <button
        className={`${styles.quickButton} ${styles.quickButtonMuted}`}
        type="button"
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <MoreVertical className={styles.quickIcon} strokeWidth={2.2} />
      </button>
    </div>
  );
}

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
  const [audioSettings, setAudioSettings] = useState<LocalAudioSettings>({
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    gain: 1
  });
  const [showSettings, setShowSettings] = useState(false);
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

  const updateAudioSettings = useCallback(
    async (nextSettings: LocalAudioSettings) => {
      setAudioSettings(nextSettings);
      if (!room) {
        return;
      }
      await room.updateLocalAudioSettings(nextSettings);
    },
    [room]
  );

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
    <section className={styles.roomView}>
      <RoomHeader roomId={roomId} roomState={roomState} participantCount={participants.length} />

      <div className={`card ${styles.stage}`}>
        <div className={styles.stageBody}>
          <VideoGrid participants={participants} />
        </div>
      </div>

      <ActionBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onLeave={leaveRoom}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
      />

      <SettingsSheet
        open={showSettings}
        audioSettings={audioSettings}
        onUpdateAudioSettings={updateAudioSettings}
        onClose={() => setShowSettings(false)}
      />

    </section>
  );
}
