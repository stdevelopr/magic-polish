import type { AudioTrack, VideoTrack } from 'livekit-client';

export type MediaTrackKind = 'audio' | 'video';

export interface MediaTrack {
  id: string;
  kind: MediaTrackKind;
  mediaStreamTrack: MediaStreamTrack;
  sourceTrack?: AudioTrack | VideoTrack;
}

export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  tracks: MediaTrack[];
}
