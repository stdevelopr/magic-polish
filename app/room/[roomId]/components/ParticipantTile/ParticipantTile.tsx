"use client";

import type { Participant } from "../../../../../media/core/Participant";
import { useParticipantMedia } from "../VideoGrid/hooks/useParticipantMedia";
import styles from "./ParticipantTile.module.css";

type TileVariant = "default" | "pip";
type TileLayout = "default" | "fill";

type ParticipantTileProps = {
  participant: Participant;
  variant?: TileVariant;
  layout?: TileLayout;
};

export default function ParticipantTile({
  participant,
  variant = "default",
  layout = "default",
}: ParticipantTileProps) {
  const { videoRef, audioRef } = useParticipantMedia(participant);
  const isPip = variant === "pip";
  const isFill = layout === "fill";

  return (
    <div
      className={`${styles.tile}${isPip ? ` ${styles.tilePip}` : ""}${
        isFill ? ` ${styles.tileFill}` : ""
      }`}
    >
      <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} />
      <audio ref={audioRef} autoPlay />
      {!isPip ? (
        <div className={styles.participantLabel}>
          {participant.name} {participant.isLocal ? "(You)" : ""}
        </div>
      ) : null}
    </div>
  );
}
