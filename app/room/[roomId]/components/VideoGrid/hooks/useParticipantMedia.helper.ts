import type { MediaTrack } from "../../../../../../media/core/Participant";

export function buildStream(tracks: MediaTrack[], kind: "audio" | "video") {
  const stream = new MediaStream();
  tracks
    .filter((track) => track.kind === kind)
    .forEach((track) => stream.addTrack(track.mediaStreamTrack));
  return stream;
}
