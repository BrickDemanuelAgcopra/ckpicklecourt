import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Receipts and admin uploads live on a mounted volume (DATA_DIR), never in /public. */
export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function saveUpload(folder: string, file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Only JPG, PNG, WebP or PDF files are accepted");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 10 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const rel = path.posix.join(folder, `${randomUUID()}${ext}`);
  const abs = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return rel;
}

export async function readUpload(rel: string): Promise<{ buf: Buffer; type: string } | null> {
  const safe = path.posix.normalize(rel).replace(/^(\.\.\/|\/)+/, "");
  if (safe.includes("..")) return null;
  const abs = path.join(DATA_DIR, safe);
  try {
    await stat(abs);
  } catch {
    return null;
  }
  const buf = await readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
  return { buf, type };
}
