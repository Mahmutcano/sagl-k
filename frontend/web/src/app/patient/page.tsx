import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** /patient → giriş (kayıt değil). Hesabı olmayanlar giriş ekranından kayıt olur. */
export default function PatientLandingPage() {
  redirect(ROUTES.patient.login);
}
