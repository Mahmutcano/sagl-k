import { ROUTES } from "@/lib/routes";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "authUser";

export type AuthUser = {
  id: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isDoctor?: boolean;
  isNurse?: boolean;
  isDeveloper?: boolean;
};

export function userDisplayName(user: AuthUser | null | undefined): string {
  if (!user) return "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || roleLabel(user.role);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_KEY, token);
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

export type AppArea = "patient" | "doctor" | "admin";

export function isPatientRole(role?: string): boolean {
  return role === "patient";
}

export function isDoctorRole(role?: string): boolean {
  return role === "doctor";
}

export function isNurseRole(role?: string): boolean {
  return role === "nurse";
}

export function isStaffRole(role?: string): boolean {
  return isDoctorRole(role) || isNurseRole(role) || isAdminRole(role);
}

export function canAccessPatientArea(role?: string): boolean {
  return isNurseRole(role) || isAdminRole(role);
}

export function homeForArea(area: AppArea, role?: string): string {
  switch (area) {
    case "patient":
      return ROUTES.patient.home;
    case "doctor":
      if (isNurseRole(role)) return ROUTES.doctor.nurse;
      return ROUTES.doctor.home;
    case "admin":
      return ROUTES.admin.home;
  }
}

export function loginForArea(area: AppArea): string {
  switch (area) {
    case "patient":
      return ROUTES.patient.login;
    case "doctor":
      return ROUTES.doctor.login;
    case "admin":
      return ROUTES.admin.login;
  }
}

export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "developer";
}

export function roleAllowedForArea(area: AppArea, role?: string): boolean {
  switch (area) {
    case "patient":
      return isPatientRole(role);
    case "doctor":
      return isStaffRole(role);
    case "admin":
      return isAdminRole(role);
  }
}

/** @deprecated use roleAllowedForArea */
export function roleAllowedForPortal(role: string | undefined, area: AppArea = "patient"): boolean {
  return roleAllowedForArea(area, role);
}

/** @deprecated use homeForArea */
export function portalHome(area: AppArea = "patient"): string {
  return homeForArea(area);
}

/** @deprecated use loginForArea */
export function portalLogin(area: AppArea = "patient"): string {
  return loginForArea(area);
}

export function requireSession(
  area: AppArea,
  sub?: "patient-area"
): { token: string; user: AuthUser } | null {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return null;

  if (area === "patient" && !isPatientRole(user.role)) return null;
  if (area === "admin" && !isAdminRole(user.role)) return null;
  if (area === "doctor") {
    if (sub === "patient-area") {
      if (!canAccessPatientArea(user.role)) return null;
    } else if (!isStaffRole(user.role)) {
      return null;
    }
  }
  return { token, user };
}

/** Doctor app legacy: "patient" = staff patient-area */
export function requirePortalSession(
  sub: "doctor" | "patient" = "doctor"
): { token: string; user: AuthUser } | null {
  if (sub === "patient") return requireSession("doctor", "patient-area");
  return requireSession("doctor");
}

export function logoutTo(area: AppArea): string {
  clearAuth();
  return loginForArea(area);
}

export function roleLabel(role?: string): string {
  switch (role) {
    case "patient":
      return "Hasta";
    case "doctor":
      return "Doktor";
    case "nurse":
      return "Hemşire";
    case "admin":
      return "Yönetici";
    case "developer":
      return "Geliştirici";
    default:
      return role ?? "";
  }
}
