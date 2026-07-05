import {
  clearAuth,
  getToken,
  getUser,
  type AuthUser,
} from "@/lib/api";

export function isDoctorRole(role?: string): boolean {
  return role === "doctor" || role === "nurse";
}

export function canAccessPatientArea(role?: string): boolean {
  return isDoctorRole(role);
}

export function portalHome(): string {
  return "/dashboard";
}

export function portalLogin(): string {
  return "/login";
}

export function roleAllowedForPortal(role: string | undefined): boolean {
  return isDoctorRole(role);
}

export function requirePortalSession(area: "doctor" | "patient" = "doctor"): {
  token: string;
  user: AuthUser;
} | null {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return null;
  const ok = area === "patient" ? canAccessPatientArea(user.role) : isDoctorRole(user.role);
  if (!ok) return null;
  return { token, user };
}

export function logoutTo(): string {
  clearAuth();
  return portalLogin();
}

export function roleLabel(role?: string): string {
  switch (role) {
    case "doctor":
      return "Doktor";
    case "nurse":
      return "Hemşire";
    default:
      return role ?? "";
  }
}
