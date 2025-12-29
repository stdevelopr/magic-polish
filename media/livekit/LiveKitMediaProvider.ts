import type { MediaRoom } from '../core/MediaRoom';
import type { MediaProvider } from '../MediaProvider';
import { LiveKitRoom } from './LiveKitRoom';

export class LiveKitMediaProvider implements MediaProvider {
  createRoom(): MediaRoom {
    return new LiveKitRoom();
  }
}
