import { promises as fs } from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import { AppState, createDefaultState } from "./types";

const STATE_KEY = "aquashift:state";
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

function useKv(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function readFileState(): Promise<AppState> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as AppState;
  } catch {
    return createDefaultState();
  }
}

async function writeFileState(state: AppState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state), "utf-8");
}

export async function getServerState(): Promise<AppState> {
  if (useKv()) {
    const data = await kv.get<AppState>(STATE_KEY);
    return data ?? createDefaultState();
  }
  return readFileState();
}

export async function setServerState(state: AppState): Promise<void> {
  if (useKv()) {
    await kv.set(STATE_KEY, state);
    return;
  }
  await writeFileState(state);
}

export function storageMode(): "kv" | "file" {
  return useKv() ? "kv" : "file";
}
