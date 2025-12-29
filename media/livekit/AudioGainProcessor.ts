import { Track, type AudioProcessorOptions, type TrackProcessor } from 'livekit-client';

type GainProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> & {
  setGain: (gain: number) => void;
};

export function createGainProcessor(initialGain: number): GainProcessor {
  let currentGain = initialGain;
  let source: MediaStreamAudioSourceNode | null = null;
  let gainNode: GainNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;

  const cleanup = () => {
    source?.disconnect();
    gainNode?.disconnect();
    destination?.disconnect();
    source = null;
    gainNode = null;
    destination = null;
  };

  const processor: GainProcessor = {
    name: 'MicGainProcessor',
    processedTrack: undefined,
    async init({ audioContext, track }: AudioProcessorOptions) {
      cleanup();
      source = audioContext.createMediaStreamSource(new MediaStream([track]));
      gainNode = audioContext.createGain();
      gainNode.gain.value = currentGain;
      destination = audioContext.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(destination);
      processor.processedTrack = destination.stream.getAudioTracks()[0];
    },
    async restart(options: AudioProcessorOptions) {
      await processor.init(options);
    },
    async destroy() {
      cleanup();
      processor.processedTrack = undefined;
    },
    setGain(gain: number) {
      currentGain = gain;
      if (gainNode) {
        gainNode.gain.value = currentGain;
      }
    },
  };

  return processor;
}
