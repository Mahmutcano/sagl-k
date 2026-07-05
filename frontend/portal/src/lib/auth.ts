import {
  clearAuth,
  getToken,
  getUser,
  type AuthUser,
} from "@/lib/api";

export function isPatientRole(role?: string): boolean {
  return role === "patient";
}

export function portalHome(): string {
  return "/applications";
}

export function portalLogin(): string {
  return "/login";
}

export function roleAllowedForPortal(role: string | undefined): boolean {
  return isPatientRole(role);
}

export function requirePortalSession(): { token: string; user: AuthUser } | null {
  const token = getToken();
  const user = getUser();
  if (!token || !user || !isPatientRole(user.role)) return null;
  return { token, user };
}

export function logoutTo(): string {
  clearAuth();
  return portalLogin();
}

export function roleLabel(role?: string): string {
  return role === "patient" ? "Hasta" : role ?? "";
}
