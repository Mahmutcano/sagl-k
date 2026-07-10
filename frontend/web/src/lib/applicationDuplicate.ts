import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApiError } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

export function redirectIfDuplicateApplication(
  err: unknown,
  router: AppRouterInstance
): boolean {
  if (!(err instanceof ApiError) || err.code !== "APP040") return false;
  const existingId = err.details?.existingApplicationId;
  const reason = err.details?.reason;
  if (typeof existingId !== "string") return false;

  if (reason === "payment_pending") {
    router.push(ROUTES.patient.editApplication(existingId, "details"));
  } else {
    router.push(ROUTES.patient.application(existingId));
  }
  return true;
}
