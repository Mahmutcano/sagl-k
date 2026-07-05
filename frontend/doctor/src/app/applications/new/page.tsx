"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getToken } from "@/lib/api";
import { requirePortalSession } from "@/lib/auth";
import { API } from "@/lib/endpoints";
import {
  hasErrors,
  validateRepresentedPerson,
  type FieldErrors,
  type RepresentedPersonInput,
} from "@/lib/validation";
import { AppShell } from "@/components/AppShell";
import { FormAlert, FormField, FormSelect } from "@/components/FormField";

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
    if (!requirePortalSession("patient")) {
      router.replace("/login");
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
        careProviderId: careProviderId || undefined,
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
    <AppShell
      title="Yeni başvuru"
      description="Erciyes Üniversitesi Tıp Fakültesi — yakın bilgisi ve yatan hasta kontrolü"
      actions={
        <Link href="/applications" className="btn" data-variant="outline" data-size="sm">
          Geri
        </Link>
      }
    >
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {step === "who" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" className="card text-left" onClick={chooseSelf}>
            <header>
              <h2>Kendim için</h2>
              <p>Kendi adınıza tıbbi danışmanlık başvurusu</p>
            </header>
            <section>
              <span className="badge">Erciyes HIS kontrolü</span>
            </section>
          </button>
          <button type="button" className="card text-left" onClick={chooseRelative}>
            <header>
              <h2>Yakınım için</h2>
              <p>Temsil ettiğiniz kişi adına başvuru — yakın bilgileri kaydedilir</p>
            </header>
            <section>
              <span className="badge" data-variant="secondary">
                Yakın ekleme
              </span>
            </section>
          </button>
        </div>
      )}

      {step === "relative" && (
        <form onSubmit={submitRelative} className="card max-w-2xl" noValidate>
          <header>
            <h2>Yakın (hasta) bilgileri</h2>
            <p>
              Temsil edilen kişinin kimlik bilgilerini girin. Bu bilgiler başvuruya kaydedilir ve
              Erciyes yatan hasta kontrolünde kullanılır.
            </p>
          </header>
          <section className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstName" label="Yakının adı" error={relativeFields.firstName}>
              <input
                id="firstName"
                autoComplete="off"
                value={relative.firstName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateRelative("firstName", e.target.value)
                }
              />
            </FormField>
            <FormField id="lastName" label="Yakının soyadı" error={relativeFields.lastName}>
              <input
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
              <input
                id="nationalIdentifier"
                inputMode="numeric"
                maxLength={11}
                value={relative.nationalIdentifier}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateRelative("nationalIdentifier", e.target.value)
                }
              />
            </FormField>
            <FormField
              id="birthDate"
              label="Doğum tarihi"
              error={relativeFields.birthDate}
            >
              <div className="input-group">
                <input
                  id="birthDate"
                  type="date"
                  value={relative.birthDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateRelative("birthDate", e.target.value)
                  }
                />
              </div>
            </FormField>
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
          </section>
          <footer className="border-t flex flex-wrap gap-2">
            <button type="submit" className="btn">
              Kaydet ve kontrol et
            </button>
            <button
              type="button"
              className="btn"
              data-variant="ghost"
              onClick={() => {
                setStep("who");
                setRelativeFields({});
                setError("");
              }}
            >
              Geri
            </button>
          </footer>
        </form>
      )}

      {(step === "erciyes" || loading) && (
        <div className="card max-w-lg">
          <section className="space-y-2">
            <div className="skeleton h-5 w-1/2" />
            <p className="text-muted-foreground text-sm">
              Erciyes hasta bilgi sistemi sorgulanıyor
              {forRelative
                ? ` (${relative.nationalIdentifier || "yakın TC"})...`
                : "..."}
            </p>
          </section>
        </div>
      )}

      {step === "blocked" && status && (
        <div className="card max-w-xl">
          <header>
            <h2>Başvuru yapılamaz</h2>
            <p>Erciyes Üniversitesi Tıp Fakültesi Hastanesi — yatan hasta</p>
          </header>
          <section className="flex flex-col gap-3">
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
          </section>
          <footer className="border-t flex flex-wrap gap-2">
            {forRelative ? (
              <button
                type="button"
                className="btn"
                data-variant="outline"
                onClick={() => {
                  setStep("relative");
                  setStatus(null);
                }}
              >
                Yakın bilgisini düzenle
              </button>
            ) : null}
            <Link href="/applications" className="btn">
              Başvurularıma dön
            </Link>
          </footer>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={submitApplication} className="card max-w-2xl" noValidate>
          <header>
            <h2>Başvuru detayları</h2>
            <p>
              {forRelative
                ? `Yakın: ${relative.firstName} ${relative.lastName} · HIS kontrolü geçti`
                : "Kendi adınıza başvuru · HIS kontrolü geçti"}
            </p>
          </header>
          <section className="flex flex-col gap-4">
            {status ? (
              <div className="alert">
                <strong>Erciyes HIS</strong>
                <section>
                  <p>{status.message}</p>
                </section>
              </div>
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
                <button
                  type="button"
                  className="btn"
                  data-variant="link"
                  data-size="sm"
                  onClick={() => setStep("relative")}
                >
                  Yakını düzenle
                </button>
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
              hint="İsteğe bağlı"
              value={careProviderId}
              onChange={(e) => setCareProviderId(e.target.value)}
              options={providerOptions}
              placeholder="Doktor seçiniz (isteğe bağlı)"
              disabled={!professionCode}
            />
          </section>
          <footer className="border-t flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Oluşturuluyor..." : "Başvuruyu oluştur"}
            </button>
            <button
              type="button"
              className="btn"
              data-variant="ghost"
              onClick={() => {
                setStep(forRelative ? "relative" : "who");
                setStatus(null);
              }}
            >
              Geri
            </button>
          </footer>
        </form>
      )}

      {step === "done" && (
        <div className="card max-w-xl">
          <header>
            <h2>Başvuru oluşturuldu</h2>
            <p>Ödeme bekleniyor durumunda kaydedildi.</p>
          </header>
          <section className="flex flex-col gap-2 text-sm">
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
          </section>
          <footer className="border-t flex flex-wrap gap-2">
            <Link href="/applications" className="btn">
              Başvurularıma git
            </Link>
            <button
              type="button"
              className="btn"
              data-variant="outline"
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
            </button>
          </footer>
        </div>
      )}
    </AppShell>
  );
}
