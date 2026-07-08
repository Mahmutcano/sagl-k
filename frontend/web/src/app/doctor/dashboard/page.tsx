"use client";

import { ROUTES } from "@/lib/routes";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { DoctorAppShell } from "@/components/DoctorAppShell";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { ListLinkCard } from "@/components/AppShellLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { FormAlert } from "@/components/FormField";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { applicationDisplayNumber, isConcludedStatus } from "@/lib/application";
import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";

type DoctorQueueCategory = "all" | "pending_report" | "draft" | "concluded";
type DoctorQueueSortBy = "created_at" | "patient_name" | "status_code" | "application_number";
type DoctorQueueSortDir = "asc" | "desc";

type ApplicationItem = {
  applicationId: string;
  applicationNumber?: string;
  statusCode: number;
  ecommerceNumber?: string;
  professionName?: string;
  patientName?: string;
  hasDraft?: boolean;
  createdAt: string;
};

const CATEGORY_OPTIONS: { id: DoctorQueueCategory; label: string; description: string }[] = [
  { id: "all", label: "Tümü", description: "Tüm atanmış başvurular" },
  { id: "pending_report", label: "Rapor bekleyen", description: "Henüz taslak kaydedilmemiş" },
  { id: "draft", label: "Taslak", description: "Taslak rapor kaydedilmiş" },
  { id: "concluded", label: "Sonuçlanan", description: "Rapor hastaya iletilmiş" },
];

const SORT_OPTIONS: { id: DoctorQueueSortBy; label: string }[] = [
  { id: "created_at", label: "Tarih" },
  { id: "patient_name", label: "Hasta adı" },
  { id: "status_code", label: "Durum" },
  { id: "application_number", label: "Başvuru no" },
];

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DoctorQueueCategory>("all");
  const [sortBy, setSortBy] = useState<DoctorQueueSortBy>("created_at");
  const [sortDir, setSortDir] = useState<DoctorQueueSortDir>("desc");

  const load = useCallback(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace(ROUTES.doctor.login);
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return api<{ items: ApplicationItem[] }>(
      API.applications.doctorQueue,
      {
        method: "POST",
        body: JSON.stringify({
          page: 0,
          pageSize: 100,
          search,
          category,
          sortBy,
          sortDir,
        }),
      },
      session.token
    )
      .then((res) => setItems(res.items ?? []))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Başvurular yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router, search, category, sortBy, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <DoctorAppShell
      title="Başvurularım"
      description="Size atanan tıbbi danışmanlık başvuruları"
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <Card className="p-4 mb-4 bg-card border shadow-sm rounded-xl space-y-4">
        <form onSubmit={applySearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Hasta adı veya başvuru no ile ara..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Ara
          </Button>
          {search ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
            >
              Temizle
            </Button>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={category === opt.id ? "default" : "outline"}
              onClick={() => setCategory(opt.id)}
              title={opt.description}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Sırala:</span>
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={sortBy === opt.id ? "secondary" : "ghost"}
              onClick={() => setSortBy(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="gap-1.5 ml-auto sm:ml-2"
          >
            {sortDir === "asc" ? (
              <>
                <ArrowUpAZ className="h-4 w-4" />
                ASC
              </>
            ) : (
              <>
                <ArrowDownAZ className="h-4 w-4" />
                DESC
              </>
            )}
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="Başvuru bulunamadı"
          description={
            search || category !== "all"
              ? "Filtreleri değiştirerek tekrar deneyin."
              : "Hastalar başvuru oluştururken sizi seçtiğinde başvurular burada listelenir."
          }
        />
      ) : (
        <Card className="p-6 bg-card border shadow-sm rounded-xl">
          <ul className="grid gap-3">
            {items.map((item) => (
              <li key={item.applicationId}>
                <ListLinkCard
                  href={ROUTES.doctor.application(item.applicationId)}
                  title={item.patientName?.trim() || item.professionName || "Başvuru"}
                  subtitle={`${item.professionName ?? "—"} · Başvuru no: ${applicationDisplayNumber(item)}${
                    item.createdAt
                      ? ` · ${new Date(item.createdAt).toLocaleDateString("tr-TR")}`
                      : ""
                  }`}
                  badge={
                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      {item.hasDraft && !isConcludedStatus(item.statusCode) ? (
                        <Badge variant="outline" className="text-xs">
                          Taslak
                        </Badge>
                      ) : null}
                      <StatusBadge code={item.statusCode} />
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </DoctorAppShell>
  );
}
