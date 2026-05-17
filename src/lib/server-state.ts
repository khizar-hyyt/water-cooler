import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@vercel/kv";
import { AppState, createDefaultState, normalizeState } from "./types";

const STATE_KEY = "aquashift:state";
/** Vercel's project dir is read-only; use /tmp so file mode works on a warm instance. */
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "aquashift-data")
  : path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

/** Upstash (Marketplace) or legacy Vercel KV env names */
function redisCredentials(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function getKv() {
  const creds = redisCredentials();
  if (!creds) return null;
  return createClient({ url: creds.url, token: creds.token });
}

async function readFileState(): Promise<AppState> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return createDefaultState();
  }
}

async function writeFileState(state: AppState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state), "utf-8");
}

export async function getServerState(): Promise<AppState> {
  const kv = getKv();
  if (kv) {
    const data = await kv.get<Partial<AppState>>(STATE_KEY);
    return data ? normalizeState(data) : createDefaultState();
  }
  return readFileState();
}

export async function setServerState(state: AppState): Promise<void> {
  const kv = getKv();
  if (kv) {
    await kv.set(STATE_KEY, state);
    return;
  }
  await writeFileState(state);
}

/** Write then read back so callers return what is actually stored. */
export async function saveServerState(state: AppState): Promise<AppState> {
  await setServerState(state);
  const stored = normalizeState(await getServerState());
  const expectedRev = state.revision ?? 0;
  const storedRev = stored.revision ?? 0;
  if (storedRev < expectedRev) {
    await setServerState(state);
    return normalizeState(await getServerState());
  }
  return stored;
}

export function storageMode(): "kv" | "file" {
  return redisCredentials() ? "kv" : "file";
}

/** False on Vercel without Upstash/Redis — writes do not survive across requests. */
export function isPersistentStorage(): boolean {
  return redisCredentials() !== null;
}
