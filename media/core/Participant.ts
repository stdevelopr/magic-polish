export type MediaTrackKind = 'audio' | 'video';

export interface MediaTrack {
  id: string;
  kind: MediaTrackKind;
  mediaStreamTrack: MediaStreamTrack;
}

export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  tracks: MediaTrack[];
}
