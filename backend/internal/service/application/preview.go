package application

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"html"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

type PreviewData struct {
	ApplicationID     uuid.UUID
	ApplicationNumber string
	ProfessionName    string
	DoctorName        string
	PatientName       string
	IsForRelative     bool
	RelativeName      string
	NationalIdentifier string
	Survey            map[string]string
	Attachments       []string
	CreatedAt         time.Time
	StatusLabel       string
}

func (s *Service) LoadPreview(ctx context.Context, appID uuid.UUID) (*PreviewData, error) {
	var professionName, appNumber *string
	var isForRelative bool
	var createdAt time.Time
	var statusCode int
	var surveyData []byte
	var ownerFirst, ownerLast string
	var doctorName *string
	var nationalID *string

	err := s.db.Pool.QueryRow(ctx, `
		SELECT a.application_number, a.profession_name, a.is_for_relative, a.created_at, a.status_code,
		       COALESCE(s.data, '{}'), u.first_name, u.last_name,
		       cp.full_name, u.national_identifier
		FROM applications a
		JOIN users u ON u.id = a.owner_user_id
		LEFT JOIN application_surveys s ON s.application_id = a.id
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE a.id = $1
	`, appID).Scan(&appNumber, &professionName, &isForRelative, &createdAt, &statusCode,
		&surveyData, &ownerFirst, &ownerLast, &doctorName, &nationalID)
	if err != nil {
		return nil, err
	}

	preview := &PreviewData{
		ApplicationID:     appID,
		ApplicationNumber: derefStr(appNumber),
		ProfessionName:    derefStr(professionName),
		DoctorName:        derefStr(doctorName),
		PatientName:       strings.TrimSpace(ownerFirst + " " + ownerLast),
		IsForRelative:     isForRelative,
		CreatedAt:         createdAt,
		StatusLabel:       statusLabel(statusCode),
		NationalIdentifier: derefStr(nationalID),
		Survey:            map[string]string{},
	}

	if isForRelative {
		var fn, ln string
		var relNationalID *string
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT first_name, last_name, national_identifier FROM application_represented_persons WHERE application_id = $1
		`, appID).Scan(&fn, &ln, &relNationalID)
		preview.RelativeName = strings.TrimSpace(fn + " " + ln)
		preview.NationalIdentifier = derefStr(relNationalID)
	}

	_ = json.Unmarshal(surveyData, &preview.Survey)

	rows, err := s.db.Pool.Query(ctx, `
		SELECT file_name FROM application_attachments WHERE application_id = $1 ORDER BY created_at
	`, appID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			if rows.Scan(&name) == nil {
				preview.Attachments = append(preview.Attachments, name)
			}
		}
	}

	return preview, nil
}

func RenderPreviewHTML(p *PreviewData) string {
	surveyLabels := map[string]string{
		"chiefComplaint":      "Başvuru nedeni / şikayet",
		"medicalHistory":      "Tıbbi öykü",
		"currentMedications":  "Kullandığı ilaçlar",
		"previousDiagnosis":   "Önceki tanı ve tedaviler",
		"questionsForDoctor":  "Doktora sorular",
		"additionalNotes":     "Ek açıklama",
	}
	order := []string{"chiefComplaint", "medicalHistory", "currentMedications", "previousDiagnosis", "questionsForDoctor", "additionalNotes"}

	var sections strings.Builder
	for _, key := range order {
		val := strings.TrimSpace(p.Survey[key])
		if val == "" {
			continue
		}
		fmt.Fprintf(&sections, `
<div class="survey-item">
  <div class="survey-label">%s</div>
  <div class="survey-value">%s</div>
</div>`,
			html.EscapeString(surveyLabels[key]), html.EscapeString(val))
	}

	var files strings.Builder
	if len(p.Attachments) == 0 {
		files.WriteString(`<p class="muted">Sisteme yüklenmiş ek tıbbi belge bulunmamaktadır.</p>`)
	} else {
		files.WriteString(`<ul class="attachments-list">`)
		for _, f := range p.Attachments {
			fmt.Fprintf(&files, `<li>%s</li>`, html.EscapeString(f))
		}
		files.WriteString(`</ul>`)
	}

	applicant := p.PatientName
	if p.IsForRelative && p.RelativeName != "" {
		applicant = p.RelativeName + ` <span class="muted">(Yakın adına / Başvuran: ` + html.EscapeString(p.PatientName) + `)</span>`
	} else {
		applicant = html.EscapeString(applicant)
	}

	doctor := html.EscapeString(p.DoctorName)
	if doctor == "" {
		doctor = "Belirtilmemiş / Hekim Havuzu"
	}

	portalURL := os.Getenv("PORTAL_URL")
	if portalURL == "" {
		portalURL = "http://localhost:3000"
	}
	
	// Strip protocol for display
	verifyDisplayURL := strings.TrimPrefix(portalURL, "https://")
	verifyDisplayURL = strings.TrimPrefix(verifyDisplayURL, "http://")
	verifyDisplayURL = verifyDisplayURL + "/verify/application/" + p.ApplicationID.String()

	verificationCode := GenerateVerificationCode(p.ApplicationID)
	qrLink := fmt.Sprintf("%s/verify/application/%s?code=%s", portalURL, p.ApplicationID.String(), verificationCode)
	qrCodeAPIURL := "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" + url.QueryEscape(qrLink)

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Başvuru Özeti %s</title>
<style>
  body { 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
    max-width: 800px; 
    margin: 0 auto; 
    padding: 2.5rem; 
    color: #1a1a1a; 
    line-height: 1.5; 
    background-color: #fff;
  }
  
  /* Resmi Antet / Üst Bilgi */
  .header-table {
    width: 100%%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
  }
  .header-table td {
    border: none !important;
    padding: 0 !important;
  }
  .official-title {
    font-size: 1.15rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    color: #000;
    line-height: 1.35;
  }
  .official-subtitle {
    font-size: 0.85rem;
    color: #444;
    margin-top: 6px;
    font-weight: bold;
  }
  .qr-container {
    text-align: right;
    font-size: 0.75rem;
    line-height: 1.3;
  }
  .qr-code {
    width: 95px;
    height: 95px;
    border: 1px solid #ddd;
    padding: 3px;
    background: #fff;
    margin-bottom: 4px;
    display: inline-block;
  }
  .divider {
    border-bottom: 3px double #000;
    margin-bottom: 2rem;
  }
  
  .document-title {
    text-align: center;
    font-size: 1.3rem;
    font-weight: bold;
    margin-bottom: 2.5rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #000;
  }
  
  /* Tablo Tasarımı */
  .info-table {
    width: 100%%;
    border-collapse: collapse;
    margin-bottom: 2.5rem;
    font-size: 0.85rem;
  }
  .info-table th, .info-table td {
    border: 1px solid #1a1a1a;
    padding: 8px 10px;
    vertical-align: middle;
  }
  .info-table th {
    background-color: #f8f9fa;
    text-align: left;
    font-weight: bold;
    width: 23%%;
    color: #333;
  }
  .info-table td {
    width: 27%%;
    color: #111;
  }
  
  /* Tıbbi Bilgiler Bölümleri */
  .section-title {
    font-size: 1rem;
    font-weight: bold;
    background-color: #f2f2f2;
    border: 1px solid #1a1a1a;
    padding: 6px 12px;
    margin-top: 2rem;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    page-break-after: avoid;
    color: #000;
  }
  
  .survey-item {
    border-bottom: 1px solid #e0e0e0;
    padding: 10px 0;
    page-break-inside: avoid;
  }
  .survey-label {
    font-weight: bold;
    font-size: 0.85rem;
    color: #333;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .survey-value {
    font-size: 0.9rem;
    color: #111;
    white-space: pre-wrap;
    text-align: justify;
    line-height: 1.5;
  }
  
  .attachments-list {
    margin: 0;
    padding-left: 1.25rem;
  }
  .attachments-list li {
    font-size: 0.85rem;
    color: #333;
    margin-bottom: 4px;
  }
  
  .muted { color: #666; font-size: 0.8rem; }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 0.8rem;
    font-weight: bold;
    border: 1px solid #000;
    text-transform: uppercase;
    background-color: #fff;
  }
  
  /* Doğrulama Açıklaması */
  .verification-notice {
    font-size: 0.75rem;
    color: #444;
    border: 1px solid #ccc;
    padding: 10px 12px;
    background-color: #fafafa;
    margin-top: 2.5rem;
    line-height: 1.45;
    page-break-inside: avoid;
  }
  
  /* İmza ve Onay Alanı */
  .signature-section {
    margin-top: 3.5rem;
    page-break-inside: avoid;
  }
  .signature-box {
    float: left;
    width: 45%%;
    font-size: 0.85rem;
  }
  .signature-box.right {
    float: right;
    text-align: right;
  }
  .signature-title {
    font-weight: bold;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    font-size: 0.8rem;
  }
  .signature-name {
    margin: 0;
    font-weight: bold;
  }
  .signature-desc {
    margin: 0;
    font-size: 0.8rem;
    color: #555;
  }
  .signature-line {
    border-bottom: 1px dashed #666;
    width: 100%%;
    height: 40px;
    margin-top: 0.5rem;
  }
  .clear {
    clear: both;
  }
  
  /* Sayfa Alt Bilgisi */
  footer {
    margin-top: 3rem;
    padding-top: 0.75rem;
    border-top: 1px solid #ccc;
    font-size: 0.75rem;
    color: #666;
    text-align: center;
  }
  
  @media (max-width: 640px) {
    body { padding: 1rem; font-size: 14px; }
    .header-table, .header-table tbody, .header-table tr, .header-table td { display: block; width: 100%% !important; }
    .qr-container { text-align: left; margin-top: 1rem; }
    .info-table th, .info-table td { display: block; width: 100%% !important; box-sizing: border-box; }
    .signature-box, .signature-box.right { float: none; width: 100%%; text-align: left; margin-bottom: 1.5rem; }
    .document-title { font-size: 1.05rem; margin-bottom: 1.5rem; }
  }
  @media print {
    body {
      padding: 0;
      font-size: 11pt;
    }
    .badge {
      border: 1px solid #000 !important;
    }
  }
</style>
</head>
<body>
<table class="header-table">
  <tr>
    <td>
      <div class="official-title">
        T.C.<br/>
        ERCİYES ÜNİVERSİTESİ<br/>
        TIP FAKÜLTESİ HASTANELERİ
      </div>
      <div class="official-subtitle">
        TIBBİ DANIŞMANLIK VE İKİNCİ GÖRÜŞ BİRİMİ
      </div>
    </td>
    <td class="qr-container">
      <img src="%s" alt="Doğrulama Karekodu" class="qr-code"/><br/>
      <strong>Evrak Doğrulama Kodu:</strong><br/>
      <span style="font-family: monospace; font-size: 0.85rem; font-weight: bold;">%s</span>
    </td>
  </tr>
</table>

<div class="divider"></div>

<div class="document-title">TIBBİ DANIŞMANLIK BAŞVURU FORMU</div>

<table class="info-table">
  <tr>
    <th>Başvuru Numarası</th>
    <td><strong>%s</strong></td>
    <th>Evrak Oluşturma Tarihi</th>
    <td>%s</td>
  </tr>
  <tr>
    <th>Hasta / Başvuran</th>
    <td>%s</td>
    <th>T.C. Kimlik Numarası</th>
    <td>%s</td>
  </tr>
  <tr>
    <th>Tıbbi Birim / Branş</th>
    <td>%s</td>
    <th>Tercih Edilen Hekim</th>
    <td>%s</td>
  </tr>
  <tr>
    <th>Sistem Kayıt Durumu</th>
    <td colspan="3"><span class="badge">%s</span></td>
  </tr>
</table>

<div class="section-title">Tıbbi Bilgiler / Anket Yanıtları</div>
%s

<div class="section-title">Ek Belgeler ve Tetkikler</div>
<div style="margin-bottom: 2rem;">
  %s
</div>

<div class="verification-notice">
  <strong>GÜVENLİK VE DOĞRULAMA BİLGİLENDİRMESİ:</strong><br/>
  5070 sayılı Elektronik İmza Kanununa uygun olarak bu belge sistem tarafından güvenli elektronik imza ile kayıt altına alınmıştır. 
  Belgenin doğruluğu, mobil cihazlar vasıtasıyla yukarıdaki karekod okutularak ya da internet tarayıcısı üzerinden 
  <strong>%s</strong> adresi ziyaret edilip <strong>%s</strong> doğrulama kodu girilerek sorgulanabilir.
</div>

<div class="signature-section">
  <div class="signature-box">
    <div class="signature-title">Başvuru Sahibi / Temsilcisi</div>
    <div class="signature-name">%s</div>
    <div class="signature-desc">Tarih: %s</div>
    <div class="signature-line"></div>
  </div>
  <div class="signature-box right">
    <div class="signature-title">Onay Makamı</div>
    <div class="signature-name">Erciyes Üniversitesi Tıp Fakültesi</div>
    <div class="signature-desc">Elektronik Başvuru Kayıt Birimi</div>
    <div class="signature-line"></div>
  </div>
  <div class="clear"></div>
</div>

<footer>
  Bu belge Erciyes Üniversitesi Tıp Fakültesi Tıbbi Danışmanlık Platformu üzerinden oluşturulmuştur. · Sistem Oluşturulma Tarihi: %s
</footer>
</body>
</html>`,
		html.EscapeString(p.ApplicationNumber),
		html.EscapeString(qrCodeAPIURL),
		html.EscapeString(verificationCode),
		html.EscapeString(p.ApplicationNumber),
		html.EscapeString(p.CreatedAt.Format("02.01.2006 15:04")),
		applicant,
		html.EscapeString(maskID(p.NationalIdentifier)),
		html.EscapeString(p.ProfessionName),
		doctor,
		html.EscapeString(p.StatusLabel),
		sections.String(),
		files.String(),
		html.EscapeString(verifyDisplayURL),
		html.EscapeString(verificationCode),
		html.EscapeString(p.PatientName),
		html.EscapeString(p.CreatedAt.Format("02.01.2006")),
		p.CreatedAt.Format("02.01.2006 15:04"),
	)
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func statusLabel(code int) string {
	labels := map[int]string{
		0: "Ödeme bekleniyor", 1: "Ödeme alındı", 2: "Onaylandı", 3: "Reddedildi",
		4: "İşlemde", 5: "Ek bilgi gerekli", 6: "Sonuçlandı", 7: "İptal edildi",
		10: "Doktor onayı bekleniyor", 11: "Sekreterya incelemesi",
	}
	if l, ok := labels[code]; ok {
		return l
	}
	return fmt.Sprintf("Durum %d", code)
}

func GenerateVerificationCode(appID uuid.UUID) string {
	h := sha256.New()
	h.Write([]byte(appID.String() + "erciyes-secret-salt-2026"))
	hashBytes := h.Sum(nil)
	hexStr := fmt.Sprintf("%x", hashBytes)
	return strings.ToUpper(fmt.Sprintf("%s-%s-%s", hexStr[0:4], hexStr[4:8], hexStr[8:12]))
}

func maskID(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return "Belirtilmemiş"
	}
	if len(id) < 11 {
		return id
	}
	return id[0:3] + "******" + id[9:11]
}

// DoctorReportFields holds structured doctor report content.
type DoctorReportFields struct {
	Summary         string `json:"summary"`
	Findings        string `json:"findings"`
	Recommendations string `json:"recommendations"`
	FollowUp        string `json:"followUp"`
}

func ParseDoctorReportFields(raw json.RawMessage) DoctorReportFields {
	var f DoctorReportFields
	_ = json.Unmarshal(raw, &f)
	if f.Findings == "" {
		var alt struct {
			Diagnosis string `json:"diagnosis"`
		}
		_ = json.Unmarshal(raw, &alt)
		f.Findings = alt.Diagnosis
	}
	return f
}

func RenderDoctorReportHTML(p *PreviewData, report DoctorReportFields, authorName string) string {
	sectionLabels := []struct {
		key, label string
	}{
		{"summary", "Tıbbi Özet ve Tanı Değerlendirmesi"},
		{"findings", "Tetkik ve Muayene Bulguları"},
		{"recommendations", "Tedavi Planı ve Öneriler"},
		{"followUp", "Kontrol ve Takip Planı"},
	}
	values := map[string]string{
		"summary": report.Summary, "findings": report.Findings,
		"recommendations": report.Recommendations, "followUp": report.FollowUp,
	}

	var sections strings.Builder
	for _, s := range sectionLabels {
		val := strings.TrimSpace(values[s.key])
		if val == "" {
			continue
		}
		fmt.Fprintf(&sections, `
<div class="survey-item">
  <div class="survey-label">%s</div>
  <div class="survey-value">%s</div>
</div>`, html.EscapeString(s.label), html.EscapeString(val))
	}
	if sections.Len() == 0 {
		sections.WriteString(`<p class="muted">Rapor içeriği henüz girilmemiştir.</p>`)
	}

	applicant := p.PatientName
	if p.IsForRelative && p.RelativeName != "" {
		applicant = p.RelativeName + ` <span class="muted">(Yakın adına / Başvuran: ` + html.EscapeString(p.PatientName) + `)</span>`
	} else {
		applicant = html.EscapeString(applicant)
	}

	doctor := html.EscapeString(p.DoctorName)
	if doctor == "" {
		doctor = "Belirtilmemiş / Hekim Havuzu"
	}
	author := html.EscapeString(strings.TrimSpace(authorName))
	if author == "" {
		author = doctor
	}

	portalURL := os.Getenv("PORTAL_URL")
	if portalURL == "" {
		portalURL = "http://localhost:3000"
	}
	verifyDisplayURL := strings.TrimPrefix(portalURL, "https://")
	verifyDisplayURL = strings.TrimPrefix(verifyDisplayURL, "http://")
	verifyDisplayURL = verifyDisplayURL + "/verify/application/" + p.ApplicationID.String()

	verificationCode := GenerateVerificationCode(p.ApplicationID)
	qrLink := fmt.Sprintf("%s/verify/application/%s?code=%s", portalURL, p.ApplicationID.String(), verificationCode)
	qrCodeAPIURL := "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" + url.QueryEscape(qrLink)

	now := time.Now().Format("02.01.2006 15:04")

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Tıbbi Uzman Raporu %s</title>
<style>
  body { 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
    max-width: 800px; 
    margin: 0 auto; 
    padding: 2.5rem; 
    color: #1a1a1a; 
    line-height: 1.5; 
    background-color: #fff;
  }
  .header-table { width: 100%%; border-collapse: collapse; margin-bottom: 1.5rem; }
  .header-table td { border: none !important; padding: 0 !important; }
  .official-title { font-size: 1.15rem; font-weight: bold; letter-spacing: 0.05em; color: #000; line-height: 1.35; }
  .official-subtitle { font-size: 0.85rem; color: #444; margin-top: 6px; font-weight: bold; }
  .qr-container { text-align: right; font-size: 0.75rem; line-height: 1.3; }
  .qr-code { width: 95px; height: 95px; border: 1px solid #ddd; padding: 3px; background: #fff; margin-bottom: 4px; display: inline-block; }
  .divider { border-bottom: 3px double #000; margin-bottom: 2rem; }
  .document-title { text-align: center; font-size: 1.3rem; font-weight: bold; margin-bottom: 2.5rem; letter-spacing: 0.03em; text-transform: uppercase; color: #000; }
  .info-table { width: 100%%; border-collapse: collapse; margin-bottom: 2.5rem; font-size: 0.85rem; }
  .info-table th, .info-table td { border: 1px solid #1a1a1a; padding: 8px 10px; vertical-align: middle; }
  .info-table th { background-color: #f8f9fa; text-align: left; font-weight: bold; width: 23%%; color: #333; }
  .info-table td { width: 27%%; color: #111; }
  .section-title { font-size: 1rem; font-weight: bold; background-color: #f2f2f2; border: 1px solid #1a1a1a; padding: 6px 12px; margin-top: 2rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.03em; page-break-after: avoid; color: #000; }
  .survey-item { border-bottom: 1px solid #e0e0e0; padding: 10px 0; page-break-inside: avoid; }
  .survey-label { font-weight: bold; font-size: 0.85rem; color: #333; margin-bottom: 4px; text-transform: uppercase; }
  .survey-value { font-size: 0.9rem; color: #111; white-space: pre-wrap; text-align: justify; line-height: 1.5; }
  .muted { color: #666; font-size: 0.8rem; }
  .badge { display: inline-block; padding: 2px 6px; font-size: 0.8rem; font-weight: bold; border: 1px solid #000; text-transform: uppercase; background-color: #fff; }
  .verification-notice { font-size: 0.75rem; color: #444; border: 1px solid #ccc; padding: 10px 12px; background-color: #fafafa; margin-top: 2.5rem; line-height: 1.45; page-break-inside: avoid; }
  .signature-section { margin-top: 3.5rem; page-break-inside: avoid; }
  .signature-box { float: left; width: 45%%; font-size: 0.85rem; }
  .signature-box.right { float: right; text-align: right; }
  .signature-title { font-weight: bold; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.8rem; }
  .signature-name { margin: 0; font-weight: bold; }
  .signature-desc { margin: 0; font-size: 0.8rem; color: #555; }
  .signature-line { border-bottom: 1px dashed #666; width: 100%%; height: 40px; margin-top: 0.5rem; }
  .clear { clear: both; }
  footer { margin-top: 3rem; padding-top: 0.75rem; border-top: 1px solid #ccc; font-size: 0.75rem; color: #666; text-align: center; }
  @media (max-width: 640px) {
    body { padding: 1rem; font-size: 14px; }
    .header-table, .header-table tbody, .header-table tr, .header-table td { display: block; width: 100%% !important; }
    .qr-container { text-align: left; margin-top: 1rem; }
    .info-table th, .info-table td { display: block; width: 100%% !important; box-sizing: border-box; }
    .signature-box, .signature-box.right { float: none; width: 100%%; text-align: left; margin-bottom: 1.5rem; }
    .document-title { font-size: 1.05rem; margin-bottom: 1.5rem; }
  }
  @media print { body { padding: 0; font-size: 11pt; } .badge { border: 1px solid #000 !important; } }
</style>
</head>
<body>
<table class="header-table">
  <tr>
    <td>
      <div class="official-title">T.C.<br/>ERCİYES ÜNİVERSİTESİ<br/>TIP FAKÜLTESİ HASTANELERİ</div>
      <div class="official-subtitle">TIBBİ DANIŞMANLIK VE İKİNCİ GÖRÜŞ BİRİMİ</div>
    </td>
    <td class="qr-container">
      <img src="%s" alt="Doğrulama Karekodu" class="qr-code"/><br/>
      <strong>Evrak Doğrulama Kodu:</strong><br/>
      <span style="font-family: monospace; font-size: 0.85rem; font-weight: bold;">%s</span>
    </td>
  </tr>
</table>
<div class="divider"></div>
<div class="document-title">TIBBİ UZMAN DEĞERLENDİRME RAPORU</div>
<table class="info-table">
  <tr>
    <th>Başvuru Numarası</th>
    <td><strong>%s</strong></td>
    <th>Rapor Tarihi</th>
    <td>%s</td>
  </tr>
  <tr>
    <th>Hasta / Başvuran</th>
    <td>%s</td>
    <th>T.C. Kimlik Numarası</th>
    <td>%s</td>
  </tr>
  <tr>
    <th>Tıbbi Birim / Branş</th>
    <td>%s</td>
    <th>Değerlendiren Hekim</th>
    <td>%s</td>
  </tr>
  <tr>
    <th>Evrak Durumu</th>
    <td colspan="3"><span class="badge">%s</span></td>
  </tr>
</table>
<div class="section-title">Hekim Değerlendirmesi</div>
%s
<div class="verification-notice">
  <strong>GÜVENLİK VE DOĞRULAMA BİLGİLENDİRMESİ:</strong><br/>
  Bu belge Erciyes Üniversitesi Tıp Fakültesi Tıbbi Danışmanlık Platformu üzerinden oluşturulmuştur.
  Belgenin doğruluğu, mobil cihazlar vasıtasıyla yukarıdaki karekod okutularak ya da internet tarayıcısı üzerinden
  <strong>%s</strong> adresi ziyaret edilip <strong>%s</strong> doğrulama kodu girilerek sorgulanabilir.
</div>
<div class="signature-section">
  <div class="signature-box">
    <div class="signature-title">Hasta / Başvuran</div>
    <div class="signature-name">%s</div>
    <div class="signature-desc">Başvuru tarihi: %s</div>
    <div class="signature-line"></div>
  </div>
  <div class="signature-box right">
    <div class="signature-title">Değerlendiren Hekim</div>
    <div class="signature-name">%s</div>
    <div class="signature-desc">Erciyes Üniversitesi Tıp Fakültesi</div>
    <div class="signature-line"></div>
  </div>
  <div class="clear"></div>
</div>
<footer>
  Bu belge Erciyes Üniversitesi Tıp Fakültesi Tıbbi Danışmanlık Platformu üzerinden oluşturulmuştur. · Sistem Oluşturulma Tarihi: %s
</footer>
</body>
</html>`,
		html.EscapeString(p.ApplicationNumber),
		html.EscapeString(qrCodeAPIURL),
		html.EscapeString(verificationCode),
		html.EscapeString(p.ApplicationNumber),
		html.EscapeString(now),
		applicant,
		html.EscapeString(maskID(p.NationalIdentifier)),
		html.EscapeString(p.ProfessionName),
		author,
		html.EscapeString(p.StatusLabel),
		sections.String(),
		html.EscapeString(verifyDisplayURL),
		html.EscapeString(verificationCode),
		html.EscapeString(p.PatientName),
		html.EscapeString(p.CreatedAt.Format("02.01.2006")),
		author,
		now,
	)
}
