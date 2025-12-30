"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MediaRoom,
  ChatMessage,
  RoomState,
  LocalAudioSettings,
} from "../../../media/core/MediaRoom";
import type { Participant } from "../../../media/core/Participant";
import { createMediaProvider } from "../../../media/MediaProvider";
import VideoGrid from "./components/VideoGrid/VideoGrid";
import SettingsSheet from "./components/SettingsSheet/SettingsSheet";
import styles from "./RoomView.module.css";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  MoreVertical,
} from "lucide-react";
import {
  createLocalTracks,
  Track,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";

type RoomViewProps = {
  roomId: string;
};

type Role = "teacher" | "student";

function RoomHeader({
  roomId,
  roomState,
  participantCount,
}: {
  roomId: string;
  roomState: RoomState;
  participantCount: number;
}) {
  const isLive = roomState === "connected";
  const lessonTheme = "Interactive class";

  return (
    <div className={styles.topBar}>
      <div className={styles.headerLeft}>
        <div
          className={`${styles.liveBadge} ${
            isLive ? styles.liveBadgeOn : styles.liveBadgeIdle
          }`}
        >
          <span
            className={`${styles.liveDot} ${isLive ? styles.liveDotOn : ""}`}
          />
          <span>{isLive ? "On air" : "Connecting"}</span>
        </div>
        <div className={styles.roomMeta}>
          <p className={styles.roomEyebrow}>Room {roomId}</p>
          <h2 className={styles.roomTitle}>{lessonTheme}</h2>
          <p className={styles.roomSubtitle}>
            Stay present and keep your mic ready.
          </p>
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>In room</span>
          <span className={styles.statValue}>{participantCount}</span>
        </div>
        <div className={styles.statPill}>
          <span className={styles.statLabel}>Status</span>
          <span className={styles.statValue}>
            {isLive ? "Connected" : "Joining…"}
          </span>
        </div>
      </div>

      <div className={styles.headerCompact}>
        <span
          className={`${styles.compactDot} ${
            isLive ? styles.compactDotOn : ""
          }`}
        />
        <span className={styles.compactStatus}>
          {isLive ? "Connected" : "Connecting"}
        </span>
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
  onOpenSettings,
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
        className={`${styles.quickButton}${
          !audioEnabled ? ` ${styles.quickButtonMuted}` : ""
        }`}
        type="button"
        onClick={onToggleAudio}
        aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {audioEnabled ? (
          <Mic className={styles.quickIcon} strokeWidth={2.4} />
        ) : (
          <MicOff className={styles.quickIcon} strokeWidth={2.4} />
        )}
      </button>
      <button
        className={`${styles.quickButton}${
          !videoEnabled ? ` ${styles.quickButtonMuted}` : ""
        }`}
        type="button"
        onClick={onToggleVideo}
        aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
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
  const [roomState, setRoomState] = useState<RoomState>("disconnected");
  const [participantName] = useState(
    () => `Student ${Math.floor(1000 + Math.random() * 9000)}`
  );
  const role: Role = "student";
  const [joinInFlight, setJoinInFlight] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [previewTracks, setPreviewTracks] = useState<{
    audio?: LocalAudioTrack;
    video?: LocalVideoTrack;
  }>({});
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLevel, setPreviewLevel] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStatusRef = useRef<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewAnalyserRef = useRef<AnalyserNode | null>(null);
  const previewAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const previewLevelRafRef = useRef<number>();
  const [audioSettings, setAudioSettings] = useState<LocalAudioSettings>({
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    gain: 1,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const stopPreviewTracks = useCallback(() => {
    setPreviewTracks((current) => {
      current.audio?.stop();
      current.video?.stop();
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
      const next: { audio?: LocalAudioTrack; video?: LocalVideoTrack } = {};
      tracks.forEach((track) => {
        if (track.kind === Track.Kind.Audio) {
          next.audio = track as LocalAudioTrack;
        }
        if (track.kind === Track.Kind.Video) {
          next.video = track as LocalVideoTrack;
        }
      });
      setPreviewTracks((current) => {
        current.audio?.stop();
        current.video?.stop();
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
      stopPreviewTracks();
    };
  }, [startPreview, stopPreviewTracks]);

  useEffect(() => {
    if (previewVideoRef.current && previewTracks.video) {
      const stream = new MediaStream([previewTracks.video.mediaStreamTrack]);
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play().catch(() => undefined);
    }
  }, [previewTracks.video]);

  const joinRoom = useCallback(async () => {
    if (joinInFlightRef.current || room) {
      return;
    }
    joinInFlightRef.current = true;
    setJoinInFlight(true);
    try {
      setError(null);
      const response = await fetch("/api/media/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, participantName, role }),
      });

      if (!response.ok) {
        const { error: apiError, missing } = (await response
          .json()
          .catch(() => ({}))) as {
          error?: string;
          missing?: string[];
        };
        const detail = apiError
          ? ` (${apiError}${missing?.length ? `: ${missing.join(", ")}` : ""})`
          : "";
        throw new Error(`Token request failed${detail}`);
      }

      const { token } = (await response.json()) as { token: string };
      const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!url) {
        throw new Error("Missing LiveKit URL (NEXT_PUBLIC_LIVEKIT_URL).");
      }

      const nextRoom = provider.createRoom();
      setRoom(nextRoom);
      await nextRoom.connect({ url, token });
      setAudioEnabled(true);
      setVideoEnabled(true);
      stopPreviewTracks();
    } catch (connectError) {
      setRoom(null);
      const reason =
        connectError instanceof Error ? connectError.message : "Unknown error";
      setError(`Unable to connect to the room. ${reason}`);
    } finally {
      joinInFlightRef.current = false;
      setJoinInFlight(false);
    }
  }, [participantName, provider, role, room, roomId, stopPreviewTracks]);

  useEffect(() => {
    // Wire up a lightweight audio level meter for the preview mic track.
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
    gain.gain.value = audioSettings.gain;
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
  }, [previewTracks.audio, audioSettings.gain]);

  const leaveRoom = useCallback(async () => {
    if (!room) {
      return;
    }
    await room.disconnect();
    setRoom(null);
    setParticipants([]);
    setMessages([]);
    router.push("/");
  }, [room, router]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!room) {
        return;
      }
      const local = room.getLocalParticipant();
      const chat: ChatMessage = {
        id: crypto.randomUUID(),
        participantId: local?.id ?? "local",
        participantName: local?.name ?? participantName,
        message,
        timestamp: Date.now(),
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
      <section className="card fade-in" style={{ maxWidth: 720 }}>
        <h1 style={{ marginTop: 0 }}>Room {roomId}</h1>
        <p className="subtitle">
          Preview your camera and mic before joining the class.
        </p>

        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  background: "#0f1115",
                  aspectRatio: "16 / 9",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.65)",
                  color: "white",
                  fontSize: 12,
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background:
                      previewStatus === "ready" ? "#4ade80" : "#f59e0b",
                  }}
                />
                <span>
                  {previewStatus === "loading"
                    ? "Starting preview..."
                    : previewStatus === "ready"
                    ? "Preview active"
                    : "Preview stopped"}
                </span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.8 }}>
                Mic level
              </p>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  position: "relative",
                }}
                aria-label="Microphone level"
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.round(previewLevel * 130))}%`,
                    transition: "width 80ms ease-out",
                    height: "100%",
                    background: previewLevel > 0.7 ? "#f97316" : "#22c55e",
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>
                  Mic gain preview: {audioSettings.gain.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={audioSettings.gain}
                  onChange={(event) =>
                    setAudioSettings((current) => ({
                      ...current,
                      gain: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {previewError ? (
            <p style={{ color: "var(--danger)", margin: 0 }}>{previewError}</p>
          ) : null}
          {error ? (
            <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
          ) : null}

          <div className="grid" style={{ alignItems: "center" }}>
            <button
              className="button"
              onClick={joinRoom}
              disabled={joinInFlight || previewStatus === "loading"}
            >
              {joinInFlight ? "Joining..." : "Join room"}
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={startPreview}
              disabled={previewStatus === "loading"}
            >
              {previewStatus === "loading"
                ? "Refreshing preview..."
                : "Refresh preview"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.roomView}>
      <RoomHeader
        roomId={roomId}
        roomState={roomState}
        participantCount={participants.length}
      />

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
