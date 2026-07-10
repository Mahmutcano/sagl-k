"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { isConcludedStatus } from "@/lib/application";
import { DoctorAppShell } from "@/components/DoctorAppShell";
import { FormAlert } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, FileCheck, Percent, Users, Wallet } from "lucide-react";

type Stats = {
  total: number;
  waitingReport: number;
  draft: number;
  concluded: number;
  consultationFee: number;
  revenueSharePercent: number;
  estimatedGross: number;
  estimatedDoctorShare: number;
};

type QueueItem = {
  statusCode: number;
  hasDraft?: boolean;
};

type QueueResponse = {
  items?: QueueItem[];
  totalCount?: number;
};

async function loadStatsFallback(token: string): Promise<Stats> {
  const queue = await api<QueueResponse>(
    API.applications.doctorQueue,
    {
      method: "POST",
      body: JSON.stringify({ page: 0, pageSize: 100, category: "all" }),
    },
    token
  );
  const items = queue.items ?? [];
  let waitingReport = 0;
  let draft = 0;
  let concluded = 0;
  for (const item of items) {
    if (isConcludedStatus(item.statusCode)) {
      concluded += 1;
    } else if (item.hasDraft) {
      draft += 1;
    } else {
      waitingReport += 1;
    }
  }
  const consultationFee = 1500;
  const revenueSharePercent = 70;
  const estimatedGross = concluded * consultationFee;
  return {
    total: queue.totalCount ?? items.length,
    waitingReport,
    draft,
    concluded,
    consultationFee,
    revenueSharePercent,
    estimatedGross,
    estimatedDoctorShare: (estimatedGross * revenueSharePercent) / 100,
  };
}

export default function DoctorStatsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace(ROUTES.doctor.login);
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return api<Stats>(API.applications.doctorQueueStats, {}, session.token)
      .then((res) => setStats(res))
      .catch(async (err) => {
        // Production API henüz deploy edilmediyse eski kuyruk endpoint'ine düş.
        try {
          const fallback = await loadStatsFallback(session.token);
          setStats(fallback);
        } catch {
          setError(err instanceof ApiError ? err.message : "Özet yüklenemedi.");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DoctorAppShell
      title="Özet panel"
      description="Size atanan başvuruların özeti"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={ROUTES.doctor.dashboard} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Başvurular
          </Link>
        </Button>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {loading || !stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Toplam hasta
              </CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Size atanan başvuru</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Rapor bekleyen
              </CardDescription>
              <CardTitle className="text-2xl">{stats.waitingReport}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Henüz taslak yok</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Taslak / sonuçlanan
              </CardDescription>
              <CardTitle className="text-2xl">
                {stats.draft} / {stats.concluded}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Taslak · Sonuçlandı</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Percent className="h-4 w-4" /> Doktor payı
              </CardDescription>
              <CardTitle className="text-2xl">%{stats.revenueSharePercent}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Ücret: {stats.consultationFee.toLocaleString("tr-TR")} ₺
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Tahmini brüt
              </CardDescription>
              <CardTitle className="text-2xl">
                {stats.estimatedGross.toLocaleString("tr-TR")} ₺
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Sonuçlanan × ücret</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Tahmini doktor payı
              </CardDescription>
              <CardTitle className="text-2xl">
                {stats.estimatedDoctorShare.toLocaleString("tr-TR")} ₺
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Brüt × %{stats.revenueSharePercent}
            </CardContent>
          </Card>
        </div>
      )}
    </DoctorAppShell>
  );
}
