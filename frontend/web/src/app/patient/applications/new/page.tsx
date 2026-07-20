"use client";

import { ROUTES } from "@/lib/routes";

import { useEffect, useState, Suspense, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ApplicationSurveyForm } from "@/components/ApplicationSurveyForm";
import { ApplicationPaymentForm, PAYMENT_AMOUNT } from "@/components/ApplicationPaymentForm";
import { PaymentReceiptCard } from "@/components/PaymentReceiptCard";
import { ApplicationFlowSteps, ApplicationFlowHint } from "@/components/ApplicationFlowSteps";
import { ApplicationPreviewPanel } from "@/components/ApplicationPreviewPanel";
import { FileUploadField } from "@/components/FileUploadField";
import { FormAlert, FormField, FormSelect, BirthDateSelect } from "@/components/FormField";
import { useApplicationCatalog } from "@/hooks/useApplicationCatalog";
import {
  EMPTY_SURVEY,
  surveyAnswersToJSON,
  uploadApplicationAttachments,
  validateApplicationSurvey,
  summarizeSurveyErrors,
  validateSelectedFiles,
  parseSurveyData,
  type ApplicationSurveyAnswers,
} from "@/lib/applicationSurvey";
import { type ApplicationDetail, type PaymentReceipt, isPatientEditableStatus, resolveEditStep, markPreviewConfirmed, clearPreviewConfirmed, isPreviewConfirmed } from "@/lib/application";
import { redirectIfDuplicateApplication } from "@/lib/applicationDuplicate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormStepFooter, formStepButtonClass } from "@/components/FormStepFooter";
import { ApplicationContextCard } from "@/components/ApplicationContextCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ArrowLeft } from "lucide-react";

type Step =
  | "who"
  | "relative"
  | "details"
  | "survey"
  | "payment"
  | "preview"
  | "done";

const emptyRelative: RepresentedPersonInput = {
  firstName: "",
  lastName: "",
  nationalIdentifier: "",
  birthDate: "",
  gender: 0,
};

function NewApplicationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const stepParam = searchParams.get("step");
  const [step, setStep] = useState<Step>("who");
  const [forRelative, setForRelative] = useState(false);
  const [relative, setRelative] = useState<RepresentedPersonInput>(emptyRelative);
  const [relativeFields, setRelativeFields] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);

  const [professionCode, setProfessionCode] = useState("");
  const [professionName, setProfessionName] = useState("");
  const [careProviderId, setCareProviderId] = useState("");
  const [careProviderLabel, setCareProviderLabel] = useState("");
  const [detailFields, setDetailFields] = useState<FieldErrors>({});
  const [surveyAnswers, setSurveyAnswers] = useState<ApplicationSurveyAnswers>(EMPTY_SURVEY);
  const [surveyFields, setSurveyFields] = useState<FieldErrors>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [surveyFormError, setSurveyFormError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<number | null>(null);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);

  const targetInstitution = 1;
  const catalog = useApplicationCatalog(
    targetInstitution,
    professionCode,
    step === "details" || step === "survey"
  );

  useEffect(() => {
    if (!requireSession("patient")) {
      router.replace(ROUTES.patient.login);
    }
  }, [router]);

  useEffect(() => {
    if (!editId) return;
    const token = getToken();
    if (!token) return;
    setEditLoading(true);
    void api<ApplicationDetail>(API.applications.detail(editId), {}, token)
      .then((app) => {
        if (!isPatientEditableStatus(app.statusCode)) {
          router.replace(ROUTES.patient.application(editId));
          return;
        }
        setCreatedId(app.applicationId);
        setApplicationStatus(app.statusCode);
        setApplicationNumber(app.applicationNumber ?? app.ecommerceNumber ?? "");
        setProfessionCode(app.professionCode ?? "");
        setProfessionName(app.professionName ?? "");
        setCareProviderId(app.careProviderId ?? "");
        setForRelative(!!app.isForRelative);
        setSurveyAnswers(parseSurveyData(app.surveyData));
        if (app.representedPerson) {
          setRelative({
            firstName: app.representedPerson.firstName ?? "",
            lastName: app.representedPerson.lastName ?? "",
            nationalIdentifier: app.representedPerson.nationalIdentifier ?? "",
            birthDate: app.representedPerson.birthDate ?? "",
            gender: app.representedPerson.gender ?? 0,
          });
        }
        setStep(resolveEditStep(app, stepParam));
      })
      .catch(() => setError("Başvuru yüklenemedi."))
      .finally(() => setEditLoading(false));
  }, [editId, stepParam, router]);

  // Ödeme adımı: önizleme onayı ve status 0 zorunlu — aksi halde geri çek.
  useEffect(() => {
    if (step !== "payment" || !createdId) return;
    if (applicationStatus !== 0 || !isPreviewConfirmed(createdId)) {
      setStep("preview");
      setError(
        applicationStatus !== 0
          ? "Bu başvuru için ödeme beklenmiyor."
          : "Ödemeye geçmeden önce form önizlemesini onaylamanız gerekir."
      );
    }
  }, [step, createdId, applicationStatus]);

  useEffect(() => {
    if (!careProviderId || !catalog.providers.length) return;
    const provider = catalog.providers.find((p) => p.careProviderId === careProviderId);
    if (provider) {
      setCareProviderLabel(
        provider.title ? `${provider.title} ${provider.fullName}` : provider.fullName
      );
    }
  }, [careProviderId, catalog.providers]);

  function chooseSelf() {
    setForRelative(false);
    setRelative(emptyRelative);
    setRelativeFields({});
    setStep("details");
  }

  function chooseRelative() {
    setForRelative(true);
    setStep("relative");
  }

  function submitRelative(e: FormEvent) {
    e.preventDefault();
    const fields = validateRepresentedPerson(relative);
    setRelativeFields(fields);
    if (hasErrors(fields)) return;
    setStep("details");
  }

  function updateRelative<K extends keyof RepresentedPersonInput>(
    key: K,
    value: RepresentedPersonInput[K]
  ) {
    setRelative((prev) => ({ ...prev, [key]: value }));
  }

  function continueToSurvey(e: FormEvent) {
    e.preventDefault();
    const fields: FieldErrors = {};
    if (!professionCode.trim()) fields.professionCode = "Bölüm seçiniz.";
    if (!careProviderId.trim()) fields.careProviderId = "Doktor seçimi zorunludur.";
    setDetailFields(fields);
    if (hasErrors(fields)) {
      setError("Bölüm ve Doktor seçmeden şikayet adımına geçilemez.");
      return;
    }

    const profession = catalog.professions.find((p) => p.code === professionCode);
    setProfessionName(profession?.name ?? professionCode);
    const provider = catalog.providers.find((p) => p.careProviderId === careProviderId);
    setCareProviderLabel(
      provider ? (provider.title ? `${provider.title} ${provider.fullName}` : provider.fullName) : ""
    );

    const token = getToken();
    if (!createdId || !token) {
      setStep("survey");
      setError("");
      return;
    }

    setSubmitting(true);
    setError("");
    void api(
      API.applications.update(createdId),
      {
        method: "PATCH",
        body: JSON.stringify({
          professionCode,
          professionName: profession?.name ?? professionName ?? professionCode,
          careProviderId,
          surveyData: {
            surveyName: "patient_intake",
            data: surveyAnswersToJSON(surveyAnswers),
          },
        }),
      },
      token
    )
      .then(() => {
        setStep("survey");
        setError("");
        if (createdId) clearPreviewConfirmed(createdId);
      })
      .catch((err) => {
        if (!redirectIfDuplicateApplication(err, router)) {
          setError(err instanceof ApiError ? err.message : "Bölüm ve Doktor kaydedilemedi.");
        }
      })
      .finally(() => setSubmitting(false));
  }

  function scrollToFirstSurveyError(errs: FieldErrors) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveAndGoToPreview(e: FormEvent) {
    e.preventDefault();
    setSurveyFormError("");
    if (!careProviderId) {
      setDetailFields({ careProviderId: "Doktor seçimi zorunludur." });
      setError("Lütfen bölüm adımından bir uzman hekim seçin.");
      setStep("details");
      return;
    }
    const surveyErrs = validateApplicationSurvey(surveyAnswers);
    setSurveyFields(surveyErrs);
    const fileErr = validateSelectedFiles(pendingFiles);
    setFileError(fileErr ?? "");
    if (hasErrors(surveyErrs)) {
      setSurveyFormError(summarizeSurveyErrors(surveyErrs));
      scrollToFirstSurveyError(surveyErrs);
      return;
    }
    if (fileErr) {
      setSurveyFormError(fileErr);
      return;
    }

    const profession = catalog.professions.find((p) => p.code === professionCode);
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setError("");
    try {
      const surveyPayload = {
        surveyData: {
          surveyName: "patient_intake",
          data: surveyAnswersToJSON(surveyAnswers),
        },
      };
      const updateBody = {
        professionCode,
        professionName: profession?.name ?? professionName ?? professionCode,
        careProviderId,
        ...surveyPayload,
        ...(forRelative
          ? {
            representedPerson: {
              firstName: relative.firstName.trim(),
              lastName: relative.lastName.trim(),
              nationalIdentifier: relative.nationalIdentifier.trim(),
              birthDate: relative.birthDate,
              gender: relative.gender,
            },
          }
          : {}),
      };
      let applicationId = createdId;

      if (applicationId) {
        await api(
          API.applications.update(applicationId),
          { method: "PATCH", body: JSON.stringify(updateBody) },
          token
        );
      } else {
        const body: Record<string, unknown> = {
          targetInstitution,
          isForRelative: forRelative,
          ...updateBody,
        };
        const res = await api<{ applicationId: string }>(
          API.applications.create,
          { method: "POST", body: JSON.stringify(body) },
          token
        );
        if (!res?.applicationId) {
          throw new ApiError("Başvuru oluşturuldu ancak kimlik alınamadı. Lütfen başvurularım sayfasını kontrol edin.", "APP011");
        }
        applicationId = res.applicationId;
        setCreatedId(applicationId);
        setApplicationStatus(0);
      }

      if (pendingFiles.length > 0 && applicationId) {
        try {
          await uploadApplicationAttachments(applicationId, pendingFiles, token);
          setPendingFiles([]);
        } catch (uploadErr) {
          setCreatedId(applicationId);
          const msg =
            uploadErr instanceof ApiError
              ? uploadErr.message
              : "Dosyalar yüklenemedi. Başvuru kaydedildi; dosyaları tekrar ekleyebilirsiniz.";
          setFileError(msg);
          setSurveyFormError(`Başvuru kaydedildi ancak dosya yüklenemedi: ${msg}`);
          setStep("survey");
          return;
        }
      }
      setStep("preview");
      if (applicationId) clearPreviewConfirmed(applicationId);
    } catch (err) {
      if (redirectIfDuplicateApplication(err, router)) return;
      if (err instanceof ApiError) {
        if (Object.keys(err.fields).length) {
          const mapped: FieldErrors = {};
          const surveyMapped: FieldErrors = {};
          for (const [k, v] of Object.entries(err.fields)) {
            if (k.startsWith("surveyData.")) {
              surveyMapped[k.replace(/^surveyData\./, "")] = v;
            } else {
              mapped[k.replace(/^representedPerson\./, "")] = v;
            }
          }
          if (mapped.firstName || mapped.lastName || mapped.nationalIdentifier || mapped.birthDate || mapped.gender) {
            setRelativeFields(mapped);
            setStep("relative");
          } else if (Object.keys(surveyMapped).length) {
            setSurveyFields(surveyMapped);
            setSurveyFormError(summarizeSurveyErrors(surveyMapped));
            setStep("survey");
            scrollToFirstSurveyError(surveyMapped);
          } else {
            setDetailFields(mapped);
            setStep("details");
          }
          setError(err.message);
        } else {
          setError(err.message || "Başvuru kaydedilemedi.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Başvuru kaydedilemedi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const professionOptions = [
    { value: "", label: catalog.loadingProfessions ? "Bölümler yükleniyor..." : "Bölüm seçiniz" },
    ...catalog.professions.map((p) => ({ value: p.code, label: p.name })),
  ];
  const providerOptions = [
    {
      value: "",
      label: !professionCode
        ? "Önce bölüm seçin"
        : catalog.loadingProviders
          ? "Doktorlar yükleniyor..."
          : catalog.providers.length
            ? "Doktor seçiniz"
            : "Bu bölümde atanabilir doktor yok",
    },
    ...catalog.providers.map((p) => ({
      value: p.careProviderId,
      label: p.title ? `${p.title} ${p.fullName}` : p.fullName,
    })),
  ];

  return (
    <PatientAppShell
      title={editId ? "Başvuruyu düzenle" : "Yeni başvuru"}
      description={
        editId
          ? "Kaldığınız adımdan devam edin — bölüm, şikayet, önizleme ve ödeme"
          : "Erciyes Üniversitesi Tıp Fakültesi — yeni danışmanlık başvurusu"
      }
      actions={
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={ROUTES.patient.applications}>
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Link>
        </Button>
      }
    >
      <div className="application-form-flow">
      {error ? <FormAlert title="Hata" message={error} /> : null}

      {(step === "details" || step === "survey" || step === "payment" || step === "preview") && (
        <ApplicationFlowSteps
          current={
            step === "details" || step === "survey" || step === "payment" || step === "preview"
              ? step
              : "details"
          }
          paymentComplete={applicationStatus === 1}
        />
      )}

      {editLoading ? (
        <Card className="max-w-lg">
          <CardContent className="pt-6">
            <Skeleton className="h-5 w-1/2" />
            <p className="text-muted-foreground mt-2 text-sm">Başvuru yükleniyor...</p>
          </CardContent>
        </Card>
      ) : null}

      {!editLoading && step === "who" && (
        <div className="grid gap-6 sm:grid-cols-2 max-w-4xl w-full">
          <Card
            className="cursor-pointer text-left transition-all hover:ring-2 hover:ring-ring hover:shadow-lg application-form-card form-choice-card touch-manipulation"
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
              <Badge className="px-3 py-1 text-xs">Kendi başvurum</Badge>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer text-left transition-all hover:ring-2 hover:ring-ring hover:shadow-lg application-form-card form-choice-card touch-manipulation"
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
              <Badge variant="secondary" className="px-3 py-1 text-xs">Yakın ekleme</Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "relative" && (
        <Card className="max-w-4xl w-full application-form-card ">
          <form onSubmit={submitRelative} noValidate>
            <CardHeader>
              <CardTitle>Yakın (hasta) bilgileri</CardTitle>
              <CardDescription>
                Temsil edilen kişinin kimlik bilgilerini girin. Bu bilgiler başvuruya kaydedilir.
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
              <BirthDateSelect
                value={relative.birthDate}
                onChange={(iso) => updateRelative("birthDate", iso)}
                error={relativeFields.birthDate}
                fieldClassName="sm:col-span-2"
              />
            </CardContent>
            <FormStepFooter>
              <Button type="submit" className={formStepButtonClass()}>Devam et</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("who");
                  setRelativeFields({});
                  setError("");
                }}
                className={formStepButtonClass("gap-1.5")}
              >
                <ArrowLeft className="h-4 w-4" />
                Geri
              </Button>
            </FormStepFooter>
          </form>
        </Card>
      )}

      {step === "details" && (
        <Card className="max-w-4xl w-full application-form-card ">
          <form onSubmit={continueToSurvey} noValidate>
            <CardHeader>
              <CardTitle>Adım 1 — Bölüm ve Doktor</CardTitle>
              <CardDescription>
                Danışmak istediğiniz bölümü seçin; isteğe bağlı olarak uzman hekim tercih edebilirsiniz.
                {createdId ? " Ödeme yapılmadan önce bölüm ve doktor seçiminizi buradan değiştirebilirsiniz." : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
              {catalog.professionsError ? (
                <FormAlert title="Bölüm listesi" message={catalog.professionsError} />
              ) : null}
              {catalog.providersError ? (
                <FormAlert title="Doktor listesi" message={catalog.providersError} />
              ) : null}
              <FormSelect
                id="professionCode"
                label="Bölüm"
                value={professionCode}
                onChange={(e) => {
                  setProfessionCode(e.target.value);
                  setCareProviderId("");
                }}
                error={detailFields.professionCode}
                options={professionOptions}
                placeholder="Bölüm seçiniz"
                disabled={catalog.loadingProfessions}
              />
              <FormSelect
                key={`provider-${professionCode}`}
                id="careProviderId"
                label="Uzman hekim"
                hint="Başvurunuzun iletileceği uzman hekimi seçiniz"
                value={careProviderId}
                onChange={(e) => setCareProviderId(e.target.value)}
                error={detailFields.careProviderId}
                options={providerOptions}
                placeholder="Doktor seçiniz"
                disabled={!professionCode || catalog.loadingProviders}
              />
            </CardContent>
            <FormStepFooter>
              <Button type="submit" disabled={submitting} className={formStepButtonClass()}>
                <span className="sm:hidden">{submitting ? "Kaydediliyor..." : "Devam et"}</span>
                <span className="hidden sm:inline">
                  {submitting ? "Kaydediliyor..." : "Devam et — Şikayet Bilgileri"}
                </span>
              </Button>
              {!createdId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep(forRelative ? "relative" : "who");
                    setApplicationStatus(null);
                  }}
                  className={formStepButtonClass("gap-1.5")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </Button>
              ) : null}
            </FormStepFooter>
          </form>
        </Card>
      )}

      {step === "survey" && (
        <Card className="max-w-4xl w-full application-form-card ">
          <form onSubmit={saveAndGoToPreview} noValidate>
            <CardHeader>
              <CardTitle>Adım 2 — Şikayet ve Belgeler</CardTitle>
              <CardDescription>
                Tıbbi geçmişinizi, şikayetinizi ve sorularınızı yazın; tetkik/rapor dosyalarını ekleyin.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ApplicationContextCard
                forRelative={forRelative}
                relativeName={`${relative.firstName} ${relative.lastName}`.trim()}
                professionName={professionName || professionCode}
                doctorName={careProviderLabel}
              />
              {surveyFormError ? (
                <FormAlert title="Doğrulama hatası" message={surveyFormError} />
              ) : null}
              <ApplicationSurveyForm
                value={surveyAnswers}
                onChange={setSurveyAnswers}
                errors={surveyFields}
              />
              <FileUploadField
                files={pendingFiles}
                onChange={setPendingFiles}
                onError={setFileError}
                error={fileError}
                disabled={submitting}
              />
            </CardContent>
            <FormStepFooter>
              <Button type="submit" disabled={submitting} className={formStepButtonClass()}>
                <span className="sm:hidden">{submitting ? "Kaydediliyor..." : "Önizlemeye geç"}</span>
                <span className="hidden sm:inline">
                  {submitting ? "Kaydediliyor..." : "Devam et — Form Önizleme (Adım 3)"}
                </span>
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("details")} className={formStepButtonClass("gap-1.5")}>
                <ArrowLeft className="h-4 w-4" />
                Geri — bölüm seçimi
              </Button>
            </FormStepFooter>
          </form>
        </Card>
      )}

      {step === "preview" && createdId ? (
        <Card className="max-w-5xl w-full application-form-card border-primary/20">
          <CardHeader>
            <CardTitle>Adım 3 — Form Önizleme</CardTitle>
            <CardDescription>
              Başvuru formunuzu kontrol edin. Mobilde formu indirip veya tam ekranda açarak inceleyin; masaüstünde
              doğrudan önizleyebilirsiniz. Onay sonrası ödeme adımına geçilir.
            </CardDescription>
            <ApplicationFlowHint current="preview" />
          </CardHeader>
          <CardContent>
            <ApplicationPreviewPanel applicationId={createdId} token={getToken() ?? ""} />
          </CardContent>
          <FormStepFooter>
            {applicationStatus === 1 ? (
              <Button
                type="button"
                className={formStepButtonClass()}
                onClick={() => router.push(ROUTES.patient.application(createdId))}
              >
                Başvuruya dön
              </Button>
            ) : (
              <Button type="button" className={formStepButtonClass()} onClick={() => setPaymentConfirmOpen(true)}>
                Ödemeye geç
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className={formStepButtonClass("gap-1.5")}
              onClick={() => {
                if (createdId) clearPreviewConfirmed(createdId);
                setStep("survey");
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Button>
          </FormStepFooter>
        </Card>
      ) : null}

      {step === "payment" && createdId && applicationStatus === 0 && isPreviewConfirmed(createdId) ? (
        <Card className="max-w-4xl w-full application-form-card border-2 border-primary/40">
          <CardHeader>
            <CardTitle>Adım 4 — Ödeme</CardTitle>
            <CardDescription>
              Form önizlemesi tamamlandı. Son adım olarak ödemeyi yapın; ardından başvurunuz
              incelemeye alınır.
            </CardDescription>
            <ApplicationFlowHint current="payment" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Bölüm: </span>
                {professionName || professionCode}
              </p>
              {careProviderLabel ? (
                <p>
                  <span className="text-muted-foreground">Uzman: </span>
                  {careProviderLabel}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Tutar: </span>
                {PAYMENT_AMOUNT.toLocaleString("tr-TR")} TRY
              </p>
            </div>
            <ApplicationPaymentForm
              applicationId={createdId}
              token={getToken() ?? ""}
              onSuccess={(receipt) => {
                setApplicationStatus(1);
                setPaymentCompleted(true);
                if (receipt) setPaymentReceipt(receipt);
                setStep("done");
              }}
            />
          </CardContent>
          <FormStepFooter>
            <Button type="button" variant="ghost" className={formStepButtonClass("gap-1.5")} onClick={() => setStep("preview")}>
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Button>
          </FormStepFooter>
        </Card>
      ) : null}

      {step === "done" && (
        <Card className="max-w-4xl w-full application-form-card ">
          <CardHeader>
            <CardTitle>
              {paymentCompleted ? "Başvurunuz tamamlandı" : "Başvuru güncellendi"}
            </CardTitle>
            <CardDescription>
              {paymentCompleted
                ? "Ödemeniz onaylandı. Başvurunuz uzman hekim değerlendirmesine iletildi."
                : "Değişiklikleriniz kaydedildi."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {paymentCompleted && paymentReceipt ? (
              <PaymentReceiptCard
                receipt={paymentReceipt}
                fallbackApplicationNumber={applicationNumber || createdId}
              />
            ) : paymentCompleted ? (
              <Alert>
                <AlertTitle>Teşekkürler</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    <strong>{PAYMENT_AMOUNT.toLocaleString("tr-TR")} TRY</strong> tutarındaki ödemeniz
                    onaylandı.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Başvuru durumunuzu &quot;Başvurularım&quot; sayfasından takip edebilirsiniz.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}
            {!paymentReceipt && paymentCompleted ? (
              <div className="text-sm space-y-2">
                {forRelative ? (
                  <p>
                    <span className="text-muted-foreground">Yakın: </span>
                    {relative.firstName} {relative.lastName}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Bölüm: </span>
                  {professionName || professionCode}
                </p>
                <p>
                  <span className="text-muted-foreground">Başvuru no: </span>
                  <span className="font-mono text-xs">{applicationNumber || createdId}</span>
                </p>
              </div>
            ) : null}
          </CardContent>
          <FormStepFooter>
            <Button asChild className={formStepButtonClass()}>
              <Link href={ROUTES.patient.applications}>Başvurularıma git</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={formStepButtonClass()}
              onClick={() => {
                setStep("who");
                setForRelative(false);
                setRelative(emptyRelative);
                setApplicationStatus(null);
                setProfessionCode("");
                setProfessionName("");
                setCareProviderId("");
                setCareProviderLabel("");
                setSurveyAnswers(EMPTY_SURVEY);
                setSurveyFields({});
                setPendingFiles([]);
                setFileError("");
                setSurveyFormError("");
                setCreatedId("");
                setApplicationStatus(null);
                setApplicationNumber("");
                setPaymentCompleted(false);
                setPaymentReceipt(null);
                setError("");
                if (editId) router.replace(ROUTES.patient.newApplication);
              }}
            >
              Yeni başvuru daha
            </Button>
          </FormStepFooter>
        </Card>
      )}

      <ConfirmModal
        isOpen={paymentConfirmOpen}
        title="Ödemeye geç"
        message="Formu onaylayıp ödeme adımına geçmek istediğinize emin misiniz?"
        confirmText="Evet, ödemeye geç"
        cancelText="Vazgeç"
        onConfirm={() => {
          if (!createdId) return;
          if (!professionCode || !careProviderId) {
            setPaymentConfirmOpen(false);
            setError("Bölüm ve Doktor seçimi zorunludur.");
            setStep("details");
            return;
          }
          const surveyErrs = validateApplicationSurvey(surveyAnswers);
          if (hasErrors(surveyErrs)) {
            setPaymentConfirmOpen(false);
            setSurveyFields(surveyErrs);
            setSurveyFormError(summarizeSurveyErrors(surveyErrs));
            setError("Ödemeye geçmeden önce şikayet formunu eksiksiz doldurun.");
            setStep("survey");
            return;
          }
          markPreviewConfirmed(createdId);
          setPaymentConfirmOpen(false);
          setError("");
          setStep("payment");
        }}
        onCancel={() => setPaymentConfirmOpen(false)}
      />
      </div>
    </PatientAppShell>
  );
}

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>}>
      <NewApplicationContent />
    </Suspense>
  );
}
