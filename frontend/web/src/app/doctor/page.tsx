"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DoctorLandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <main className="min-h-svh flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle>Doktor paneli</CardTitle>
          <CardDescription>Size atanan başvuruları değerlendirin</CardDescription>
        </CardHeader>
        <CardFooter className="border-t flex flex-col gap-2 pt-6">
          <Button asChild>
            <Link href={ROUTES.doctor.login}>Giriş yap</Link>
          </Button>
          <Button variant="ghost" onClick={() => router.push(ROUTES.home)}>
            Ana sayfa
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
