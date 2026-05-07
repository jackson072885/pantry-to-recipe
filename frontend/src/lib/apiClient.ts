import { getPantrySessionId } from "./pantrySession";

export type ApiErrorPayload = {
  code: string;
  message: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error: ApiErrorPayload | null;
};

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return isRecord(value) && typeof value.success === "boolean" && "data" in value && "error" in value;
}

function parseJson(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (isApiEnvelope(payload) && payload.error?.message) return payload.error.message;
  if (isRecord(payload) && typeof payload.error === "string") return payload.error;
  if (isRecord(payload) && typeof payload.detail === "string") return payload.detail;
  if (typeof payload === "string" && payload.trim()) return payload;
  return fallback;
}

function normalizeApiPath(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/api/")) return path;
  if (path === "/api") return path;
  if (!path.startsWith("/")) return `/api/${path}`;
  return `/api${path}`;
}

export function unwrapResponse<T>(payload: ApiEnvelope<T>, status = 200): T {
  if (!payload.success) {
    throw new ApiClientError(payload.error?.message ?? "Request failed", status, payload.error?.code);
  }
  return payload.data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestPath = normalizeApiPath(path);
  const headers = new Headers(init?.headers);
  if (!headers.has("X-Pantry-Session-Id")) {
    headers.set("X-Pantry-Session-Id", getPantrySessionId());
  }
  const response = await fetch(requestPath, {
    ...init,
    headers,
  });
  const text = await response.text();
  const payload = parseJson(text);

  if (isApiEnvelope<T>(payload)) {
    return unwrapResponse(payload, response.status);
  }

  if (!response.ok) {
    throw new ApiClientError(
      messageFromPayload(payload, `Request failed (${response.status}) for ${requestPath}`),
      response.status,
    );
  }

  return payload as T;
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

export async function postJson<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return request<T>(path, {
    ...init,
    method: "POST",
    headers,
    body: body === undefined ? init?.body : JSON.stringify(body),
  });
}

export async function postOptional(path: string, body: unknown): Promise<boolean> {
  try {
    await postJson(path, body);
    return true;
  } catch (error: unknown) {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 405)) {
      return false;
    }
    return false;
  }
}
