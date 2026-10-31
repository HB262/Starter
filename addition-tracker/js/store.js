// State, persistence, and photo storage.
//
// Two backends:
// - "local": opened as a plain web page. The seed comes from
//   data/project-data.js; edits are saved to localStorage and photos to
//   IndexedDB in this browser.
// - "cloud": opened as a claude.ai Artifact. Records live in the artifact's
//   shared `db` (collections budget, expenses, tasks, events, plus the
//   meta/project document) and photos in its `assets` store, so they follow
//   the owner across devices. The 3D model geometry still comes from
//   data/project-data.js.

import seed from "../data/project-data.js";

const STATE_KEY = "addition-tracker:state:v1";
const SEED_KEY = "addition-tracker:seed-hash:v1";
const COLLECTIONS = ["budget", "expenses", "tasks", "events"];

const listeners = new Set();
let state = null;
let errorHandler = (msg) => console.error(msg);

const clone = (o) => JSON.parse(JSON.stringify(o));

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
export const seedHash = hash(JSON.stringify(seed));

export const backend = typeof window.claude?.use === "function" ? "cloud" : "local";
// cloud status: "connecting" | "ready" | "unavailable" | "readonly"
export const cloud = { status: backend === "cloud" ? "connecting" : null, db: null, assets: null, downloads: null };

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

const notify = () => listeners.forEach((l) => l(state));

export function onError(fn) {
  errorHandler = fn;
}

export function load() {
  if (backend === "cloud") {
    state = {
      placeholder: {},
      project: { name: seed.project.name, address: "", startDate: seed.project.startDate },
      model: clone(seed.model),
      permit: null,
      budget: [], expenses: [], tasks: [], events: [],
    };
    connectCloud();
    return state;
  }
  const saved = safeGet(STATE_KEY);
  if (saved) {
    try { state = JSON.parse(saved); } catch { state = null; }
  }
  if (!state) state = clone(seed);
  if (!state.permit) state.permit = clone(seed.permit);
  return state;
}

// True when data/project-data.js has changed since this browser last saved.
export function seedChanged() {
  if (backend === "cloud") return false;
  const saved = safeGet(SEED_KEY);
  return !!safeGet(STATE_KEY) && saved !== null && saved !== seedHash;
}

export function getState() {
  return state;
}

export function update(fn) {
  const prev = clone(state);
  fn(state);
  if (backend === "cloud") persistCloud(prev, state);
  else saveLocal();
  notify();
}

function saveLocal() {
  safeSet(STATE_KEY, JSON.stringify(state));
  safeSet(SEED_KEY, seedHash);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceState(next) {
  const prev = clone(state);
  state = { ...next, model: backend === "cloud" ? clone(seed.model) : next.model };
  if (backend === "cloud") persistCloud(prev, state);
  else saveLocal();
  notify();
}

export function resetToSeed() {
  replaceState(clone(seed));
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Cloud backend ──────────────────────────────────────────────────────────

async function connectCloud() {
  const [db, assets, downloads] = await Promise.all(
    ["db", "assets", "downloads"].map((n) => window.claude.use(n).catch(() => null)),
  );
  Object.assign(cloud, { db, assets, downloads });
  if (!db) {
    cloud.status = "unavailable";
    notify();
    return;
  }
  const pending = new Set([...COLLECTIONS, "meta", "permit"]);
  const settle = (k) => {
    pending.delete(k);
    if (!pending.size && cloud.status === "connecting") cloud.status = "ready";
    notify();
  };
  for (const c of COLLECTIONS) {
    db.collection(c).onSnapshot(
      (snap) => {
        state[c] = snap.docs
          .map((d) => clone(d.data()))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(({ order, ...rest }) => rest);
        settle(c);
      },
      (e) => errorHandler(`Couldn't load ${c} (${e.code}).`),
    );
  }
  db.doc("meta/project").onSnapshot(
    (snap) => {
      if (snap.exists) {
        const d = snap.data();
        state.project = clone(d.project || state.project);
        state.placeholder = clone(d.placeholder || {});
      }
      settle("meta");
    },
    (e) => errorHandler(`Couldn't load project details (${e.code}).`),
  );
  db.doc("meta/permit").onSnapshot(
    (snap) => {
      state.permit = snap.exists ? clone(snap.data()) : null;
      settle("permit");
    },
    (e) => errorHandler(`Couldn't load the permit (${e.code}).`),
  );
}

let writeChain = Promise.resolve();
function queueWrite(label, fn) {
  writeChain = writeChain.then(fn).catch((e) => {
    if (e?.code === "invalid_argument") cloud.status = "readonly";
    errorHandler(e?.code === "quota_exceeded"
      ? "The tracker's storage is full. Delete some old entries and try again."
      : e?.code === "invalid_argument"
        ? "You can view this tracker but not change it."
        : `Couldn't save ${label} (${e?.code || e?.message || "error"}). Try again.`);
    notify();
  });
  return writeChain;
}

function persistCloud(prev, next) {
  const db = cloud.db;
  if (!db) { errorHandler("Not connected, so changes can't be saved. Reload the page."); return; }
  for (const c of COLLECTIONS) {
    const before = new Map((prev[c] || []).map((x, i) => [x.id, JSON.stringify({ ...x, order: i })]));
    const after = new Map();
    (next[c] || []).forEach((x, i) => {
      const body = { ...x, order: i };
      after.set(x.id, true);
      const s = JSON.stringify(body);
      if (before.get(x.id) !== s) queueWrite(c, () => db.collection(c).doc(x.id).set(clone(body)));
    });
    for (const id of before.keys()) if (!after.has(id)) queueWrite(c, () => db.collection(c).doc(id).delete());
  }
  const meta = (s) => JSON.stringify({ project: s.project, placeholder: s.placeholder });
  if (meta(prev) !== meta(next)) {
    queueWrite("project details", () => db.doc("meta/project").set(clone({ project: next.project, placeholder: next.placeholder || {} })));
  }
  if (next.permit && JSON.stringify(prev.permit) !== JSON.stringify(next.permit)) {
    queueWrite("the permit", () => db.doc("meta/permit").set(clone(next.permit)));
  }
}

// ── Photos ─────────────────────────────────────────────────────────────────
// Cloud: asset ids, served at /_blob/<id>. Local: IndexedDB blobs.

const DB_NAME = "addition-tracker";
let dbPromise = null;

function idb() {
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
  const d = await idb();
  return new Promise((resolve, reject) => {
    const t = d.transaction("photos", mode);
    const result = fn(t.objectStore("photos"));
    t.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

const localPhotos = {
  put: (id, blob) => tx("readwrite", (s) => s.put(blob, id)),
  get: (id) => tx("readonly", (s) => s.get(id)),
  delete: (id) => tx("readwrite", (s) => s.delete(id)),
};

export function canUploadPhotos() {
  return backend === "local" || !!cloud.assets;
}

// Saves a picked image and resolves its photo id.
export async function savePhoto(file) {
  const blob = await downscale(file);
  if (backend === "cloud") {
    if (!cloud.assets) throw new Error("Photo uploads need edit access to this tracker.");
    const res = await cloud.assets.upload(blob);
    return res.id;
  }
  const id = uid("ph");
  await localPhotos.put(id, blob);
  return id;
}

export function deletePhoto(id) {
  if (backend === "cloud") return cloud.assets?.delete(id).catch(() => {});
  return localPhotos.delete(id).catch(() => {});
}

const urlCache = new Map();
export async function photoUrl(id) {
  if (backend === "cloud") return `/_blob/${id}`;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await localPhotos.get(id).catch(() => null);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

// Downscale a picked image so storage stays small.
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
    const blob = backend === "cloud"
      ? await fetch(`/_blob/${id}`).then((r) => (r.ok ? r.blob() : null)).catch(() => null)
      : await localPhotos.get(id).catch(() => null);
    if (blob) photoData[id] = await blobToDataUrl(blob);
  }
  const { model, ...records } = state;
  return { format: "addition-tracker", version: 1, exportedAt: new Date().toISOString(), state: { ...records, model }, photos: photoData };
}

export async function importAll(json) {
  if (json?.format !== "addition-tracker" || !json.state) throw new Error("This file isn't a tracker backup.");
  const next = clone(json.state);
  const remap = {};
  for (const [id, dataUrl] of Object.entries(json.photos || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    if (backend === "cloud") {
      if (!cloud.assets) break;
      remap[id] = (await cloud.assets.upload(blob)).id;
    } else {
      await localPhotos.put(id, blob);
    }
  }
  if (Object.keys(remap).length) for (const e of next.events || []) e.photos = (e.photos || []).map((p) => remap[p] || p);
  urlCache.clear();
  replaceState(next);
}

// Offers a file to the viewer. Resolves false if this view can't save files.
export async function saveFile(filename, text, type = "application/json") {
  if (backend === "cloud") {
    if (!cloud.downloads) return false;
    await cloud.downloads.save({ filename, data: new Blob([text], { type }) });
    return true;
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}
