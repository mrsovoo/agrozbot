// Brauzerda rasmni siqish (Vercel 4.5MB so'rov limiti uchun)
// Telegram baribir rasmlarni ~1280-2560px gacha kichraytiradi.
export async function compressImage(
  file: File,
  maxSide = 2048,
  maxBytes = 3.5 * 1024 * 1024,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);

  let quality = 0.9;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    if (blob && blob.size <= maxBytes) break;
    quality -= 0.1;
  }
  if (!blob) return file;
  // Agar siqilgan variant kattaroq bo'lib qolsa, asl faylni qaytaramiz
  if (blob.size >= file.size && file.size <= maxBytes) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
