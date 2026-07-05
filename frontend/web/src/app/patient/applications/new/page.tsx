"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  validateRepresentedPerson,
  type FieldErrors,
  type RepresentedPersonInput,
} from "@/lib/validation";
import { PatientAppShell } from "@/components/PatientAppShell";
import { FormAlert, FormField, FormSelect, DateField } from "@/components/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type InpatientResult = {
  isInpatient: boolean;
  canApply: boolean;
  message: string;
  blockMessage: string;
  protocolNo?: string;
  wardName?: string;
  source: string;
};

type Profession = { code: string; name: string };

type CareProvider = {
  careProviderId: string;
  fullName: string;
  title: string;
  professionCode: string;
};

type Step = "who" | "relative" | "erciyes" | "blocked" | "details" | "done";

const emptyRelative: RepresentedPersonInput = {
  firstName: "",
  lastName: "",
  nationalIdentifier: "",
  birthDate: "",
  gender: 0,
};

export default function NewApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("who");
  const [forRelative, setForRelative] = useState(false);
  const [relative, setRelative] = useState<RepresentedPersonInput>(emptyRelative);
  const [relativeFields, setRelativeFields] = useState<FieldErrors>({});
  const [status, setStatus] = useState<InpatientResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [professions, setProfessions] = useState<Profession[]>([]);
  const [providers, setProviders] = useState<CareProvider[]>([]);
  const [professionCode, setProfessionCode] = useState("");
  const [careProviderId, setCareProviderId] = useState("");
  const [detailFields, setDetailFields] = useState<FieldErrors>({});
  const [createdId, setCreatedId] = useState("");

  const targetInstitution = 1;

  useEffect(() => {
    if (!requireSession("patient")) {
      router.replace(ROUTES.patient.login);
    }
  }, [router]);

  useEffect(() => {
    if (step !== "details") return;
    api<Profession[]>(API.professions(targetInstitution))
      .then((list) => setProfessions(list ?? []))
      .catch(() => setProfessions([]));
  }, [step]);

  useEffect(() => {
    if (step !== "details" || !professionCode) {
      setProviders([]);
      setCareProviderId("");
      return;
    }
    api<CareProvider[]>(API.careProviders(targetInstitution, professionCode))
      .then((list) => setProviders(list ?? []))
      .catch(() => setProviders([]));
  }, [step, professionCode]);

  async function runErciyesCheck(isForRelative: boolean, nationalIdentifier?: string) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    setStatus(null);
    try {
      const body: Record<string, unknown> = { isForRelative };
      if (nationalIdentifier) body.nationalIdentifier = nationalIdentifier;
      const res = await api<InpatientResult>(
        API.erciyes.inpatientStatus,
        { method: "POST", body: JSON.stringify(body) },
        token
      );
      setStatus(res);
      setStep(res.canApply ? "details" : "blocked");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erciyes hasta bilgi sistemine ulaşılamadı."
      );
      setStep(isForRelative ? "relative" : "who");
    } finally {
      setLoading(false);
    }
  }

  function chooseSelf() {
    setForRelative(false);
    setRelative(emptyRelative);
    setRelativeFields({});
    setStep("erciyes");
    void runErciyesCheck(false);
  }

  function chooseRelative() {
    setForRelative(true);
    setStatus(null);
    setStep("relative");
  }

  function submitRelative(e: FormEvent) {
    e.preventDefault();
    // Başvuran TC çakışması sunucuda da kontrol edilir.
    const fields = validateRepresentedPerson(relative);
    setRelativeFields(fields);
    if (hasErrors(fields)) return;
    setStep("erciyes");
    void runErciyesCheck(true, relative.nationalIdentifier.trim());
  }

  function updateRelative<K extends keyof RepresentedPersonInput>(
    key: K,
    value: RepresentedPersonInput[K]
  ) {
    setRelative((prev) => ({ ...prev, [key]: value }));
  }

  async function submitApplication(e: FormEvent) {
    e.preventDefault();
    const fields: FieldErrors = {};
    if (!professionCode) fields.professionCode = "Branş seçiniz.";
    if (!careProviderId) fields.careProviderId = "Doktor seçimi zorunludur.";
    setDetailFields(fields);
    if (hasErrors(fields)) return;

    const profession = professions.find((p) => p.code === professionCode);
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        targetInstitution,
        professionCode,
        professionName: profession?.name ?? professionCode,
        careProviderId,
        isForRelative: forRelative,
        surveyData: { surveyName: "initial", data: "{}" },
      };
      if (forRelative) {
        body.representedPerson = {
          firstName: relative.firstName.trim(),
          lastName: relative.lastName.trim(),
          nationalIdentifier: relative.nationalIdentifier.trim(),
          birthDate: relative.birthDate,
          gender: relative.gender,
        };
      }
      const res = await api<{ applicationId: string }>(
        API.applications.create,
        { method: "POST", body: JSON.stringify(body) },
        token
      );
      setCreatedId(res.applicationId);
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ERC002") {
          setStatus({
            isInpatient: true,
            canApply: false,
            message: err.message,
            blockMessage: err.message,
            source: "live",
          });
          setStep("blocked");
        } else if (Object.keys(err.fields).length) {
          const mapped: FieldErrors = {};
          for (const [k, v] of Object.entries(err.fields)) {
            const short = k.replace(/^representedPerson\./, "");
            mapped[short] = v;
          }
          if (mapped.firstName || mapped.lastName || mapped.nationalIdentifier || mapped.birthDate || mapped.gender) {
            setRelativeFields(mapped);
            setStep("relative");
          } else {
            setDetailFields(mapped);
          }
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError("Başvuru oluşturulamadı.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const professionOptions = [
    { value: "", label: "Branş seçiniz" },
    ...professions.map((p) => ({ value: p.code, label: p.name })),
  ];
  const providerOptions = [
    { value: "", label: providers.length ? "Doktor seçiniz (isteğe bağlı)" : "Önce branş seçin" },
    ...providers.map((p) => ({
      value: p.careProviderId,
      label: p.title ? `${p.title} ${p.fullName}` : p.fullName,
    })),
  ];

  return (
    <PatientAppShell
      title="Yeni başvuru"
      description="Erciyes Üniversitesi Tıp Fakültesi — yakın bilgisi ve yatan hasta kontrolü"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={ROUTES.patient.applications}>Geri</Link>
        </Button>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {step === "who" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer text-left transition hover:ring-2 hover:ring-ring"
            onClick={chooseSelf}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                chooseSelf();
              }
            }}
          >
            <CardHeader>
              <CardTitle>Kendim için</CardTitle>
              <CardDescription>Kendi adınıza tıbbi danışmanlık başvurusu</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge>Erciyes HIS kontrolü</Badge>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer text-left transition hover:ring-2 hover:ring-ring"
            onClick={chooseRelative}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                chooseRelative();
              }
            }}
          >
            <CardHeader>
              <CardTitle>Yakınım için</CardTitle>
              <CardDescription>
                Temsil ettiğiniz kişi adına başvuru — yakın bilgileri kaydedilir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Yakın ekleme</Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "relative" && (
        <Card className="max-w-2xl">
          <form onSubmit={submitRelative} noValidate>
            <CardHeader>
              <CardTitle>Yakın (hasta) bilgileri</CardTitle>
              <CardDescription>
                Temsil edilen kişinin kimlik bilgilerini girin. Bu bilgiler başvuruya kaydedilir ve
                Erciyes yatan hasta kontrolünde kullanılır.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField id="firstName" label="Yakının adı" error={relativeFields.firstName}>
                <Input
                  id="firstName"
                  autoComplete="off"
                  value={relative.firstName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRelative("firstName", e.target.value)
                  }
                />
              </FormField>
              <FormField id="lastName" label="Yakının soyadı" error={relativeFields.lastName}>
                <Input
                  id="lastName"
                  autoComplete="off"
                  value={relative.lastName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRelative("lastName", e.target.value)
                  }
                />
              </FormField>
              <FormField
                id="nationalIdentifier"
                label="TC Kimlik No"
                hint="Başvuranın TC’si ile aynı olamaz"
                error={relativeFields.nationalIdentifier}
                className="sm:col-span-2"
              >
                <Input
                  id="nationalIdentifier"
                  inputMode="numeric"
                  maxLength={11}
                  value={relative.nationalIdentifier}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRelative("nationalIdentifier", e.target.value)
                  }
                />
              </FormField>
              <DateField
                id="birthDate"
                label="Doğum tarihi"
                error={relativeFields.birthDate}
                value={relative.birthDate}
                onChange={(e) => updateRelative("birthDate", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
              <FormSelect
                id="gender"
                label="Cinsiyet"
                value={relative.gender ? String(relative.gender) : ""}
                onChange={(e) => updateRelative("gender", Number(e.target.value))}
                error={relativeFields.gender}
                placeholder="Cinsiyet seçiniz"
                options={[
                  { value: "1", label: "Erkek" },
                  { value: "2", label: "Kadın" },
                ]}
              />
            </CardContent>
            <CardFooter className="border-t flex flex-wrap gap-2">
              <Button type="submit">Kaydet ve kontrol et</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("who");
                  setRelativeFields({});
                  setError("");
                }}
              >
                Geri
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {(step === "erciyes" || loading) && (
        <Card className="max-w-lg">
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-5 w-1/2" />
            <p className="text-muted-foreground text-sm">
              Erciyes hasta bilgi sistemi sorgulanıyor
              {forRelative
                ? ` (${relative.nationalIdentifier || "yakın TC"})...`
                : "..."}
            </p>
          </CardContent>
        </Card>
      )}

      {step === "blocked" && status && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Başvuru yapılamaz</CardTitle>
            <CardDescription>
              Erciyes Üniversitesi Tıp Fakültesi Hastanesi — yatan hasta
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FormAlert title="Uyarı" message={status.blockMessage || status.message} />
            {forRelative ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Yakın: </span>
                {relative.firstName} {relative.lastName} ({relative.nationalIdentifier})
              </p>
            ) : null}
            {status.wardName || status.protocolNo ? (
              <ul className="text-sm space-y-1">
                {status.protocolNo ? (
                  <li>
                    <span className="text-muted-foreground">Protokol: </span>
                    {status.protocolNo}
                  </li>
                ) : null}
                {status.wardName ? (
                  <li>
                    <span className="text-muted-foreground">Servis: </span>
                    {status.wardName}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </CardContent>
          <CardFooter className="border-t flex flex-wrap gap-2">
            {forRelative ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("relative");
                  setStatus(null);
                }}
              >
                Yakın bilgisini düzenle
              </Button>
            ) : null}
            <Button asChild>
              <Link href={ROUTES.patient.applications}>Başvurularıma dön</Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "details" && (
        <Card className="max-w-2xl">
          <form onSubmit={submitApplication} noValidate>
            <CardHeader>
              <CardTitle>Başvuru detayları</CardTitle>
              <CardDescription>
                {forRelative
                  ? `Yakın: ${relative.firstName} ${relative.lastName} · HIS kontrolü geçti`
                  : "Kendi adınıza başvuru · HIS kontrolü geçti"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {status ? (
                <Alert>
                  <AlertTitle>Erciyes HIS</AlertTitle>
                  <AlertDescription>
                    <p>{status.message}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
              {forRelative ? (
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="font-medium">Kayıtlı yakın bilgisi</div>
                  <div>
                    {relative.firstName} {relative.lastName}
                  </div>
                  <div className="text-muted-foreground">
                    TC: {relative.nationalIdentifier} · Doğum: {relative.birthDate} ·{" "}
                    {relative.gender === 1 ? "Erkek" : "Kadın"}
                  </div>
                  <Button type="button" variant="link" size="sm" onClick={() => setStep("relative")}>
                    Yakını düzenle
                  </Button>
                </div>
              ) : null}
              <FormSelect
                id="professionCode"
                label="Branş"
                value={professionCode}
                onChange={(e) => {
                  setProfessionCode(e.target.value);
                  setCareProviderId("");
                }}
                error={detailFields.professionCode}
                options={professionOptions}
                placeholder="Branş seçiniz"
              />
              <FormSelect
                id="careProviderId"
                label="Doktor"
                value={careProviderId}
                onChange={(e) => setCareProviderId(e.target.value)}
                error={detailFields.careProviderId}
                options={providerOptions}
                placeholder="Doktor seçiniz"
                disabled={!professionCode}
              />
            </CardContent>
            <CardFooter className="border-t flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Oluşturuluyor..." : "Başvuruyu oluştur"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(forRelative ? "relative" : "who");
                  setStatus(null);
                }}
              >
                Geri
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === "done" && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Başvuru oluşturuldu</CardTitle>
            <CardDescription>Ödeme bekleniyor durumunda kaydedildi.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {forRelative ? (
              <p>
                <span className="text-muted-foreground">Yakın: </span>
                {relative.firstName} {relative.lastName}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Başvuru no: </span>
              <span className="font-mono text-xs">{createdId}</span>
            </p>
          </CardContent>
          <CardFooter className="border-t flex flex-wrap gap-2">
            <Button asChild>
              <Link href={ROUTES.patient.applications}>Başvurularıma git</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep("who");
                setForRelative(false);
                setRelative(emptyRelative);
                setStatus(null);
                setProfessionCode("");
                setCareProviderId("");
                setCreatedId("");
                setError("");
              }}
            >
              Yeni başvuru daha
            </Button>
          </CardFooter>
        </Card>
      )}
    </PatientAppShell>
  );
}
