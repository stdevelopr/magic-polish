"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { createMediaProvider } from "../../../../media/MediaProvider";
import ActionBar from "./ActionBar/ActionBar";
import RoomHeader from "./RoomHeader/RoomHeader";
import RoomPreview from "./RoomPreview/RoomPreview";
import VideoGrid from "./VideoGrid/VideoGrid";
import SettingsSheet from "./SettingsSheet/SettingsSheet";
import Whiteboard from "./Whiteboard/Whiteboard";
import styles from "./roomView.module.css";
import { createParticipantName } from "./roomView.helpers";
import { useRoomPreview } from "./useRoomPreview.hook";
import { useRoomSession, type RoomRole } from "./useRoomSession.hook";

type RoomViewProps = {
  roomId: string;
};

export default function RoomView({ roomId }: RoomViewProps) {
  const router = useRouter();
  const provider = useMemo(() => createMediaProvider(), []);
  const [participantName] = useState(() => createParticipantName("Student"));
  const role: RoomRole = "student";
  const [showSettings, setShowSettings] = useState(false);
  const {
    room,
    participants,
    roomState,
    joinInFlight,
    audioEnabled,
    videoEnabled,
    audioSettings,
    audioInputDevices,
    selectedAudioInputId,
    error,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    updateAudioSettings,
    selectAudioInput,
    setPreviewGain,
  } = useRoomSession({
    roomId,
    participantName,
    role,
    provider,
    onLeave: () => router.push("/"),
  });
  const {
    previewVideoRef,
    previewStatus,
    previewError,
    previewLevel,
    startPreview,
    stopPreview,
  } = useRoomPreview({ audioGain: audioSettings.gain });

  const handleJoin = useCallback(async () => {
    const didJoin = await joinRoom();
    if (didJoin) {
      stopPreview();
    }
  }, [joinRoom, stopPreview]);

  if (!room) {
    return (
      <RoomPreview
        roomId={roomId}
        previewVideoRef={previewVideoRef}
        previewStatus={previewStatus}
        previewError={previewError}
        previewLevel={previewLevel}
        audioSettings={audioSettings}
        error={error}
        joinInFlight={joinInFlight}
        onJoin={handleJoin}
        onRefreshPreview={startPreview}
        onGainChange={setPreviewGain}
      />
    );
  }

  return (
    <section className={styles.roomView}>
      <RoomHeader
        roomId={roomId}
        roomState={roomState}
        participantCount={participants.length}
      />

      <div className={styles.stage}>
        <div className={styles.stageBody}>
          <VideoGrid participants={participants} />
          <Whiteboard room={room} />
        </div>
      </div>

      <ActionBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onLeave={leaveRoom}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
      />

      <SettingsSheet
        open={showSettings}
        audioSettings={audioSettings}
        audioInputDevices={audioInputDevices}
        selectedAudioInputId={selectedAudioInputId}
        onUpdateAudioSettings={updateAudioSettings}
        onSelectAudioInput={selectAudioInput}
        onClose={() => setShowSettings(false)}
      />
    </section>
  );
}
