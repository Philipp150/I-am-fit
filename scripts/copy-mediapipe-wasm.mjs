#!/usr/bin/env node
/**
 * Copy the MediaPipe vision WASM runtime into `public/mediapipe/wasm` so pose detection loads from
 * our own origin. Without this the browser has to reach jsdelivr, and a blocked or slow CDN looks
 * exactly like a broken feature. The CDN stays as a runtime fallback (`pose-landmarker.ts`).
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const target = resolve(root, "public/mediapipe/wasm");

if (!existsSync(source)) {
  console.warn(`[mediapipe] ${source} not found – the CDN fallback stays in charge.`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
const files = await readdir(target);
console.log(`[mediapipe] copied ${files.length} WASM files to public/mediapipe/wasm`);
