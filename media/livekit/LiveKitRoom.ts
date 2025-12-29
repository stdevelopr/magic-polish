import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrackPublication,
  type LocalTrackPublication,
  ConnectionState,
} from "livekit-client";
import type { MediaRoom, RoomState, ChatMessage, LocalAudioSettings } from "../core/MediaRoom";
import type { Participant, MediaTrack } from "../core/Participant";
import { createGainProcessor } from "./AudioGainProcessor";

const CHAT_TOPIC = "classroom-chat";

export class LiveKitRoom implements MediaRoom {
  private audioSettings: LocalAudioSettings = {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    gain: 1,
  };
  private gainProcessor = createGainProcessor(this.audioSettings.gain);
  private room = new Room({
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  private participants: Participant[] = [];
  private state: RoomState = "disconnected";
  private participantListeners = new Set<
    (participants: Participant[]) => void
  >();
  private chatListeners = new Set<(message: ChatMessage) => void>();
  private stateListeners = new Set<(state: RoomState) => void>();

  constructor() {
    this.bindEvents();
  }

  async connect(options: { url: string; token: string }): Promise<void> {
    this.setState("connecting");
    await this.room.connect(options.url, options.token);
    await this.room.localParticipant.enableCameraAndMicrophone();
    this.refreshParticipants();
    this.setState("connected");
  }

  async disconnect(): Promise<void> {
    this.room.disconnect();
    this.refreshParticipants();
    this.setState("disconnected");
  }

  getState(): RoomState {
    return this.state;
  }

  getLocalParticipant(): Participant | null {
    return this.participants.find((participant) => participant.isLocal) ?? null;
  }

  getParticipants(): Participant[] {
    return [...this.participants];
  }

  sendChatMessage(message: string): void {
    const encoded = new TextEncoder().encode(
      JSON.stringify({ topic: CHAT_TOPIC, message })
    );
    this.room.localParticipant.publishData(encoded, { reliable: true });
  }

  async setLocalAudioEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.room.localParticipant.setMicrophoneEnabled(true, {
        autoGainControl: this.audioSettings.autoGainControl,
        echoCancellation: this.audioSettings.echoCancellation,
        noiseSuppression: this.audioSettings.noiseSuppression,
        ...(this.audioSettings.gain !== 1 ? { processor: this.gainProcessor } : {}),
      });
    } else {
      await this.room.localParticipant.setMicrophoneEnabled(false);
    }
    this.refreshParticipants();
  }

  async setLocalVideoEnabled(enabled: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(enabled);
    this.refreshParticipants();
  }

  async updateLocalAudioSettings(settings: LocalAudioSettings): Promise<void> {
    const previousSettings = this.audioSettings;
    this.audioSettings = settings;
    this.gainProcessor.setGain(settings.gain);

    const constraintsChanged =
      previousSettings.autoGainControl !== settings.autoGainControl ||
      previousSettings.echoCancellation !== settings.echoCancellation ||
      previousSettings.noiseSuppression !== settings.noiseSuppression;
    const processorUsageChanged =
      (previousSettings.gain === 1) !== (settings.gain === 1);
    if (!constraintsChanged) {
      if (!processorUsageChanged) {
        return;
      }
    }

    if (processorUsageChanged && settings.gain === 1 && !constraintsChanged) {
      // No need to republish; gain processor is effectively neutral.
      return;
    }

    const local = this.room.localParticipant;
    const micPublication = local.getTrackPublication(Track.Source.Microphone);
    const micEnabled = Boolean(micPublication?.track && !micPublication.isMuted);
    if (!micEnabled) {
      return;
    }

    await local.setMicrophoneEnabled(false);
    await local.setMicrophoneEnabled(true, {
      autoGainControl: settings.autoGainControl,
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      ...(settings.gain !== 1 ? { processor: this.gainProcessor } : {}),
    });
    this.refreshParticipants();
  }

  onParticipantsChanged(
    listener: (participants: Participant[]) => void
  ): () => void {
    this.participantListeners.add(listener);
    listener(this.getParticipants());
    return () => this.participantListeners.delete(listener);
  }

  onChatMessage(listener: (message: ChatMessage) => void): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  onStateChanged(listener: (state: RoomState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private bindEvents(): void {
    this.room.on(RoomEvent.ParticipantConnected, () =>
      this.refreshParticipants()
    );
    this.room.on(RoomEvent.ParticipantDisconnected, () =>
      this.refreshParticipants()
    );
    this.room.on(RoomEvent.TrackSubscribed, () => this.refreshParticipants());
    this.room.on(RoomEvent.TrackUnsubscribed, () => this.refreshParticipants());
    this.room.on(RoomEvent.LocalTrackPublished, () =>
      this.refreshParticipants()
    );
    this.room.on(RoomEvent.LocalTrackUnpublished, () =>
      this.refreshParticipants()
    );
    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === ConnectionState.Connected) {
        this.setState("connected");
      }
      if (state === ConnectionState.Connecting) {
        this.setState("connecting");
      }
      if (state === ConnectionState.Disconnected) {
        this.setState("disconnected");
      }
    });
    this.room.on(RoomEvent.DataReceived, (payload, participant) => {
      if (!participant) {
        return;
      }
      try {
        const decoded = new TextDecoder().decode(payload);
        const parsed = JSON.parse(decoded) as {
          topic?: string;
          message?: string;
        };
        if (parsed.topic !== CHAT_TOPIC || !parsed.message) {
          return;
        }
        const chat: ChatMessage = {
          id: crypto.randomUUID(),
          participantId: participant.identity,
          participantName: participant.name ?? participant.identity,
          message: parsed.message,
          timestamp: Date.now(),
        };
        this.chatListeners.forEach((listener) => listener(chat));
      } catch (error) {
        return;
      }
    });
  }

  private setState(state: RoomState): void {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private refreshParticipants(): void {
    const participants: Participant[] = [];

    const local = this.room.localParticipant;
    if (local) {
      participants.push({
        id: local.identity,
        name: local.name ?? "You",
        isLocal: true,
        tracks: this.collectTracks(local.trackPublications.values()),
      });
    }

    const remoteParticipants =
      (this.room as { remoteParticipants?: Map<string, any>; participants?: Map<string, any> })
        .remoteParticipants ??
      (this.room as { participants?: Map<string, any> }).participants ??
      new Map<string, any>();

    for (const remote of remoteParticipants.values()) {
      participants.push({
        id: remote.identity,
        name: remote.name ?? remote.identity,
        isLocal: false,
        tracks: this.collectTracks(remote.trackPublications.values()),
      });
    }

    this.participants = participants;
    this.participantListeners.forEach((listener) =>
      listener(this.getParticipants())
    );
  }

  private collectTracks(
    publications: Iterable<RemoteTrackPublication | LocalTrackPublication>
  ): MediaTrack[] {
    const tracks: MediaTrack[] = [];
    for (const publication of publications) {
      const track = publication.track;
      if (!track) {
        continue;
      }
      if (track.kind === Track.Kind.Audio) {
        tracks.push({
          id: publication.trackSid,
          kind: "audio",
          mediaStreamTrack: track.mediaStreamTrack,
        });
      }
      if (track.kind === Track.Kind.Video) {
        tracks.push({
          id: publication.trackSid,
          kind: "video",
          mediaStreamTrack: track.mediaStreamTrack,
        });
      }
    }
    return tracks;
  }
}
