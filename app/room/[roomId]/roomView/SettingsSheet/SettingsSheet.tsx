'use client';

import type { LocalAudioSettings } from '../../../../../media/core/MediaRoom';
import { SlidersHorizontal, X } from 'lucide-react';
import styles from './SettingsSheet.module.css';

type AudioToggleKey = 'noiseSuppression' | 'echoCancellation' | 'autoGainControl';

type SettingsSheetProps = {
  open: boolean;
  audioSettings: LocalAudioSettings;
  audioInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string;
  onUpdateAudioSettings: (settings: LocalAudioSettings) => void;
  onSelectAudioInput: (deviceId: string) => void;
  onClose: () => void;
};

const toggleOptions: Array<{ key: AudioToggleKey; label: string; description: string }> = [
  {
    key: 'noiseSuppression',
    label: 'Noise suppression',
    description: 'Reduce background buzz and keyboard clicks.'
  },
  {
    key: 'echoCancellation',
    label: 'Echo cancellation',
    description: 'Prevent feedback when you speak near speakers.'
  },
  {
    key: 'autoGainControl',
    label: 'Auto gain control',
    description: 'Smooths out loud and quiet moments automatically.'
  }
];

export default function SettingsSheet({
  open,
  audioSettings,
  audioInputDevices,
  selectedAudioInputId,
  onUpdateAudioSettings,
  onSelectAudioInput,
  onClose,
}: SettingsSheetProps) {
  if (!open) {
    return null;
  }

  const hasInputs = audioInputDevices.length > 0;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Audio settings" onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.handle} />
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.eyebrow}>Room controls</span>
            <h3 className={styles.title}>Audio settings</h3>
            <p className={styles.subtitle}>Tune your mic so classmates hear you clearly.</p>
          </div>
          <button type="button" className={styles.closeButton} aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className={styles.metaCard}>
          <div className={styles.metaIcon}>
            <SlidersHorizontal size={16} />
          </div>
          <div>
            <p className={styles.metaTitle}>Live adjustments</p>
            <p className={styles.metaCopy}>Changes apply instantly so you can hear the difference.</p>
          </div>
        </div>

        <div className={styles.deviceCard}>
          <div className={styles.deviceHeader}>
            <p className={styles.deviceLabel}>Microphone</p>
            <p className={styles.deviceHint}>Choose which mic the class hears.</p>
          </div>
          <select
            className={styles.deviceSelect}
            value={selectedAudioInputId}
            onChange={(event) => onSelectAudioInput(event.target.value)}
          >
            <option value="">System default</option>
            {audioInputDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
            {!hasInputs ? <option disabled>No microphones detected</option> : null}
          </select>
        </div>

        <div className={styles.toggleList}>
          {toggleOptions.map(({ key, label, description }) => (
            <label key={key} className={styles.toggleRow}>
              <div className={styles.toggleText}>
                <span className={styles.toggleLabel}>{label}</span>
                <span className={styles.toggleDescription}>{description}</span>
              </div>
              <div className={styles.switch}>
                <input
                  type="checkbox"
                  checked={audioSettings[key]}
                  onChange={(event) =>
                    onUpdateAudioSettings({
                      ...audioSettings,
                      [key]: event.target.checked
                    })
                  }
                />
                <span aria-hidden="true" />
              </div>
            </label>
          ))}
        </div>

        <div className={styles.gainCard}>
          <div className={styles.gainHeader}>
            <div>
              <p className={styles.gainLabel}>Mic gain</p>
              <p className={styles.gainHint}>Balance your volume if you sound too quiet or too loud.</p>
            </div>
            <span className={styles.gainValue}>{audioSettings.gain.toFixed(2)}x</span>
          </div>
          <input
            className={styles.slider}
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={audioSettings.gain}
            onChange={(event) =>
              onUpdateAudioSettings({
                ...audioSettings,
                gain: Number(event.target.value)
              })
            }
          />
          <div className={styles.sliderScale}>
            <span>Low</span>
            <span>Neutral</span>
            <span>Boost</span>
          </div>
        </div>
      </div>
    </div>
  );
}
