const MICROSECONDS = 1e6;
const FALLBACK_DELAY = 0.1;

export interface Animation {
  frames: ImageBitmap[];
  delays: number[];
  loopSeconds: number;
  width: number;
  height: number;
}

export async function decodeAnimation(file: string, type: string): Promise<Animation> {
  const response = await fetch(`${import.meta.env.BASE_URL}dancers/${file}`);
  if (!response.ok) throw new Error(`Missing animation ${file}`);
  const decoder = new ImageDecoder({ data: await response.arrayBuffer(), type });
  await decoder.tracks.ready;
  const frames: ImageBitmap[] = [];
  const delays: number[] = [];
  for (let frameIndex = 0; frameIndex < decoder.tracks.selectedTrack!.frameCount; frameIndex++) {
    const { image } = await decoder.decode({ frameIndex });
    frames.push(await createImageBitmap(image));
    delays.push(image.duration ? image.duration / MICROSECONDS : FALLBACK_DELAY);
    image.close();
  }
  decoder.close();
  return { frames, delays, loopSeconds: delays.reduce((sum, delay) => sum + delay, 0), width: frames[0].width, height: frames[0].height };
}
