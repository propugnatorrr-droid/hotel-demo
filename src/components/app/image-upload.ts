'use client';

/** Downscales a photo to a JPEG data URL (max 1280px; fewer pixels = fewer vision tokens = cheaper, still sharp enough for printed text) so uploads stay small and fast on mobile. */
export async function compressImage(file: File, max = 1280, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

export async function scanImage<T>(kind: 'receipt' | 'passport', file: File): Promise<{ ok: true; data: T | null; receiptPath?: string | null } | { ok: false; error: string }> {
  try {
    const image = await compressImage(file);
    const res = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, image }) });
    const json = (await res.json()) as { data?: T | null; receiptPath?: string | null; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? 'failed' };
    return { ok: true, data: json.data ?? null, receiptPath: json.receiptPath };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
