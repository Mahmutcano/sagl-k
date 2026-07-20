package handler

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/google/uuid"
	authmw "medical-consultation-platform/backend/internal/middleware"
	"medical-consultation-platform/backend/internal/domain"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	invoicesvc "medical-consultation-platform/backend/internal/service/invoice"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
)

// StartPayTRPayment creates an order + pending payment and returns iframe token.
func (h *ApplicationHandler) StartPayTRPayment(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}

	if existing, err := h.payment.Store().FindPaidByApplication(r.Context(), appID); err == nil && existing != nil {
		receipt := h.buildPaymentReceipt(r.Context(), existing.ID, appID)
		response.OK(w, paymentResultPayload(&paysvc.CheckoutResult{
			TransactionID: existing.ProviderTransactionID,
			OrderID:       appID.String(),
			Status:        "paid",
			PaymentID:     existing.ID.String(),
		}, receipt))
		return
	}

	var amount float64
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(cp.consultation_fee, 1000.00)
		FROM applications a
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE a.id = $1
	`, appID).Scan(&amount)
	if err != nil || amount <= 0 {
		amount = h.cfg.PaymentAmount
	}

	var errs validate.Errors
	validate.PaymentAmount(&errs, "amount", amount)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	var statusCode int
	var appNumber *string
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT status_code, application_number FROM applications WHERE id = $1
	`, appID).Scan(&statusCode, &appNumber)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP001", "Başvuru bulunamadı.")
		return
	}
	if statusCode != domain.StatusPaymentPending {
		if statusCode == domain.StatusPaymentCompleted {
			response.OK(w, map[string]interface{}{"status": "paid", "orderId": appID.String()})
			return
		}
		response.Fail(w, http.StatusConflict, "APP110", "Bu başvuru için ödeme beklenmiyor.")
		return
	}

	var firstName, lastName, email, phone string
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT first_name, last_name, COALESCE(email,''), COALESCE(phone_number,'')
		FROM users WHERE id = $1
	`, claims.UserID).Scan(&firstName, &lastName, &email, &phone)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "APP112", "Kullanıcı bilgileri alınamadı.")
		return
	}

	customerName := strings.TrimSpace(firstName + " " + lastName)
	var custErrs validate.Errors
	validate.PayTRCustomerEmail(&custErrs, "email", email)
	validate.PayTRCustomerPhone(&custErrs, "phoneNumber", phone)
	validate.PayTRCustomerName(&custErrs, "fullName", customerName)
	if custErrs.Has() {
		validate.Fail(w, custErrs)
		return
	}

	okURL := strings.TrimRight(h.cfg.PortalURL, "/") + "/patient/applications/" + appID.String() + "?payment=success"
	failURL := strings.TrimRight(h.cfg.PortalURL, "/") + "/patient/applications/" + appID.String() + "?payment=failed"
	if strings.TrimSpace(h.cfg.PayTR.OKURL) != "" {
		okURL = strings.ReplaceAll(h.cfg.PayTR.OKURL, "{id}", appID.String())
	}
	if strings.TrimSpace(h.cfg.PayTR.FailURL) != "" {
		failURL = strings.ReplaceAll(h.cfg.PayTR.FailURL, "{id}", appID.String())
	}

	// Persist order first so idempotent retries reuse the same merchant_oid, then mint token for that oid.
	orderID, paymentID, merchantOID, err := h.payment.Store().CreateOrderAndPayment(r.Context(), paysvc.OrderRecord{
		ApplicationID:  appID,
		UserID:         claims.UserID,
		MerchantOID:    paysvc.NewMerchantOID(appID),
		Amount:         amount,
		Currency:       "TRY",
		IdempotencyKey: "paytr:" + appID.String(),
	}, "", "", map[string]interface{}{
		"provider": "paytr",
		"mode":     h.cfg.PayTR.Mode,
	})
	if err != nil {
		if strings.Contains(err.Error(), "already paid") {
			response.OK(w, map[string]interface{}{"status": "paid", "orderId": appID.String()})
			return
		}
		response.Fail(w, http.StatusInternalServerError, "APP113", "Ödeme kaydı oluşturulamadı.")
		return
	}

	tokenRes, err := h.payment.PayTR().GetToken(r.Context(), paysvc.TokenRequest{
		MerchantOID:   merchantOID,
		Email:         email,
		PaymentAmount: amount,
		UserName:      customerName,
		UserAddress:   "Turkiye",
		UserPhone:     phone,
		UserIP:        clientIP(r),
		UserBasket: []paysvc.BasketItem{{
			Name: "Tibbi danismanlik", Price: amount, Quantity: 1,
		}},
		OKURL:   okURL,
		FailURL: failURL,
	})
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "APP111", response.SafeMessage(err, "PAYTR token alınamadı."))
		return
	}
	_ = h.payment.Store().SetPayTRToken(r.Context(), paymentID, tokenRes.Token, tokenRes.IframeURL)

	_ = appNumber
	mode := strings.ToLower(strings.TrimSpace(h.cfg.PayTR.Mode))
	if mode == "" {
		mode = "mock"
	}
	response.OK(w, map[string]interface{}{
		"status":      "awaiting_payment",
		"provider":    "paytr",
		"paymentId":   paymentID.String(),
		"orderId":     orderID.String(),
		"merchantOid": merchantOID,
		"token":       tokenRes.Token,
		"iframeUrl":   tokenRes.IframeURL,
		"amount":      amount,
		"currency":    "TRY",
		"mode":        mode,
		"mock":        tokenRes.Status == "mock" || h.payment.PayTR().IsMock(),
		"testCards":   paysvc.PayTRTestCards(mode),
	})
}

// PayTRCallback handles asynchronous PAYTR notification (no auth). Must respond "OK".
func (h *ApplicationHandler) PayTRCallback(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	raw := map[string]string{}
	for k, vals := range r.PostForm {
		if len(vals) > 0 {
			raw[k] = vals[0]
		}
	}

	var errs validate.Errors
	merchantOID := validate.MerchantOID(&errs, "merchant_oid", r.FormValue("merchant_oid"))
	status := validate.PayTRCallbackStatus(&errs, "status", r.FormValue("status"))
	kurus, kurusOK := validate.PayTRTotalAmountKurus(&errs, "total_amount", r.FormValue("total_amount"))
	requireHash := !h.payment.PayTR().IsMock()
	validate.PayTRCallbackHash(&errs, "hash", r.FormValue("hash"), requireHash)
	if errs.Has() {
		http.Error(w, "validation failed", http.StatusBadRequest)
		return
	}

	payload := paysvc.CallbackPayload{
		MerchantOID:  merchantOID,
		Status:       status,
		TotalAmount:  strings.TrimSpace(r.FormValue("total_amount")),
		Hash:         strings.TrimSpace(r.FormValue("hash")),
		FailedReason: strings.TrimSpace(r.FormValue("failed_reason_msg")),
		Raw:          raw,
	}
	if err := h.payment.PayTR().VerifyCallback(payload); err != nil {
		http.Error(w, "hash failed", http.StatusBadRequest)
		return
	}

	order, err := h.payment.Store().FindOrderByMerchantOID(r.Context(), payload.MerchantOID)
	if err != nil {
		// Still OK so PAYTR stops retrying unknown oids carefully — prefer 200 OK with log
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}
	if order.Status == domain.OrderPaid {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	// Amount tamper check — never mark paid on mismatch.
	if kurusOK && !validate.AmountMatchesKurus(order.Amount, kurus) {
		if payRec, e2 := h.payment.Store().FindPendingPaymentByOrder(r.Context(), order.ID); e2 == nil && payRec != nil {
			_ = h.payment.Store().MarkOrderFailed(r.Context(), order.ID, payRec.ID, "amount_mismatch", raw)
		} else {
			_, _ = h.db.Pool.Exec(r.Context(), `
				UPDATE orders SET status = 'failed', updated_at = now()
				WHERE id = $1 AND status <> 'paid'
			`, order.ID)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	payRec, err := h.payment.Store().FindPendingPaymentByOrder(r.Context(), order.ID)
	if err != nil {
		// maybe already paid on payment side
		if paid, e2 := h.payment.Store().FindPaidByApplication(r.Context(), order.ApplicationID); e2 == nil && paid != nil {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("OK"))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	if status == "success" {
		txID := payload.MerchantOID
		_ = h.payment.Store().MarkOrderPaid(r.Context(), order.ID, payRec.ID, txID, raw)
		_ = h.app.UpdatePaymentCompleted(r.Context(), order.ApplicationID, order.UserID)

		var email, firstName, lastName, phone, phoneCC string
		var appNumber *string
		_ = h.db.Pool.QueryRow(r.Context(), `
			SELECT u.email, u.first_name, u.last_name, COALESCE(u.phone_number,''),
			       COALESCE(u.phone_country_code, '+90'), a.application_number
			FROM users u
			JOIN applications a ON a.owner_user_id = u.id
			WHERE a.id = $1 AND u.id = $2
		`, order.ApplicationID, order.UserID).Scan(&email, &firstName, &lastName, &phone, &phoneCC, &appNumber)
		displayNo := order.ApplicationID.String()
		if appNumber != nil && *appNumber != "" {
			displayNo = *appNumber
		}
		appIDCopy := order.ApplicationID
		h.notify.SendPaymentConfirmationFull(r.Context(), order.UserID, email, phoneCC, phone, displayNo, order.Amount, &appIDCopy)
		h.notify.NotifyDoctorNewPaidApplication(r.Context(), order.ApplicationID, displayNo, order.Amount)

		// Async e-invoice + email
		go h.issueInvoiceAsync(*order, payRec, displayNo, strings.TrimSpace(firstName+" "+lastName), email, phone)
	} else {
		reason := payload.FailedReason
		if reason == "" {
			reason = "payment_failed"
		}
		_ = h.payment.Store().MarkOrderFailed(r.Context(), order.ID, payRec.ID, reason, raw)
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

// SimulatePayTRMock completes payment in PAYTR_MODE=mock (local/dev only).
func (h *ApplicationHandler) SimulatePayTRMock(w http.ResponseWriter, r *http.Request) {
	if !h.payment.PayTR().IsMock() {
		response.Fail(w, http.StatusForbidden, "APP115", "Simülasyon yalnızca PAYTR mock modunda kullanılabilir.")
		return
	}
	claims := authmw.ClaimsFromContext(r.Context())
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}

	body, _ := io.ReadAll(r.Body)
	var req struct {
		MerchantOID string `json:"merchantOid"`
	}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			response.Fail(w, http.StatusBadRequest, "VAL003", "Geçersiz JSON gövdesi.")
			return
		}
	}
	var errs validate.Errors
	req.MerchantOID = validate.MerchantOID(&errs, "merchantOid", req.MerchantOID)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	order, err := h.payment.Store().FindOrderByMerchantOID(r.Context(), req.MerchantOID)
	if order == nil || err != nil {
		response.Fail(w, http.StatusBadRequest, "APP116", "Geçerli merchantOid gerekli.")
		return
	}
	if order.ApplicationID != appID || order.UserID != claims.UserID {
		response.Fail(w, http.StatusForbidden, "APP117", "Bu sipariş size ait değil.")
		return
	}

	payRec, err := h.payment.Store().FindPendingPaymentByOrder(r.Context(), order.ID)
	if err != nil {
		if existing, e2 := h.payment.Store().FindPaidByApplication(r.Context(), appID); e2 == nil && existing != nil {
			receipt := h.buildPaymentReceipt(r.Context(), existing.ID, appID)
			response.OK(w, paymentResultPayload(&paysvc.CheckoutResult{
				Status: "paid", PaymentID: existing.ID.String(), OrderID: appID.String(),
			}, receipt))
			return
		}
		response.Fail(w, http.StatusConflict, "APP118", "Bekleyen ödeme bulunamadı.")
		return
	}

	raw := map[string]string{"status": "success", "merchant_oid": order.MerchantOID, "mock": "1"}
	_ = h.payment.Store().MarkOrderPaid(r.Context(), order.ID, payRec.ID, order.MerchantOID, raw)
	_ = h.app.UpdatePaymentCompleted(r.Context(), appID, claims.UserID)

	var email, firstName, lastName, phone, phoneCC string
	var appNumber *string
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT email, first_name, last_name, COALESCE(phone_number,''), COALESCE(phone_country_code, '+90'),
		       (SELECT application_number FROM applications WHERE id = $2)
		FROM users WHERE id = $1
	`, claims.UserID, appID).Scan(&email, &firstName, &lastName, &phone, &phoneCC, &appNumber)
	displayNo := appID.String()
	if appNumber != nil && *appNumber != "" {
		displayNo = *appNumber
	}
	appIDCopy := appID
	h.notify.SendPaymentConfirmationFull(r.Context(), claims.UserID, email, phoneCC, phone, displayNo, order.Amount, &appIDCopy)
	h.notify.NotifyDoctorNewPaidApplication(r.Context(), appID, displayNo, order.Amount)
	go h.issueInvoiceAsync(*order, payRec, displayNo, strings.TrimSpace(firstName+" "+lastName), email, phone)

	receipt := h.buildPaymentReceipt(r.Context(), payRec.ID, appID)
	response.OK(w, paymentResultPayload(&paysvc.CheckoutResult{
		TransactionID: order.MerchantOID,
		OrderID:       order.ID.String(),
		Status:        "paid",
		PaymentID:     payRec.ID.String(),
		MerchantOID:   order.MerchantOID,
		Mock:          true,
	}, receipt))
}

func (h *ApplicationHandler) issueInvoiceAsync(order paysvc.OrderRecord, pay *paysvc.PaymentRecord, displayNo, customerName, email, phone string) {
	if h.invoice == nil || pay == nil {
		return
	}
	ctx := rContextBackground()
	inv, invErr := h.invoice.Create(ctx, invoicesvc.CreateRequest{
		OrderID:           order.ID.String(),
		PaymentID:         pay.ID.String(),
		ApplicationID:     order.ApplicationID.String(),
		ApplicationNumber: displayNo,
		Amount:            order.Amount,
		Currency:          order.Currency,
		CustomerName:      customerName,
		CustomerEmail:     email,
		CustomerPhone:     phone,
		TransactionID:     order.MerchantOID,
		Description:       "Tıbbi danışmanlık başvuru ücreti",
	})
	status := domain.InvoiceIssued
	extID, invNo, pdf := "", "", ""
	raw := map[string]interface{}{}
	errMsg := ""
	if invErr != nil {
		status = domain.InvoiceFailed
		errMsg = invErr.Error()
	} else if inv != nil {
		extID = inv.InvoiceID
		invNo = inv.InvoiceNumber
		pdf = inv.PDFURL
		if inv.Raw != nil {
			raw = inv.Raw
		}
		status = inv.Status
		if status == "" {
			status = domain.InvoiceIssued
		}
	}
	pid := pay.ID
	_, _ = h.payment.Store().CreateInvoice(ctx, paysvc.InvoiceRecord{
		OrderID:       order.ID,
		PaymentID:     &pid,
		ApplicationID: order.ApplicationID,
		UserID:        order.UserID,
		Provider:      h.invoice.ProviderName(),
		ExternalID:    extID,
		InvoiceNumber: invNo,
		Status:        status,
		PDFURL:        pdf,
		Amount:        order.Amount,
		Currency:      order.Currency,
	}, raw, errMsg)

	if status == domain.InvoiceIssued && email != "" {
		body := "Faturanız oluşturuldu.\n\nBaşvuru no: " + displayNo + "\nFatura no: " + invNo
		if pdf != "" {
			body += "\nPDF: " + pdf
		}
		_ = h.notify.SendEmail(ctx, email, "Fatura bilgilendirmesi", "invoice_issued", body, &order.UserID)
	}
}

func rContextBackground() context.Context {
	return context.Background()
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

// keep unused import guard if uuid needed elsewhere in file — used above
var _ = uuid.Nil
