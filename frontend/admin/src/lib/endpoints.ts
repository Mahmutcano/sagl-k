export const API = {
  auth: {
    login: "/api/v1/auth/login",
  },
  applications: {
    detail: (id: string) => `/api/v1/applications/${id}`,
  },
  admin: {
    applications: "/api/v1/admin/applications",
    applicationHistory: (id: string) => `/api/v1/admin/applications/${id}/history`,
    hospitals: "/api/v1/admin/hospitals",
    doctors: "/api/v1/admin/doctors",
    payments: "/api/v1/admin/payments",
    refunds: "/api/v1/admin/refunds",
    notifications: "/api/v1/admin/notifications",
    erciyesHealth: "/api/v1/admin/integrations/erciyes/health",
  },
} as const;
