import type { MediaRoom } from './core/MediaRoom';
import { LiveKitMediaProvider } from './livekit/LiveKitMediaProvider';

export interface MediaProvider {
  createRoom(): MediaRoom;
}

export function createMediaProvider(): MediaProvider {
  return new LiveKitMediaProvider();
}
