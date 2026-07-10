package handler

import (
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
)

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func (h *AdminHandler) GetAccountingSettings(w http.ResponseWriter, r *http.Request) {
	var vatRate, defaultShare float64
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT vat_rate, default_doctor_share_percent FROM accounting_settings WHERE id = 1
	`).Scan(&vatRate, &defaultShare)
	if err != nil {
		vatRate, defaultShare = 20, 70
	}
	response.OK(w, map[string]interface{}{
		"vatRate":                   vatRate,
		"defaultDoctorSharePercent": defaultShare,
	})
}

func (h *AdminHandler) UpdateAccountingSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VatRate                   float64 `json:"vatRate"`
		DefaultDoctorSharePercent float64 `json:"defaultDoctorSharePercent"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	if req.VatRate < 0 || req.VatRate > 100 {
		errs.Add("vatRate", "range", "KDV oranı 0–100 arasında olmalıdır.")
	}
	if req.DefaultDoctorSharePercent < 0 || req.DefaultDoctorSharePercent > 100 {
		errs.Add("defaultDoctorSharePercent", "range", "Varsayılan doktor payı 0–100 arasında olmalıdır.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	_, err := h.db.Pool.Exec(r.Context(), `
		INSERT INTO accounting_settings (id, vat_rate, default_doctor_share_percent, updated_at)
		VALUES (1, $1, $2, now())
		ON CONFLICT (id) DO UPDATE
		SET vat_rate = EXCLUDED.vat_rate,
		    default_doctor_share_percent = EXCLUDED.default_doctor_share_percent,
		    updated_at = now()
	`, req.VatRate, req.DefaultDoctorSharePercent)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACC001", "Muhasebe ayarları kaydedilemedi.")
		return
	}
	response.OK(w, map[string]bool{"success": true})
}

// ListAccountingReport builds per-payment ledger with VAT + doctor/institution shares.
func (h *AdminHandler) ListAccountingReport(w http.ResponseWriter, r *http.Request) {
	dateFrom := strings.TrimSpace(r.URL.Query().Get("dateFrom"))
	dateTo := strings.TrimSpace(r.URL.Query().Get("dateTo"))
	doctorID := strings.TrimSpace(r.URL.Query().Get("doctorId"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	var vatRate float64 = 20
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT vat_rate FROM accounting_settings WHERE id = 1`).Scan(&vatRate)

	where := []string{`p.status = 'paid'`}
	args := []interface{}{}
	i := 1
	if dateFrom != "" {
		where = append(where, fmt.Sprintf("COALESCE(p.paid_at, p.created_at)::date >= $%d::date", i))
		args = append(args, dateFrom)
		i++
	}
	if dateTo != "" {
		where = append(where, fmt.Sprintf("COALESCE(p.paid_at, p.created_at)::date <= $%d::date", i))
		args = append(args, dateTo)
		i++
	}
	if doctorID != "" {
		where = append(where, fmt.Sprintf("cp.id = $%d::uuid", i))
		args = append(args, doctorID)
		i++
	}
	if search != "" {
		where = append(where, fmt.Sprintf(`(
			cp.full_name ILIKE $%d OR a.application_number ILIKE $%d
			OR u.first_name || ' ' || u.last_name ILIKE $%d
		)`, i, i, i))
		args = append(args, "%"+search+"%")
		i++
	}
	whereSQL := " WHERE " + strings.Join(where, " AND ")

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT p.id::text, a.id::text, COALESCE(a.application_number,''),
		       COALESCE(cp.full_name,'—'), COALESCE(cp.revenue_share_percent, 70),
		       p.amount::float8, COALESCE(p.paid_at, p.created_at),
		       trim(u.first_name || ' ' || u.last_name)
		FROM payments p
		JOIN applications a ON a.id = p.application_id
		JOIN users u ON u.id = a.owner_user_id
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		`+whereSQL+`
		ORDER BY COALESCE(p.paid_at, p.created_at) DESC
		LIMIT 500
	`, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ACC002", "Muhasebe raporu alınamadı.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	var sumGross, sumVat, sumNet, sumDoctor, sumInstitution float64

	for rows.Next() {
		var paymentID, appID, appNo, doctorName, patientName string
		var share, amount float64
		var paidAt time.Time
		if err := rows.Scan(&paymentID, &appID, &appNo, &doctorName, &share, &amount, &paidAt, &patientName); err != nil {
			continue
		}
		// KDV dahil tutar varsayımı
		net := amount
		vat := 0.0
		if vatRate > 0 {
			net = amount / (1 + vatRate/100)
			vat = amount - net
		}
		doctorShare := net * share / 100
		institutionShare := net - doctorShare

		sumGross += amount
		sumVat += vat
		sumNet += net
		sumDoctor += doctorShare
		sumInstitution += institutionShare

		items = append(items, map[string]interface{}{
			"paymentId":         paymentID,
			"applicationId":     appID,
			"applicationNumber": appNo,
			"patientName":       patientName,
			"doctorName":        doctorName,
			"revenueSharePercent": share,
			"grossAmount":       round2(amount),
			"vatRate":           vatRate,
			"vatAmount":         round2(vat),
			"netAmount":         round2(net),
			"doctorShare":       round2(doctorShare),
			"institutionShare":  round2(institutionShare),
			"paidAt":            paidAt,
		})
	}

	response.OK(w, map[string]interface{}{
		"items": items,
		"summary": map[string]interface{}{
			"count":            len(items),
			"grossTotal":       round2(sumGross),
			"vatTotal":         round2(sumVat),
			"netTotal":         round2(sumNet),
			"doctorTotal":      round2(sumDoctor),
			"institutionTotal": round2(sumInstitution),
			"vatRate":          vatRate,
		},
	})
}
