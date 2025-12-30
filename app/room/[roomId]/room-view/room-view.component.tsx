"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MediaRoom,
  ChatMessage,
  RoomState,
  LocalAudioSettings,
} from "../../../../media/core/MediaRoom";
import type { Participant } from "../../../../media/core/Participant";
import { createMediaProvider } from "../../../../media/MediaProvider";
import ActionBar from "./ActionBar/ActionBar";
import RoomHeader from "./RoomHeader/RoomHeader";
import RoomPreview from "./RoomPreview/RoomPreview";
import VideoGrid from "./VideoGrid/VideoGrid";
import SettingsSheet from "./SettingsSheet/SettingsSheet";
import styles from "./room-view.module.css";
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
  const preparedRoomRef = useRef<MediaRoom | null>(null);
  const tokenRef = useRef<string | null>(null);
  const prewarmInFlightRef = useRef(false);

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

  const getConnectionToken = useCallback(async () => {
    if (tokenRef.current) {
      return tokenRef.current;
    }
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
    tokenRef.current = token;
    return token;
  }, [participantName, role, roomId]);

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
    const prewarmConnection = async () => {
      if (prewarmInFlightRef.current) {
        return;
      }
      const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!url) {
        return;
      }
      prewarmInFlightRef.current = true;
      try {
        const token = await getConnectionToken();
        const prewarmRoom = preparedRoomRef.current ?? provider.createRoom();
        preparedRoomRef.current = prewarmRoom;
        await prewarmRoom.prepareConnection({ url, token });
      } catch {
        // Ignore pre-warm errors; joining handles user-facing failures.
      } finally {
        prewarmInFlightRef.current = false;
      }
    };

    prewarmConnection().catch(() => undefined);
  }, [getConnectionToken, provider]);

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
      const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!url) {
        throw new Error("Missing LiveKit URL (NEXT_PUBLIC_LIVEKIT_URL).");
      }

      const token = await getConnectionToken();
      const nextRoom = preparedRoomRef.current ?? provider.createRoom();
      preparedRoomRef.current = null;
      await nextRoom.prepareConnection({ url, token });
      await nextRoom.startAudio().catch(() => undefined);
      await nextRoom.connect({ url, token });
      setRoom(nextRoom);
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
  }, [getConnectionToken, provider, room, stopPreviewTracks]);

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

  const handlePreviewGainChange = useCallback((gain: number) => {
    setAudioSettings((current) => ({ ...current, gain }));
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }
    const unlockAudio = () => {
      room.startAudio().catch(() => undefined);
      window.dispatchEvent(new Event("media:resume-audio"));
    };
    const events = ["pointerdown", "touchstart", "keydown", "click"];
    events.forEach((event) => window.addEventListener(event, unlockAudio));
    const interval = window.setInterval(unlockAudio, 2000);
    unlockAudio();
    return () => {
      events.forEach((event) => window.removeEventListener(event, unlockAudio));
      window.clearInterval(interval);
    };
  }, [room]);

  if (!room) {
    return (
      <RoomPreview
        roomId={roomId}
        previewVideoRef={previewVideoRef}
        previewStatus={previewStatus}
        previewError={previewError}
        previewLevel={previewLevel}
        audioSettings={audioSettings}
        error={error}
        joinInFlight={joinInFlight}
        onJoin={joinRoom}
        onRefreshPreview={startPreview}
        onGainChange={handlePreviewGainChange}
      />
    );
  }

  return (
    <section className={styles.roomView}>
      <RoomHeader
        roomId={roomId}
        roomState={roomState}
        participantCount={participants.length}
      />

      <div className={styles.stage}>
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
