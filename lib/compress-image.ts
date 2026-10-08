"use client";

// Reduz uma foto antes do upload: no máximo 1600px no lado maior, em WebP.
// Uma foto de celular de 4 MB costuma cair para 150–300 KB, o que poupa o
// armazenamento e a banda do Supabase em cada visita ao funil.
// GIF (pode ser animado) e SVG passam sem mudança, assim como qualquer
// imagem que o navegador não consiga ler (ex.: HEIC no Chrome).

const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || /gif|svg/.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", QUALITY));
  // Navegador sem WebP devolve PNG; se não ficou menor, mantém o original.
  if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
}
