/** Resize a chosen raster image before storing it locally. Never stores remote URLs. */
export async function prepareAvatar(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("format");
  if (file.size > 8 * 1024 * 1024) throw new Error("size");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image"));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("image");
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.fillStyle = "#F1E5CB";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(
      image,
      (image.naturalWidth - size) / 2,
      (image.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    );
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
