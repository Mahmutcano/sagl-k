import { clearAuth, getToken, getUser, type AuthUser } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

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
