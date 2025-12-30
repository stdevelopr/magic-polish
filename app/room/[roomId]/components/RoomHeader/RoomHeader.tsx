import type { RoomState } from "../../../../../media/core/MediaRoom";
import styles from "./RoomHeader.module.css";

type RoomHeaderProps = {
  roomId: string;
  roomState: RoomState;
  participantCount: number;
};

export default function RoomHeader({
  roomId,
  roomState,
  participantCount,
}: RoomHeaderProps) {
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
