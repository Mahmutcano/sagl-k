import {
  clearAuth,
  getToken,
  getUser,
  type AuthUser,
} from "@/lib/api";

export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "developer";
}

export function portalHome(): string {
  return "/";
}

export function portalLogin(): string {
  return "/login";
}

export function roleAllowedForPortal(role: string | undefined): boolean {
  return isAdminRole(role);
}

export function requirePortalSession(): { token: string; user: AuthUser } | null {
  const token = getToken();
  const user = getUser();
  if (!token || !user || !isAdminRole(user.role)) return null;
  return { token, user };
}

export function logoutTo(): string {
  clearAuth();
  return portalLogin();
}

export function roleLabel(role?: string): string {
  switch (role) {
    case "admin":
      return "Yönetici";
    case "developer":
      return "Geliştirici";
    default:
      return role ?? "";
  }
}
