"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function DoctorApplicationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(ROUTES.doctor.dashboard);
  }, [router]);
  return null;
}
