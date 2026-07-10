import { errorsToMap, type FieldError, type FieldErrors } from "./validation";
import { API } from "./endpoints";
import {
  getToken,
  clearAuth,
  setToken,
  setUser,
  getRefreshToken,
  setRefreshToken,
  type AuthUser,
} from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ApiEnvelope<T> = {
  hasError: boolean;
  responseCode: string;
  responseMessage: string;
  result?: T;
  details?: {
    fields?: FieldError[];
  };
};

export class ApiError extends Error {
  code: string;
  fields: FieldErrors;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code = "ERROR",
    fields: FieldErrors = {},
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}${API.auth.refresh}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        const body = (await res.json()) as ApiEnvelope<{
          accessToken: string;
          refreshToken: string;
          user?: AuthUser;
        }>;
        if (body.hasError || !res.ok || !body.result?.accessToken) {
          clearAuth();
          return null;
        }
        setToken(body.result.accessToken);
        if (body.result.refreshToken) setRefreshToken(body.result.refreshToken);
        if (body.result.user) setUser(body.result.user);
        return body.result.accessToken;
      } catch {
        clearAuth();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("Sunucudan geçersiz yanıt alındı.", "NET001");
  }

  if (body.hasError || !res.ok) {
    const fields = body.details?.fields
      ? errorsToMap(body.details.fields)
      : {};
    const extra =
      body.details && typeof body.details === "object" && !Array.isArray(body.details)
        ? (body.details as Record<string, unknown>)
        : undefined;
    throw new ApiError(
      body.responseMessage || "İstek başarısız oldu.",
      body.responseCode || "ERROR",
      fields,
      extra
    );
  }
  return body.result as T;
}

/** HTML/binary responses with bearer auth and token refresh (not JSON envelope). */
export async function fetchTextWithAuth(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const authToken = token ?? getToken() ?? "";
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && authToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  return res;
}

export {
  getToken,
  getUser,
  clearAuth,
  persistAuth,
  type AuthUser,
  isPatientRole,
  isDoctorRole,
  isAdminRole,
} from "./auth";
