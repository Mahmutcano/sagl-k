export const API = {
  auth: {
    login: "/api/v1/auth/login",
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
    assess: (id: string) => `/api/v1/applications/${id}/assess`,
    sendToDoctor: (id: string) => `/api/v1/applications/${id}/send-to-doctor`,
    reportDraft: (id: string) => `/api/v1/applications/${id}/report/draft`,
    conclude: (id: string) => `/api/v1/applications/${id}/conclude`,
    notes: (id: string) => `/api/v1/applications/${id}/notes`,
    payment: (id: string, provider = "param") =>
      `/api/v1/applications/${id}/payment?provider=${provider}`,
  },
  erciyes: {
    inpatientStatus: "/api/v1/integrations/erciyes/inpatient-status",
    pacsUrl: "/api/v1/integrations/erciyes/pacs-url",
  },
} as const;
