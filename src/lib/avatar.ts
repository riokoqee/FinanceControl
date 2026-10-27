export const AVATAR_VIEWPORT = 260;
export const MAX_AVATAR_FILE_SIZE = 8 * 1024 * 1024;
// The profile validator caps the full data URL at 500,000 characters.
export const MAX_AVATAR_DATA_LENGTH = 499_000;

export type AvatarOffset = { x: number; y: number };
export type AvatarResolution = 256 | 512;
export type AvatarSource = {
  image: HTMLImageElement;
  url: string;
  dispose: () => void;
};

/** The preview and the exported image use the same source-pixel rectangle. */
export function getAvatarGeometry(
  width: number,
  height: number,
  zoom = 1,
  offset: AvatarOffset = { x: 0, y: 0 },
  viewport = AVATAR_VIEWPORT,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(viewport) ||
    width <= 0 ||
    height <= 0 ||
    viewport <= 0
  )
    throw new Error("image");
  const safeZoom = Number.isFinite(zoom) ? Math.min(4, Math.max(1, zoom)) : 1;
  const scale = Math.max(viewport / width, viewport / height) * safeZoom;
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const maxX = Math.max(0, (renderedWidth - viewport) / 2);
  const maxY = Math.max(0, (renderedHeight - viewport) / 2);
  const x = Math.min(
    maxX,
    Math.max(-maxX, Number.isFinite(offset.x) ? offset.x : 0),
  );
  const y = Math.min(
    maxY,
    Math.max(-maxY, Number.isFinite(offset.y) ? offset.y : 0),
  );
  const size = viewport / scale;
  return {
    zoom: safeZoom,
    renderedWidth,
    renderedHeight,
    offset: { x, y },
    crop: {
      // Clamp floating-point rounding at the source edges as well.
      x: Math.min(width - size, Math.max(0, (width - size) / 2 - x / scale)),
      y: Math.min(height - size, Math.max(0, (height - size) / 2 - y / scale)),
      size,
    },
  };
}

/** Keeps a temporary blob URL alive only while an editor is using it. */
export async function loadAvatarSource(
  input: File | string,
): Promise<AvatarSource> {
  let url: string;
  let revoke = false;
  if (typeof input === "string") {
    if (
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(input)
    )
      throw new Error("format");
    url = input;
  } else {
    if (!["image/png", "image/jpeg", "image/webp"].includes(input.type))
      throw new Error("format");
    if (input.size > MAX_AVATAR_FILE_SIZE) throw new Error("size");
    if (!input.size) throw new Error("image");
    url = URL.createObjectURL(input);
    revoke = true;
  }
  let disposed = false;
  const dispose = () => {
    if (!disposed && revoke) URL.revokeObjectURL(url);
    disposed = true;
  };
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image"));
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 64_000_000
    )
      throw new Error("image");
    return { image, url, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Crop a local image and keep its encoded size within the saved-profile limit. */
export function renderAvatarCrop(
  image: HTMLImageElement,
  zoom = 1,
  offset: AvatarOffset = { x: 0, y: 0 },
  resolution: AvatarResolution = 512,
): string {
  if (resolution !== 256 && resolution !== 512) throw new Error("size");
  const { crop } = getAvatarGeometry(
    image.naturalWidth,
    image.naturalHeight,
    zoom,
    offset,
  );
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  // A neutral background also makes transparent PNGs work in the PDF poster.
  context.fillStyle = "#F1E5CB";
  context.fillRect(0, 0, resolution, resolution);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    resolution,
    resolution,
  );
  for (const quality of [0.9, 0.82, 0.72, 0.6, 0.45]) {
    const result = canvas.toDataURL("image/jpeg", quality);
    if (
      result.startsWith("data:image/jpeg;base64,") &&
      result.length <= MAX_AVATAR_DATA_LENGTH
    )
      return result;
  }
  throw new Error("size");
}

/** Compatibility helper: choose the central square when no editor is needed. */
export async function prepareAvatar(file: File): Promise<string> {
  const source = await loadAvatarSource(file);
  try {
    return renderAvatarCrop(source.image, 1, { x: 0, y: 0 }, 256);
  } finally {
    source.dispose();
  }
}
