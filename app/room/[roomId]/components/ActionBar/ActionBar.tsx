import { Mic, MicOff, PhoneOff, Video, VideoOff, MoreVertical } from "lucide-react";
import styles from "./ActionBar.module.css";

type ActionBarProps = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onOpenSettings: () => void;
};

export default function ActionBar({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onOpenSettings,
}: ActionBarProps) {
  return (
    <div className={styles.actionBar}>
      <button
        className={`${styles.quickButton}${
          !audioEnabled ? ` ${styles.quickButtonMuted}` : ""
        }`}
        type="button"
        onClick={onToggleAudio}
        aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {audioEnabled ? (
          <Mic className={styles.quickIcon} strokeWidth={2.4} />
        ) : (
          <MicOff className={styles.quickIcon} strokeWidth={2.4} />
        )}
      </button>
      <button
        className={`${styles.quickButton}${
          !videoEnabled ? ` ${styles.quickButtonMuted}` : ""
        }`}
        type="button"
        onClick={onToggleVideo}
        aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
      >
        {videoEnabled ? (
          <Video className={styles.quickIcon} strokeWidth={2.4} />
        ) : (
          <VideoOff className={styles.quickIcon} strokeWidth={2.4} />
        )}
      </button>
      <button
        className={`${styles.quickButton} ${styles.quickButtonLeave}`}
        type="button"
        onClick={onLeave}
        aria-label="Leave call"
      >
        <PhoneOff className={styles.quickIcon} strokeWidth={2.6} />
      </button>
      <button
        className={`${styles.quickButton} ${styles.quickButtonMuted}`}
        type="button"
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <MoreVertical className={styles.quickIcon} strokeWidth={2.2} />
      </button>
    </div>
  );
}
