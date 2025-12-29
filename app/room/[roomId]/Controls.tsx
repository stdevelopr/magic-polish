'use client';

type ControlsProps = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
};

export default function Controls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave
}: ControlsProps) {
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Controls</h3>
      <p className="subtitle">Manage your presence and stay in command.</p>
      <div className="controls">
        <button className="button" onClick={onToggleAudio}>
          {audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        </button>
        <button className="button" onClick={onToggleVideo}>
          {videoEnabled ? 'Stop camera' : 'Start camera'}
        </button>
        <button className="button danger" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </div>
  );
}
