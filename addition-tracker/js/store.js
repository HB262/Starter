// State, persistence, and photo storage.
//
// The seed comes from data/project-data.js. Edits made in the app are saved to
// localStorage; photos are saved to IndexedDB as downscaled JPEG blobs.

import seed from "../data/project-data.js";

const STATE_KEY = "addition-tracker:state:v1";
const SEED_KEY = "addition-tracker:seed-hash:v1";

const listeners = new Set();
let state = null;

const clone = (o) => JSON.parse(JSON.stringify(o));

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
export const seedHash = hash(JSON.stringify(seed));

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function load() {
  const saved = safeGet(STATE_KEY);
  if (saved) {
    try { state = JSON.parse(saved); } catch { state = null; }
  }
  if (!state) state = clone(seed);
  return state;
}

// True when data/project-data.js has changed since this browser last saved.
export function seedChanged() {
  const saved = safeGet(SEED_KEY);
  return !!safeGet(STATE_KEY) && saved !== null && saved !== seedHash;
}

export function getState() {
  return state;
}

export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l(state));
}

function save() {
  safeSet(STATE_KEY, JSON.stringify(state));
  safeSet(SEED_KEY, seedHash);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceState(next) {
  state = next;
  save();
  listeners.forEach((l) => l(state));
}

export function resetToSeed() {
  replaceState(clone(seed));
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Photos (IndexedDB) ─────────────────────────────────────────────────────

const DB_NAME = "addition-tracker";
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("photos");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("photos", mode);
    const store = t.objectStore("photos");
    const result = fn(store);
    t.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export const photos = {
  put: (id, blob) => tx("readwrite", (s) => s.put(blob, id)),
  get: (id) => tx("readonly", (s) => s.get(id)),
  delete: (id) => tx("readwrite", (s) => s.delete(id)),
  async keys() {
    return tx("readonly", (s) => s.getAllKeys());
  },
};

const urlCache = new Map();
export async function photoUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await photos.get(id).catch(() => null);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

// Downscale a picked image so the browser store stays small.
export async function downscale(file, maxSide = 1800, quality = 0.85) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), "image/jpeg", quality));
}

// ── Export / import ────────────────────────────────────────────────────────

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });

export async function exportAll() {
  const photoData = {};
  const ids = new Set(state.events.flatMap((e) => e.photos || []));
  for (const id of ids) {
    const blob = await photos.get(id).catch(() => null);
    if (blob) photoData[id] = await blobToDataUrl(blob);
  }
  return { format: "addition-tracker", version: 1, exportedAt: new Date().toISOString(), state, photos: photoData };
}

export async function importAll(json) {
  if (json?.format !== "addition-tracker" || !json.state) throw new Error("This file isn't a tracker export.");
  for (const [id, dataUrl] of Object.entries(json.photos || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await photos.put(id, blob);
  }
  urlCache.clear();
  replaceState(json.state);
}
