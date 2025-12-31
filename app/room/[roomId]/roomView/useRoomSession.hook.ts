import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  MediaRoom,
  ChatMessage,
  RoomState,
  LocalAudioSettings,
} from "../../../../media/core/MediaRoom";
import type { Participant } from "../../../../media/core/Participant";
import type { MediaProvider } from "../../../../media/MediaProvider";

export type RoomRole = "teacher" | "student";

type UseRoomSessionOptions = {
  roomId: string;
  participantName: string;
  role: RoomRole;
  provider: MediaProvider;
  onLeave?: () => void;
};

const DEFAULT_AUDIO_SETTINGS: LocalAudioSettings = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
  gain: 1,
};

type UseRoomStateResult = {
  participants: Participant[];
  messages: ChatMessage[];
  roomState: RoomState;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  resetRoomState: () => void;
};

function getLivekitUrl() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!url) {
    throw new Error("Missing LiveKit URL (NEXT_PUBLIC_LIVEKIT_URL).");
  }
  return url;
}

function getLivekitUrlOptional() {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null;
}

function formatTokenError(error?: string, missing?: string[]) {
  if (!error) {
    return "";
  }
  const missingDetail = missing?.length ? `: ${missing.join(", ")}` : "";
  return ` (${error}${missingDetail})`;
}

function useRoomState(room: MediaRoom | null): UseRoomStateResult {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomState, setRoomState] = useState<RoomState>("disconnected");
  const resetRoomState = useCallback(() => {
    setParticipants([]);
    setMessages([]);
    setRoomState("disconnected");
  }, []);

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

  return {
    participants,
    messages,
    roomState,
    setMessages,
    resetRoomState,
  };
}

function useConnectionToken({
  roomId,
  participantName,
  role,
}: Pick<UseRoomSessionOptions, "roomId" | "participantName" | "role">) {
  const tokenRef = useRef<string | null>(null);

  return useCallback(async () => {
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
      throw new Error(
        `Token request failed${formatTokenError(apiError, missing)}`
      );
    }

    const { token } = (await response.json()) as { token: string };
    tokenRef.current = token;
    return token;
  }, [participantName, role, roomId]);
}

function usePrewarmConnection({
  provider,
  getConnectionToken,
}: {
  provider: MediaProvider;
  getConnectionToken: () => Promise<string>;
}) {
  const preparedRoomRef = useRef<MediaRoom | null>(null);
  const prewarmInFlightRef = useRef(false);

  useEffect(() => {
    const prewarmConnection = async () => {
      if (prewarmInFlightRef.current) {
        return;
      }
      const url = getLivekitUrlOptional();
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

  return preparedRoomRef;
}

function useRoomAudioUnlock(room: MediaRoom | null) {
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
      events.forEach((event) =>
        window.removeEventListener(event, unlockAudio)
      );
      window.clearInterval(interval);
    };
  }, [room]);
}

export function useRoomSession({
  roomId,
  participantName,
  role,
  provider,
  onLeave,
}: UseRoomSessionOptions) {
  const [room, setRoom] = useState<MediaRoom | null>(null);
  const [joinInFlight, setJoinInFlight] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioSettings, setAudioSettings] = useState<LocalAudioSettings>(
    DEFAULT_AUDIO_SETTINGS
  );
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>(
    []
  );
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const joinInFlightRef = useRef(false);
  const { participants, messages, roomState, setMessages, resetRoomState } =
    useRoomState(room);
  const getConnectionToken = useConnectionToken({
    roomId,
    participantName,
    role,
  });
  const preparedRoomRef = usePrewarmConnection({
    provider,
    getConnectionToken,
  });

  const refreshAudioInputs = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(
        devices.filter((device) => device.kind === "audioinput")
      );
    } catch {
      // Ignore device enumeration errors.
    }
  }, []);

  useEffect(() => {
    refreshAudioInputs().catch(() => undefined);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.addEventListener
    ) {
      return;
    }
    const handleDeviceChange = () => {
      refreshAudioInputs().catch(() => undefined);
    };
    navigator.mediaDevices.addEventListener(
      "devicechange",
      handleDeviceChange
    );
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [refreshAudioInputs]);

  useEffect(() => {
    if (!selectedAudioInputId) {
      return;
    }
    const exists = audioInputDevices.some(
      (device) => device.deviceId === selectedAudioInputId
    );
    if (!exists) {
      setSelectedAudioInputId("");
    }
  }, [audioInputDevices, selectedAudioInputId]);

  const joinRoom = useCallback(async () => {
    if (joinInFlightRef.current || room) {
      return false;
    }
    joinInFlightRef.current = true;
    setJoinInFlight(true);
    try {
      setError(null);
      const url = getLivekitUrl();
      const token = await getConnectionToken();
      const nextRoom = preparedRoomRef.current ?? provider.createRoom();
      preparedRoomRef.current = null;
      if (selectedAudioInputId) {
        await nextRoom.setMicrophoneDevice(selectedAudioInputId);
      }
      await nextRoom.prepareConnection({ url, token });
      await nextRoom.startAudio().catch(() => undefined);
      await nextRoom.connect({ url, token });
      setRoom(nextRoom);
      setAudioEnabled(true);
      setVideoEnabled(true);
      return true;
    } catch (connectError) {
      setRoom(null);
      const reason =
        connectError instanceof Error ? connectError.message : "Unknown error";
      setError(`Unable to connect to the room. ${reason}`);
      return false;
    } finally {
      joinInFlightRef.current = false;
      setJoinInFlight(false);
    }
  }, [getConnectionToken, provider, room, selectedAudioInputId]);

  const leaveRoom = useCallback(async () => {
    if (!room) {
      return;
    }
    await room.disconnect();
    setRoom(null);
    resetRoomState();
    onLeave?.();
  }, [onLeave, resetRoomState, room]);

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

  const selectAudioInput = useCallback(
    async (deviceId: string) => {
      setSelectedAudioInputId(deviceId);
      if (!room) {
        return;
      }
      await room.setMicrophoneDevice(deviceId || null);
    },
    [room]
  );

  const setPreviewGain = useCallback((gain: number) => {
    setAudioSettings((current) => ({ ...current, gain }));
  }, []);

  useRoomAudioUnlock(room);

  return {
    room,
    participants,
    messages,
    roomState,
    joinInFlight,
    audioEnabled,
    videoEnabled,
    audioSettings,
    audioInputDevices,
    selectedAudioInputId,
    error,
    joinRoom,
    leaveRoom,
    sendMessage,
    toggleAudio,
    toggleVideo,
    updateAudioSettings,
    selectAudioInput,
    setPreviewGain,
  };
}
