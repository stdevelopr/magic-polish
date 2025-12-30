"use client";

import { useRef } from "react";
import type { Participant } from "../../../../../media/core/Participant";
import styles from "./VideoGrid.module.css";
import ParticipantTile from "../ParticipantTile/ParticipantTile";
import { usePipDrag } from "./hooks/usePipDrag";
import { useVideoGridParticipants } from "./hooks/useVideoGridParticipants";

type VideoGridProps = {
  participants: Participant[];
};

export default function VideoGrid({ participants }: VideoGridProps) {
  if (!participants.length) {
    return <p className="subtitle">No one has joined yet. Stay ready.</p>;
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pipRef = useRef<HTMLDivElement | null>(null);
  const { localParticipant, remoteParticipants, isSingleTile } =
    useVideoGridParticipants(participants);
  const { pipPosition, beginDrag } = usePipDrag(
    containerRef,
    pipRef,
    Boolean(localParticipant && remoteParticipants.length)
  );

  if (localParticipant && remoteParticipants.length) {
    const [primary, ...others] = remoteParticipants;
    return (
      <div
        ref={containerRef}
        className={`${styles.videoGrid} ${styles.splitLayout}`}
      >
        <div className={styles.primaryTile}>
          <ParticipantTile participant={primary} layout="fill" />
        </div>
        {others.length ? (
          <div className={styles.secondaryList}>
            {others.map((participant) => (
              <ParticipantTile key={participant.id} participant={participant} />
            ))}
          </div>
        ) : null}
        <div
          ref={pipRef}
          className={styles.pipTile}
          style={
            pipPosition
              ? {
                  transform: `translate(${pipPosition.x}px, ${pipPosition.y}px)`,
                }
              : undefined
          }
          onPointerDown={beginDrag}
        >
          <ParticipantTile participant={localParticipant} variant="pip" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.videoGrid}${
        isSingleTile ? ` ${styles.singleTile}` : ""
      }`}
    >
      {participants.map((participant) => (
        <ParticipantTile key={participant.id} participant={participant} />
      ))}
    </div>
  );
}
