"use client";

import { ROUTES } from "@/lib/routes";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import { DoctorAppShell } from "@/components/DoctorAppShell";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { ListLinkCard } from "@/components/AppShellLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { FormAlert } from "@/components/FormField";
import { DatePickerField } from "@/components/DatePickerField";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applicationDisplayNumber, isConcludedStatus } from "@/lib/application";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Search,
  X,
} from "lucide-react";

type DoctorQueueCategory = "all" | "pending_report" | "draft" | "concluded";
type DoctorQueueSortBy = "created_at" | "patient_name" | "status_code" | "application_number";
type DoctorQueueSortDir = "asc" | "desc";
type ViewMode = "cards" | "table";

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

const PAGE_SIZE = 15;

const CATEGORY_OPTIONS: { id: DoctorQueueCategory; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "pending_report", label: "Rapor bekleyen" },
  { id: "draft", label: "Taslak" },
  { id: "concluded", label: "Sonuçlanan" },
];

const SORT_OPTIONS: { id: DoctorQueueSortBy; label: string }[] = [
  { id: "created_at", label: "Tarih" },
  { id: "patient_name", label: "Hasta" },
  { id: "status_code", label: "Durum" },
  { id: "application_number", label: "No" },
];

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DoctorQueueCategory>("all");
  const [sortBy, setSortBy] = useState<DoctorQueueSortBy>("created_at");
  const [sortDir, setSortDir] = useState<DoctorQueueSortDir>("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(() => {
    const session = requirePortalSession("doctor");
    if (!session) {
      router.replace(ROUTES.doctor.login);
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return api<{ items: ApplicationItem[]; totalCount?: number }>(
      API.applications.doctorQueue,
      {
        method: "POST",
        body: JSON.stringify({
          page,
          pageSize: PAGE_SIZE,
          search,
          category,
          sortBy,
          sortDir,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      },
      session.token
    )
      .then((res) => {
        setItems(res.items ?? []);
        setTotalCount(res.totalCount ?? res.items?.length ?? 0);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Başvurular yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, [router, search, category, sortBy, sortDir, dateFrom, dateTo, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [search, category, sortBy, sortDir, dateFrom, dateTo]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  const rangeLabel = useMemo(() => {
    if (totalCount === 0) return "0 kayıt";
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(totalCount, (page + 1) * PAGE_SIZE);
    return `${start}–${end} / ${totalCount}`;
  }, [page, totalCount]);

  return (
    <DoctorAppShell
      title="Başvurularım"
      description="Size atanan tıbbi danışmanlık başvuruları"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={ROUTES.doctor.stats}>Özet panel</Link>
        </Button>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      <Card className="mb-4 overflow-visible">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <form onSubmit={applySearch} className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Hasta veya başvuru no ara"
                className="h-10 pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" className="h-10 shrink-0 px-4">
              Ara
            </Button>
          </form>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePickerField
              id="dateFrom"
              label="Başlangıç"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="Başlangıç tarihi"
              max={dateTo || undefined}
            />
            <DatePickerField
              id="dateTo"
              label="Bitiş"
              value={dateTo}
              onChange={setDateTo}
              placeholder="Bitiş tarihi"
              min={dateFrom || undefined}
            />
          </div>

          {(dateFrom || dateTo || search) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSearch("");
                setSearchInput("");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Filtreleri temizle
            </Button>
          ) : null}

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                className="h-8 shrink-0 rounded-full px-3"
                variant={category === opt.id ? "default" : "outline"}
                onClick={() => setCategory(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Sıra</span>
            {SORT_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                className="h-8"
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
              className="h-8 gap-1.5"
              aria-label={sortDir === "asc" ? "Artan" : "Azalan"}
            >
              {sortDir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
              {sortDir === "asc" ? "A→Z" : "Z→A"}
            </Button>
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="icon"
                className="h-8 w-8"
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                onClick={() => setViewMode("cards")}
                aria-label="Kart görünümü"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                variant={viewMode === "table" ? "secondary" : "ghost"}
                onClick={() => setViewMode("table")}
                aria-label="Tablo görünümü"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="Başvuru bulunamadı"
          description="Filtreleri değiştirerek tekrar deneyin."
        />
      ) : viewMode === "cards" ? (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.applicationId}>
              <ListLinkCard
                href={ROUTES.doctor.application(item.applicationId)}
                title={item.patientName?.trim() || item.professionName || "Başvuru"}
                subtitle={`${item.professionName ?? "—"} · ${applicationDisplayNumber(item)}${
                  item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("tr-TR")}` : ""
                }`}
                badge={
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {item.hasDraft && !isConcludedStatus(item.statusCode) ? (
                      <Badge variant="outline" className="text-xs">
                        Taslak
                      </Badge>
                    ) : null}
                    <StatusBadge code={item.statusCode} audience="staff" />
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Bölüm</TableHead>
                  <TableHead>No</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.applicationId}
                    className="cursor-pointer"
                    onClick={() => router.push(ROUTES.doctor.application(item.applicationId))}
                  >
                    <TableCell className="font-medium">
                      {item.patientName?.trim() || "—"}
                    </TableCell>
                    <TableCell>{item.professionName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {applicationDisplayNumber(item)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString("tr-TR") : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge code={item.statusCode} audience="staff" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {totalCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Önceki
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </DoctorAppShell>
  );
}
