export const API = {
  auth: {
    login: "/api/v1/auth/login",
    refresh: "/api/v1/auth/refresh",
    agreements: "/api/v1/auth/agreements",
    registerInitiate: "/api/v1/auth/register/initiate",
    registerComplete: "/api/v1/auth/register/complete",
    forgotInitiate: "/api/v1/auth/password/forgot/initiate",
    forgotComplete: "/api/v1/auth/password/forgot/complete",
  },
  professions: (targetInstitution: number) =>
    `/api/v1/professions?targetInstitution=${targetInstitution}`,
  careProviders: (targetInstitution: number, professionCode: string) =>
    `/api/v1/care-providers?targetInstitution=${targetInstitution}&professionCode=${encodeURIComponent(professionCode)}`,
  applications: {
    create: "/api/v1/applications",
    mine: "/api/v1/applications/mine",
    doctorQueue: "/api/v1/applications/queue/doctor",
    nurseQueue: "/api/v1/applications/queue/nurse",
    detail: (id: string) => `/api/v1/applications/${id}`,
    attachments: (id: string) => `/api/v1/applications/${id}/attachments`,
    attachment: (id: string, attachmentId: string) =>
      `/api/v1/applications/${id}/attachments/${attachmentId}`,
    payment: (id: string) => `/api/v1/applications/${id}/payment`,
    report: (id: string) => `/api/v1/applications/${id}/report`,
    assess: (id: string) => `/api/v1/applications/${id}/assess`,
    sendToDoctor: (id: string) => `/api/v1/applications/${id}/send-to-doctor`,
    reportDraft: (id: string) => `/api/v1/applications/${id}/report/draft`,
    conclude: (id: string) => `/api/v1/applications/${id}/conclude`,
    notes: (id: string) => `/api/v1/applications/${id}/notes`,
  },
  erciyes: {
    inpatientStatus: "/api/v1/integrations/erciyes/inpatient-status",
    pacsUrl: "/api/v1/integrations/erciyes/pacs-url",
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
