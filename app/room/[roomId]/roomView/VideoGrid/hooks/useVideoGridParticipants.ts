import { useMemo } from "react";
import type { Participant } from "../../../../../../media/core/Participant";

export function useVideoGridParticipants(participants: Participant[]) {
  const localParticipant = useMemo(
    () => participants.find((participant) => participant.isLocal),
    [participants]
  );
  const remoteParticipants = useMemo(
    () => participants.filter((participant) => !participant.isLocal),
    [participants]
  );

  return {
    localParticipant,
    remoteParticipants,
    isSingleTile: participants.length === 1,
  };
}
