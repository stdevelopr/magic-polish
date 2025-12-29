import type { Participant } from './Participant';

export type RoomState = 'disconnected' | 'connecting' | 'connected';

export interface ChatMessage {
  id: string;
  participantId: string;
  participantName: string;
  message: string;
  timestamp: number;
}

export interface MediaRoom {
  connect(options: { url: string; token: string }): Promise<void>;
  disconnect(): Promise<void>;
  getState(): RoomState;
  getLocalParticipant(): Participant | null;
  getParticipants(): Participant[];
  sendChatMessage(message: string): void;
  setLocalAudioEnabled(enabled: boolean): Promise<void>;
  setLocalVideoEnabled(enabled: boolean): Promise<void>;
  onParticipantsChanged(listener: (participants: Participant[]) => void): () => void;
  onChatMessage(listener: (message: ChatMessage) => void): () => void;
  onStateChanged(listener: (state: RoomState) => void): () => void;
}
