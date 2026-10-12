import type { ImageIo, Picture } from './prepare';

/*
 * `ImageIo` on a real browser: the only code that touches a canvas. jsdom has none, so it is
 * checked in the browser (the verify skill), not in unit tests.
 */

const sources = new WeakMap<Picture, CanvasImageSource>();

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No 2D canvas');
  }
  context.imageSmoothingQuality = 'high';
  return { canvas, context };
}

/** Frees a canvas's backing store now: iOS Safari caps canvas memory and collects it late. */
function free(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function picture<P extends Picture>(source: HTMLCanvasElement | ImageBitmap, result: P): P {
  sources.set(result, source);
  return result;
}

function sourceOf(picture: Picture): CanvasImageSource {
  const source = sources.get(picture);
  if (!source) {
    throw new Error('Not a picture of this ImageIo');
  }
  return source;
}

export const browserImageIo: ImageIo = {
  async decode(file) {
    // EXIF orientation applies by default; passing `imageOrientation: 'from-image'` would throw
    // on browsers that predate that value.
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    return picture(bitmap, { width, height, release: () => bitmap.close() });
  },

  draw(source, crop, size) {
    let from = sourceOf(source);
    let halved: HTMLCanvasElement | null = null;
    let area = crop ?? { x: 0, y: 0, width: source.width, height: source.height };
    // One big downscale aliases; halving steps keep the detail smooth.
    while (area.width / 2 >= size.width && area.height / 2 >= size.height) {
      const half = canvasOf(Math.round(area.width / 2), Math.round(area.height / 2));
      half.context.drawImage(
        from,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        half.canvas.width,
        half.canvas.height,
      );
      if (halved) {
        free(halved);
      }
      halved = half.canvas;
      from = half.canvas;
      area = { x: 0, y: 0, width: half.canvas.width, height: half.canvas.height };
    }
    const target = canvasOf(size.width, size.height);
    // White underneath, so a transparent PNG does not turn black in a JPEG.
    target.context.fillStyle = '#fff';
    target.context.fillRect(0, 0, size.width, size.height);
    target.context.drawImage(
      from,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      size.width,
      size.height,
    );
    if (halved) {
      free(halved);
    }
    return picture(target.canvas, {
      width: size.width,
      height: size.height,
      release: () => free(target.canvas),
    });
  },

  encode(picture, mime, quality) {
    const canvas = sourceOf(picture);
    if (!(canvas instanceof HTMLCanvasElement)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  },
};
