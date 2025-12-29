"use client";

import styles from './Controls.module.css';

type ControlsProps = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioSettings: {
    autoGainControl: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    gain: number;
  };
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onUpdateAudioSettings: (settings: ControlsProps["audioSettings"]) => void;
  onLeave: () => void;
};

export default function Controls({
  audioEnabled,
  videoEnabled,
  audioSettings,
  onToggleAudio,
  onToggleVideo,
  onUpdateAudioSettings,
  onLeave,
}: ControlsProps) {
  return (
    <div className={styles.controlsRoot}>
      <h3 style={{ marginTop: 0 }}>Controls</h3>
      <p className="subtitle">
        Use the buttons for quick control. Adjust audio settings only if needed.
      </p>
      <div className={styles.controls} style={{ marginBottom: 12 }}>
        <button className="button" onClick={onToggleAudio}>
          {audioEnabled ? "Mute microphone" : "Unmute microphone"}
        </button>
        <button className="button" onClick={onToggleVideo}>
          {videoEnabled ? "Stop camera" : "Start camera"}
        </button>
        <button className="button danger" onClick={onLeave}>
          Leave room
        </button>
      </div>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Audio settings
        </summary>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={audioSettings.noiseSuppression}
              onChange={(event) =>
                onUpdateAudioSettings({
                  ...audioSettings,
                  noiseSuppression: event.target.checked,
                })
              }
            />
            Noise suppression
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={audioSettings.echoCancellation}
              onChange={(event) =>
                onUpdateAudioSettings({
                  ...audioSettings,
                  echoCancellation: event.target.checked,
                })
              }
            />
            Echo cancellation
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={audioSettings.autoGainControl}
              onChange={(event) =>
                onUpdateAudioSettings({
                  ...audioSettings,
                  autoGainControl: event.target.checked,
                })
              }
            />
            Auto gain control
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Mic gain: {audioSettings.gain.toFixed(2)}x
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={audioSettings.gain}
              onChange={(event) =>
                onUpdateAudioSettings({
                  ...audioSettings,
                  gain: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}
