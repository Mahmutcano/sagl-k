import { errorsToMap, type FieldError, type FieldErrors } from "./validation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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

const TOKEN_KEY = "accessToken";
const USER_KEY = "authUser";

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
  sessionStorage.removeItem(USER_KEY);
}

export { isPatientRole } from "./auth";
