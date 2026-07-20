package handler

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
)

// ReportsOverview returns admin KPI snapshot for the ops center.
func (h *AdminHandler) ReportsOverview(w http.ResponseWriter, r *http.Request) {
	var errs validate.Errors
	startDate := validate.DateYYYYMMDD(&errs, "startDate", r.URL.Query().Get("startDate"))
	endDate := validate.DateYYYYMMDD(&errs, "endDate", r.URL.Query().Get("endDate"))
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	dateFilterPayments := ""
	dateFilterNotif := ""
	argsP := []interface{}{}
	argsN := []interface{}{}
	i := 1
	if startDate != "" {
		dateFilterPayments += fmt.Sprintf(" AND p.created_at >= $%d::date", i)
		dateFilterNotif += fmt.Sprintf(" AND created_at >= $%d::date", i)
		argsP = append(argsP, startDate)
		argsN = append(argsN, startDate)
		i++
	}
	if endDate != "" {
		dateFilterPayments += fmt.Sprintf(" AND p.created_at < ($%d::date + interval '1 day')", i)
		dateFilterNotif += fmt.Sprintf(" AND created_at < ($%d::date + interval '1 day')", i)
		argsP = append(argsP, endDate)
		argsN = append(argsN, endDate)
	}

	var paidCount, pendingCount, failedCount, refundedCount int
	var paidTotal, refundedTotal float64
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE p.status = 'paid'),
			COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0),
			COUNT(*) FILTER (WHERE p.status = 'pending'),
			COUNT(*) FILTER (WHERE p.status = 'failed'),
			COUNT(*) FILTER (WHERE p.status = 'refunded'),
			COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0)
		FROM payments p
		WHERE 1=1`+dateFilterPayments, argsP...).Scan(
		&paidCount, &paidTotal, &pendingCount, &failedCount, &refundedCount, &refundedTotal,
	)

	var smsSent, smsFailed, emailSent, emailFailed int
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE channel = 'sms' AND status = 'sent'),
			COUNT(*) FILTER (WHERE channel = 'sms' AND status = 'failed'),
			COUNT(*) FILTER (WHERE channel = 'email' AND status = 'sent'),
			COUNT(*) FILTER (WHERE channel = 'email' AND status = 'failed')
		FROM notification_logs
		WHERE 1=1`+dateFilterNotif, argsN...).Scan(&smsSent, &smsFailed, &emailSent, &emailFailed)

	var invoiceIssued, invoiceFailed, invoicePending int
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE status = 'issued'),
			COUNT(*) FILTER (WHERE status = 'failed'),
			COUNT(*) FILTER (WHERE status = 'pending')
		FROM invoices
	`).Scan(&invoiceIssued, &invoiceFailed, &invoicePending)

	var appPaid, appPending int
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE status_code = 1),
			COUNT(*) FILTER (WHERE status_code = 0)
		FROM applications
	`).Scan(&appPaid, &appPending)

	var vatRate, defaultShare float64 = 20, 70
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT vat_rate, default_doctor_share_percent FROM accounting_settings WHERE id = 1
	`).Scan(&vatRate, &defaultShare)

	net := paidTotal
	vat := 0.0
	if vatRate > 0 {
		net = paidTotal / (1 + vatRate/100)
		vat = paidTotal - net
	}
	doctorEst := net * defaultShare / 100

	response.OK(w, map[string]interface{}{
		"payments": map[string]interface{}{
			"paidCount": paidCount, "paidTotal": round2(paidTotal),
			"pendingCount": pendingCount, "failedCount": failedCount,
			"refundedCount": refundedCount, "refundedTotal": round2(refundedTotal),
		},
		"notifications": map[string]interface{}{
			"smsSent": smsSent, "smsFailed": smsFailed,
			"emailSent": emailSent, "emailFailed": emailFailed,
		},
		"invoices": map[string]interface{}{
			"issued": invoiceIssued, "failed": invoiceFailed, "pending": invoicePending,
		},
		"applications": map[string]interface{}{
			"paymentCompleted": appPaid, "paymentPending": appPending,
		},
		"earningsEstimate": map[string]interface{}{
			"vatRate": vatRate, "defaultDoctorSharePercent": defaultShare,
			"grossPaid": round2(paidTotal), "vatAmount": round2(vat),
			"netAmount": round2(net), "doctorShareEstimate": round2(doctorEst),
			"institutionShareEstimate": round2(net - doctorEst),
		},
	})
}

// ListNotificationsReport paginated SMS/email ops log.
func (h *AdminHandler) ListNotificationsReport(w http.ResponseWriter, r *http.Request) {
	var errs validate.Errors
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	page, pageSize = validate.Paging(&errs, page, pageSize)

	channel := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("channel")))
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	startDate := validate.DateYYYYMMDD(&errs, "startDate", r.URL.Query().Get("startDate"))
	endDate := validate.DateYYYYMMDD(&errs, "endDate", r.URL.Query().Get("endDate"))
	templateKey := strings.TrimSpace(r.URL.Query().Get("templateKey"))

	if channel != "" && channel != "sms" && channel != "email" {
		errs.Add("channel", "enum", "Kanal sms veya email olmalıdır.")
	}
	if status != "" && status != "sent" && status != "failed" && status != "pending" {
		errs.Add("status", "enum", "Durum sent, failed veya pending olabilir.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	where := []string{"1=1"}
	args := []interface{}{}
	ai := 1
	if channel != "" {
		where = append(where, fmt.Sprintf("channel::text = $%d", ai))
		args = append(args, channel)
		ai++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status::text = $%d", ai))
		args = append(args, status)
		ai++
	}
	if templateKey != "" {
		where = append(where, fmt.Sprintf("template_key ILIKE $%d", ai))
		args = append(args, "%"+templateKey+"%")
		ai++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(recipient ILIKE $%d OR COALESCE(body_preview,'') ILIKE $%d OR COALESCE(template_key,'') ILIKE $%d)", ai, ai, ai))
		args = append(args, "%"+search+"%")
		ai++
	}
	if startDate != "" {
		where = append(where, fmt.Sprintf("created_at >= $%d::date", ai))
		args = append(args, startDate)
		ai++
	}
	if endDate != "" {
		where = append(where, fmt.Sprintf("created_at < ($%d::date + interval '1 day')", ai))
		args = append(args, endDate)
		ai++
	}
	whereSQL := " WHERE " + strings.Join(where, " AND ")

	var total int
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM notification_logs`+whereSQL, args...).Scan(&total)

	q := fmt.Sprintf(`
		SELECT id::text, channel::text, recipient, COALESCE(template_key,''), status::text,
		       COALESCE(subject,''), COALESCE(body_preview,''),
		       application_id::text, user_id::text, created_at, sent_at
		FROM notification_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, ai, ai+1)
	rows, err := h.db.Pool.Query(r.Context(), q, append(args, pageSize, page*pageSize)...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "RPT010", "Bildirim raporu alınamadı.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var id, ch, recipient, tmpl, st, subject, preview string
		var appID, userID *string
		var createdAt time.Time
		var sentAt *time.Time
		if err := rows.Scan(&id, &ch, &recipient, &tmpl, &st, &subject, &preview, &appID, &userID, &createdAt, &sentAt); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id": id, "channel": ch, "recipient": recipient, "templateKey": tmpl,
			"status": st, "subject": subject, "bodyPreview": preview, "createdAt": createdAt,
		}
		if appID != nil {
			item["applicationId"] = *appID
		}
		if userID != nil {
			item["userId"] = *userID
		}
		if sentAt != nil {
			item["sentAt"] = *sentAt
		}
		items = append(items, item)
	}
	response.OK(w, map[string]interface{}{
		"items": items, "totalCount": total, "page": page, "pageSize": pageSize,
	})
}

func (h *AdminHandler) ExportNotificationsCSV(w http.ResponseWriter, r *http.Request) {
	channel := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("channel")))
	where := "WHERE 1=1"
	args := []interface{}{}
	if channel == "sms" || channel == "email" {
		where += " AND channel::text = $1"
		args = append(args, channel)
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, channel::text, recipient, COALESCE(template_key,''), status::text,
		       COALESCE(subject,''), COALESCE(body_preview,''), created_at
		FROM notification_logs `+where+`
		ORDER BY created_at DESC
		LIMIT 10000
	`, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "RPT011", "CSV oluşturulamadı.")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=bildirimler.csv")
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"ID", "Kanal", "Alıcı", "Şablon", "Durum", "Konu", "Özet", "Tarih"})
	for rows.Next() {
		var id, ch, recipient, tmpl, st, subject, preview string
		var createdAt time.Time
		if err := rows.Scan(&id, &ch, &recipient, &tmpl, &st, &subject, &preview, &createdAt); err != nil {
			continue
		}
		_ = cw.Write([]string{id, ch, recipient, tmpl, st, subject, preview, createdAt.Format("2006-01-02 15:04")})
	}
	cw.Flush()
}

// ListRefunds lists recorded refunds.
func (h *AdminHandler) ListRefunds(w http.ResponseWriter, r *http.Request) {
	var errs validate.Errors
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	page, pageSize = validate.Paging(&errs, page, pageSize)
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	if status != "" && status != "pending" && status != "refunded" && status != "failed" {
		errs.Add("status", "enum", "Durum pending, refunded veya failed olabilir.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	where := []string{"1=1"}
	args := []interface{}{}
	ai := 1
	if status != "" {
		where = append(where, fmt.Sprintf("r.status::text = $%d", ai))
		args = append(args, status)
		ai++
	}
	if search != "" {
		where = append(where, fmt.Sprintf(`(
			r.payment_id::text ILIKE $%d OR r.application_id::text ILIKE $%d
			OR COALESCE(r.reason,'') ILIKE $%d
			OR COALESCE(u.first_name || ' ' || u.last_name,'') ILIKE $%d
			OR COALESCE(o.merchant_oid,'') ILIKE $%d
		)`, ai, ai, ai, ai, ai))
		args = append(args, "%"+search+"%")
		ai++
	}
	whereSQL := " WHERE " + strings.Join(where, " AND ")

	var total int
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM refunds r
		LEFT JOIN payments p ON p.id = r.payment_id
		LEFT JOIN users u ON u.id = p.user_id
		LEFT JOIN orders o ON o.id = p.order_id
	`+whereSQL, args...).Scan(&total)

	q := fmt.Sprintf(`
		SELECT r.id::text, r.payment_id::text, r.application_id::text, r.amount, r.reason,
		       r.status::text, COALESCE(r.provider_refund_id,''), r.created_at, r.processed_at,
		       COALESCE(u.first_name || ' ' || u.last_name, ''),
		       COALESCE(o.merchant_oid,''), COALESCE(p.provider::text,'')
		FROM refunds r
		LEFT JOIN payments p ON p.id = r.payment_id
		LEFT JOIN users u ON u.id = p.user_id
		LEFT JOIN orders o ON o.id = p.order_id
		%s
		ORDER BY r.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, ai, ai+1)
	rows, err := h.db.Pool.Query(r.Context(), q, append(args, pageSize, page*pageSize)...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "RPT020", "İadeler listelenemedi.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var id, paymentID, appID, reason, st, providerRefundID, patient, merchantOID, provider string
		var amount float64
		var createdAt time.Time
		var processedAt *time.Time
		if err := rows.Scan(&id, &paymentID, &appID, &amount, &reason, &st, &providerRefundID, &createdAt, &processedAt, &patient, &merchantOID, &provider); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id": id, "paymentId": paymentID, "applicationId": appID, "amount": amount,
			"reason": reason, "status": st, "providerRefundId": providerRefundID,
			"createdAt": createdAt, "patientName": patient, "merchantOid": merchantOID, "provider": provider,
		}
		if processedAt != nil {
			item["processedAt"] = *processedAt
		}
		items = append(items, item)
	}
	response.OK(w, map[string]interface{}{
		"items": items, "totalCount": total, "page": page, "pageSize": pageSize,
	})
}

// DoctorEarningsReport aggregates paid payments by care provider (doctor).
func (h *AdminHandler) DoctorEarningsReport(w http.ResponseWriter, r *http.Request) {
	var errs validate.Errors
	startDate := validate.DateYYYYMMDD(&errs, "startDate", r.URL.Query().Get("startDate"))
	endDate := validate.DateYYYYMMDD(&errs, "endDate", r.URL.Query().Get("endDate"))
	doctorID := strings.TrimSpace(r.URL.Query().Get("doctorId"))
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	var vatRate float64 = 20
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT vat_rate FROM accounting_settings WHERE id = 1`).Scan(&vatRate)

	where := []string{`p.status = 'paid'`, `cp.id IS NOT NULL`}
	args := []interface{}{}
	ai := 1
	if startDate != "" {
		where = append(where, fmt.Sprintf("COALESCE(p.paid_at, p.created_at)::date >= $%d::date", ai))
		args = append(args, startDate)
		ai++
	}
	if endDate != "" {
		where = append(where, fmt.Sprintf("COALESCE(p.paid_at, p.created_at)::date <= $%d::date", ai))
		args = append(args, endDate)
		ai++
	}
	if doctorID != "" {
		if _, err := uuid.Parse(doctorID); err != nil {
			response.Fail(w, http.StatusBadRequest, "RPT030", "Geçersiz doktor ID.")
			return
		}
		where = append(where, fmt.Sprintf("cp.id = $%d::uuid", ai))
		args = append(args, doctorID)
		ai++
	}
	whereSQL := " WHERE " + strings.Join(where, " AND ")

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT cp.id::text,
		       COALESCE(cp.full_name, '—'),
		       COALESCE(cp.title, ''),
		       COALESCE(cp.revenue_share_percent, 70),
		       COUNT(p.id),
		       COALESCE(SUM(p.amount), 0)::float8,
		       COALESCE(SUM(CASE WHEN p.status = 'refunded' THEN 0 ELSE 0 END), 0)::float8
		FROM payments p
		JOIN applications a ON a.id = p.application_id
		JOIN care_providers cp ON cp.id = a.care_provider_id
		`+whereSQL+`
		GROUP BY cp.id, cp.full_name, cp.title, cp.revenue_share_percent
		ORDER BY COALESCE(SUM(p.amount), 0) DESC
	`, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "RPT031", "Doktor kazanç raporu alınamadı.")
		return
	}
	defer rows.Close()

	// Refunds per doctor in period (subtract)
	refundMap := map[string]float64{}
	refRows, _ := h.db.Pool.Query(r.Context(), `
		SELECT cp.id::text, COALESCE(SUM(rf.amount),0)::float8
		FROM refunds rf
		JOIN payments p ON p.id = rf.payment_id
		JOIN applications a ON a.id = p.application_id
		JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE rf.status = 'refunded'
		GROUP BY cp.id
	`)
	if refRows != nil {
		defer refRows.Close()
		for refRows.Next() {
			var id string
			var amt float64
			if refRows.Scan(&id, &amt) == nil {
				refundMap[id] = amt
			}
		}
	}

	items := []map[string]interface{}{}
	var sumGross, sumDoctor, sumInstitution, sumRefund float64
	var sumCount int
	for rows.Next() {
		var id, name, title string
		var share, gross, _unused float64
		var count int
		if err := rows.Scan(&id, &name, &title, &share, &count, &gross, &_unused); err != nil {
			continue
		}
		refunded := refundMap[id]
		effectiveGross := gross // already only paid; refunds tracked separately on payment status
		// If payment moved to refunded it won't be in paid sum — also show refundMap for visibility
		net := effectiveGross
		vat := 0.0
		if vatRate > 0 {
			net = effectiveGross / (1 + vatRate/100)
			vat = effectiveGross - net
		}
		doctorShare := net * share / 100
		institutionShare := net - doctorShare

		sumGross += effectiveGross
		sumDoctor += doctorShare
		sumInstitution += institutionShare
		sumRefund += refunded
		sumCount += count

		items = append(items, map[string]interface{}{
			"doctorId":              id,
			"doctorName":            name,
			"title":                 title,
			"revenueSharePercent":   share,
			"paymentCount":          count,
			"grossAmount":           round2(effectiveGross),
			"vatAmount":             round2(vat),
			"netAmount":             round2(net),
			"doctorShare":           round2(doctorShare),
			"institutionShare":      round2(institutionShare),
			"refundedAmount":        round2(refunded),
			"vatRate":               vatRate,
		})
	}

	response.OK(w, map[string]interface{}{
		"items": items,
		"summary": map[string]interface{}{
			"doctorCount":       len(items),
			"paymentCount":      sumCount,
			"grossTotal":        round2(sumGross),
			"doctorTotal":       round2(sumDoctor),
			"institutionTotal":  round2(sumInstitution),
			"refundedTotal":     round2(sumRefund),
			"vatRate":           vatRate,
		},
	})
}

func (h *AdminHandler) ExportDoctorEarningsCSV(w http.ResponseWriter, r *http.Request) {
	// Reuse DoctorEarningsReport logic via internal redirect-style: call query again
	startDate := strings.TrimSpace(r.URL.Query().Get("startDate"))
	endDate := strings.TrimSpace(r.URL.Query().Get("endDate"))
	var vatRate float64 = 20
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT vat_rate FROM accounting_settings WHERE id = 1`).Scan(&vatRate)

	where := []string{`p.status = 'paid'`, `cp.id IS NOT NULL`}
	args := []interface{}{}
	ai := 1
	if startDate != "" {
		where = append(where, fmt.Sprintf("COALESCE(p.paid_at, p.created_at)::date >= $%d::date", ai))
		args = append(args, startDate)
		ai++
	}
	if endDate != "" {
		where = append(where, fmt.Sprintf("COALESCE(p.paid_at, p.created_at)::date <= $%d::date", ai))
		args = append(args, endDate)
	}
	whereSQL := " WHERE " + strings.Join(where, " AND ")

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT COALESCE(cp.full_name,'—'), COALESCE(cp.title,''), COALESCE(cp.revenue_share_percent,70),
		       COUNT(p.id), COALESCE(SUM(p.amount),0)::float8
		FROM payments p
		JOIN applications a ON a.id = p.application_id
		JOIN care_providers cp ON cp.id = a.care_provider_id
		`+whereSQL+`
		GROUP BY cp.id, cp.full_name, cp.title, cp.revenue_share_percent
		ORDER BY COALESCE(SUM(p.amount),0) DESC
	`, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "RPT032", "CSV oluşturulamadı.")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=doktor_kazanc.csv")
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"Doktor", "Unvan", "Pay %", "Ödeme Adedi", "Brüt", "KDV", "Net", "Doktor Payı", "Kurum Payı"})
	for rows.Next() {
		var name, title string
		var share, gross float64
		var count int
		if err := rows.Scan(&name, &title, &share, &count, &gross); err != nil {
			continue
		}
		net := gross
		vat := 0.0
		if vatRate > 0 {
			net = gross / (1 + vatRate/100)
			vat = gross - net
		}
		doc := net * share / 100
		inst := net - doc
		_ = cw.Write([]string{
			name, title, fmt.Sprintf("%.2f", share), strconv.Itoa(count),
			fmt.Sprintf("%.2f", round2(gross)), fmt.Sprintf("%.2f", round2(vat)),
			fmt.Sprintf("%.2f", round2(net)), fmt.Sprintf("%.2f", round2(doc)),
			fmt.Sprintf("%.2f", round2(inst)),
		})
	}
	cw.Flush()
}