"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { API } from "@/lib/endpoints";

export type Profession = { code: string; name: string };

export type CareProvider = {
  careProviderId: string;
  fullName: string;
  title: string;
  professionCode: string;
};

export function useApplicationCatalog(
  targetInstitution: number,
  professionCode: string,
  enabled: boolean
) {
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [providers, setProviders] = useState<CareProvider[]>([]);
  const [loadingProfessions, setLoadingProfessions] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [professionsError, setProfessionsError] = useState("");
  const [providersError, setProvidersError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoadingProfessions(true);
    setProfessionsError("");
    api<Profession[]>(API.professions(targetInstitution))
      .then((list) => {
        if (!cancelled) setProfessions(list ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setProfessions([]);
          setProfessionsError(
            err instanceof ApiError ? err.message : "Bölüm listesi yüklenemedi."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetInstitution, enabled]);

  useEffect(() => {
    if (!enabled || !professionCode) {
      setProviders([]);
      setProvidersError("");
      return;
    }
    let cancelled = false;
    setLoadingProviders(true);
    setProvidersError("");
    api<CareProvider[]>(API.careProviders(targetInstitution, professionCode))
      .then((list) => {
        if (!cancelled) setProviders(list ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setProviders([]);
          setProvidersError(
            err instanceof ApiError ? err.message : "Doktor listesi yüklenemedi."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProviders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetInstitution, professionCode, enabled]);

  return {
    professions,
    providers,
    loadingProfessions,
    loadingProviders,
    professionsError,
    providersError,
  };
}
