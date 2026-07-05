package application

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"strings"
	"time"

	"github.com/google/uuid"
)

type PreviewData struct {
	ApplicationNumber string
	ProfessionName    string
	DoctorName        string
	PatientName       string
	IsForRelative     bool
	RelativeName      string
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

	err := s.db.Pool.QueryRow(ctx, `
		SELECT a.application_number, a.profession_name, a.is_for_relative, a.created_at, a.status_code,
		       COALESCE(s.data, '{}'), u.first_name, u.last_name,
		       cp.full_name
		FROM applications a
		JOIN users u ON u.id = a.owner_user_id
		LEFT JOIN application_surveys s ON s.application_id = a.id
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE a.id = $1
	`, appID).Scan(&appNumber, &professionName, &isForRelative, &createdAt, &statusCode,
		&surveyData, &ownerFirst, &ownerLast, &doctorName)
	if err != nil {
		return nil, err
	}

	preview := &PreviewData{
		ApplicationNumber: derefStr(appNumber),
		ProfessionName:    derefStr(professionName),
		DoctorName:        derefStr(doctorName),
		PatientName:       strings.TrimSpace(ownerFirst + " " + ownerLast),
		IsForRelative:     isForRelative,
		CreatedAt:         createdAt,
		StatusLabel:       statusLabel(statusCode),
		Survey:            map[string]string{},
	}

	if isForRelative {
		var fn, ln string
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT first_name, last_name FROM application_represented_persons WHERE application_id = $1
		`, appID).Scan(&fn, &ln)
		preview.RelativeName = strings.TrimSpace(fn + " " + ln)
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
		fmt.Fprintf(&sections, `<section class="block"><h2>%s</h2><p>%s</p></section>`,
			html.EscapeString(surveyLabels[key]), html.EscapeString(val))
	}

	var files strings.Builder
	if len(p.Attachments) == 0 {
		files.WriteString(`<p class="muted">Ek belge yok</p>`)
	} else {
		files.WriteString(`<ul>`)
		for _, f := range p.Attachments {
			fmt.Fprintf(&files, `<li>%s</li>`, html.EscapeString(f))
		}
		files.WriteString(`</ul>`)
	}

	applicant := p.PatientName
	if p.IsForRelative && p.RelativeName != "" {
		applicant = p.RelativeName + ` <span class="muted">(yakın adına · başvuran: ` + html.EscapeString(p.PatientName) + `)</span>`
	} else {
		applicant = html.EscapeString(applicant)
	}

	doctor := html.EscapeString(p.DoctorName)
	if doctor == "" {
		doctor = "Atanmadı / tercih edilmedi"
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Başvuru Özeti %s</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 2rem auto; padding: 0 1.5rem; color: #111; line-height: 1.5; }
  header { border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
  .meta { font-size: .9rem; color: #444; }
  .muted { color: #666; font-size: .9rem; }
  .block { margin-bottom: 1.25rem; page-break-inside: avoid; }
  .block h2 { font-size: .95rem; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 .35rem; color: #333; }
  .block p { margin: 0; white-space: pre-wrap; }
  ul { margin: .25rem 0 0; padding-left: 1.25rem; }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: .8rem; color: #666; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<header>
  <h1>Tıbbi Danışmanlık Başvuru Formu</h1>
  <p class="meta">Başvuru no: %s · %s · Durum: %s</p>
</header>
<section class="block"><h2>Bölüm</h2><p>%s</p></section>
<section class="block"><h2>Uzman hekim</h2><p>%s</p></section>
<section class="block"><h2>Hasta</h2><p>%s</p></section>
%s
<section class="block"><h2>Ek belgeler</h2>%s</section>
<footer>Erciyes Üniversitesi Tıp Fakültesi · Tıbbi Danışmanlık Platformu · Oluşturulma: %s</footer>
</body>
</html>`,
		html.EscapeString(p.ApplicationNumber),
		html.EscapeString(p.ApplicationNumber),
		html.EscapeString(p.CreatedAt.Format("02.01.2006 15:04")),
		html.EscapeString(p.StatusLabel),
		html.EscapeString(p.ProfessionName),
		doctor,
		applicant,
		sections.String(),
		files.String(),
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
