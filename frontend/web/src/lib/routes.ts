export const ROUTES = {
  home: "/",
  patient: {
    home: "/patient/applications",
    login: "/patient/login",
    register: "/patient/register",
    forgotPassword: "/patient/forgot-password",
    applications: "/patient/applications",
    newApplication: "/patient/applications/new",
    editApplication: (id: string, step?: "details" | "survey" | "preview" | "payment") =>
      step
        ? `/patient/applications/new?edit=${encodeURIComponent(id)}&step=${step}`
        : `/patient/applications/new?edit=${encodeURIComponent(id)}`,
    application: (id: string) => `/patient/applications/${id}`,
    results: "/patient/results",
    profile: "/patient/profile",
  },
  doctor: {
    home: "/doctor/dashboard",
    login: "/doctor/login",
    dashboard: "/doctor/dashboard",
    nurse: "/doctor/nurse",
    applications: "/doctor/applications",
    newApplication: "/doctor/applications/new",
    application: (id: string) => `/doctor/applications/${id}`,
    profile: "/doctor/profile",
  },
  admin: {
    home: "/admin",
    login: "/admin/login",
    doctors: "/admin/doctors",
    hospitals: "/admin/hospitals",
    departments: "/admin/departments",
    payments: "/admin/payments",
    refunds: "/admin/refunds",
    notifications: "/admin/notifications",
    application: (id: string) => `/admin/applications/${id}`,
    users: "/admin/users",
    logs: "/admin/logs",
    titles: "/admin/titles",
    profile: "/admin/profile",
  },
} as const;
