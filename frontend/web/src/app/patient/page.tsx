import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PatientLandingPage() {
  return (
    <main className="min-h-svh flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle>Hasta portalı</CardTitle>
          <CardDescription>Başvurularınızı yönetin</CardDescription>
        </CardHeader>
        <CardFooter className="border-t flex flex-col gap-2 pt-6">
          <Button asChild>
            <Link href={ROUTES.patient.login}>Giriş yap</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={ROUTES.patient.register}>Kayıt ol</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
