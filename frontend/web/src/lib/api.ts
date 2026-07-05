import { errorsToMap, type FieldError, type FieldErrors } from "./validation";
import { API } from "./endpoints";

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

  constructor(message: string, code = "ERROR", fields: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
  }
}

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "authUser";

let refreshPromise: Promise<string | null> | null = null;

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_KEY, token);
}

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
    throw new ApiError(
      body.responseMessage || "İstek başarısız oldu.",
      body.responseCode || "ERROR",
      fields
    );
  }
  return body.result as T;
}

export type AuthUser = {
  id: string;
  role: string;
  isDoctor?: boolean;
  isNurse?: boolean;
  isDeveloper?: boolean;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function persistAuth(result: {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
}) {
  setToken(result.accessToken);
  if (result.refreshToken) setRefreshToken(result.refreshToken);
  if (result.user) setUser(result.user);
}

export { isPatientRole, isDoctorRole, isAdminRole } from "./auth";
