import type { RefObject } from "react";
import type { LocalAudioSettings } from "../../../../../media/core/MediaRoom";
import styles from "./RoomPreview.module.css";

type RoomPreviewProps = {
  roomId: string;
  previewVideoRef: RefObject<HTMLVideoElement>;
  previewStatus: "idle" | "loading" | "ready" | "error";
  previewError: string | null;
  previewLevel: number;
  audioSettings: LocalAudioSettings;
  error: string | null;
  joinInFlight: boolean;
  onJoin: () => void;
  onRefreshPreview: () => void;
  onGainChange: (gain: number) => void;
};

export default function RoomPreview({
  roomId,
  previewVideoRef,
  previewStatus,
  previewError,
  previewLevel,
  audioSettings,
  error,
  joinInFlight,
  onJoin,
  onRefreshPreview,
  onGainChange,
}: RoomPreviewProps) {
  const isLoading = previewStatus === "loading";
  const previewLabel =
    previewStatus === "loading"
      ? "Starting preview..."
      : previewStatus === "ready"
      ? "Preview active"
      : "Preview stopped";

  return (
    <section className={styles.previewCard}>
      <div>
        <h1 className={styles.previewTitle}>Room {roomId}</h1>
        <p className={styles.previewSubtitle}>
          Preview your camera and mic before joining the class.
        </p>
      </div>

      <div className={styles.previewTile}>
        <div className={styles.previewMediaFrame}>
          <video
            ref={previewVideoRef}
            autoPlay
            playsInline
            muted
            className={styles.previewVideo}
          />
          <div className={styles.previewStatusBadge}>
            <span
              className={`${styles.statusDot} ${
                previewStatus === "ready" ? styles.statusDotReady : ""
              }`}
            />
            <span>{previewLabel}</span>
          </div>
        </div>

        <div className={styles.micSection}>
          <p className={styles.micLabel}>Mic level</p>
          <div className={styles.meter} aria-label="Microphone level">
            <div
              className={styles.meterFill}
              style={{
                width: `${Math.min(100, Math.round(previewLevel * 130))}%`,
                background:
                  previewLevel > 0.7
                    ? "var(--preview-hot, #f97316)"
                    : "var(--preview-ok, #22c55e)",
              }}
            />
          </div>
          <div className={styles.gainControl}>
            <label className={styles.gainLabel}>
              Mic gain preview: {audioSettings.gain.toFixed(2)}x
            </label>
            <input
              className={styles.gainSlider}
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={audioSettings.gain}
              onChange={(event) => onGainChange(Number(event.target.value))}
            />
          </div>
        </div>
      </div>

      {previewError ? <p className={styles.errorText}>{previewError}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}

      <div className={styles.buttonRow}>
        <button
          className={styles.primaryButton}
          onClick={onJoin}
          disabled={joinInFlight || isLoading}
        >
          {joinInFlight ? "Joining..." : "Join room"}
        </button>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={onRefreshPreview}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing preview..." : "Refresh preview"}
        </button>
      </div>
    </section>
  );
}
