import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@vercel/kv";

const AUTH_KEY = "aquashift:auth";
const DATA_DIR = path.join(process.cwd(), ".data");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

export interface AuthData {
  adminPasswordHash: string | null;
  roommatePasswords: Record<string, string>;
}

export function createDefaultAuth(): AuthData {
  return { adminPasswordHash: null, roommatePasswords: {} };
}

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

async function readFileAuth(): Promise<AuthData> {
  try {
    const raw = await fs.readFile(AUTH_FILE, "utf-8");
    return JSON.parse(raw) as AuthData;
  } catch {
    return createDefaultAuth();
  }
}

async function writeFileAuth(data: AuthData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(AUTH_FILE, JSON.stringify(data), "utf-8");
}

export async function getAuthData(): Promise<AuthData> {
  const kv = getKv();
  if (kv) {
    const data = await kv.get<AuthData>(AUTH_KEY);
    return data ?? createDefaultAuth();
  }
  return readFileAuth();
}

export async function setAuthData(data: AuthData): Promise<void> {
  const kv = getKv();
  if (kv) {
    await kv.set(AUTH_KEY, data);
    return;
  }
  await writeFileAuth(data);
}

export function roommateHasPassword(auth: AuthData, roommateId: string): boolean {
  return Boolean(auth.roommatePasswords[roommateId]);
}
