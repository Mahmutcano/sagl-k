package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	appcfg "medical-consultation-platform/backend/internal/config"
)

type TokenRequest struct {
	MerchantOID   string
	Email         string
	PaymentAmount float64 // TRY major units (e.g. 1500.00)
	UserName      string
	UserAddress   string
	UserPhone     string
	UserIP        string
	UserBasket    []BasketItem
	OKURL         string
	FailURL       string
}

type BasketItem struct {
	Name     string
	Price    float64
	Quantity int
}

type TokenResult struct {
	Token     string
	IframeURL string
	Status    string // ok | mock
}

type CallbackPayload struct {
	MerchantOID  string
	Status       string
	TotalAmount  string // kuruş string
	Hash         string
	FailedReason string
	Raw          map[string]string
}

type PayTRProvider struct {
	cfg    appcfg.PayTRConfig
	client *http.Client
}

func NewPayTRProvider(cfg appcfg.PayTRConfig) *PayTRProvider {
	return &PayTRProvider{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *PayTRProvider) Name() string { return "paytr" }

func (p *PayTRProvider) IsMock() bool {
	return strings.EqualFold(p.cfg.Mode, "mock") ||
		(strings.TrimSpace(p.cfg.MerchantID) == "" && !strings.EqualFold(p.cfg.Mode, "live"))
}

func (p *PayTRProvider) GetToken(ctx context.Context, req TokenRequest) (*TokenResult, error) {
	if p.IsMock() {
		token := "mock-" + req.MerchantOID
		return &TokenResult{
			Token:     token,
			IframeURL: "",
			Status:    "mock",
		}, nil
	}
	if strings.TrimSpace(p.cfg.MerchantID) == "" || strings.TrimSpace(p.cfg.MerchantKey) == "" || strings.TrimSpace(p.cfg.MerchantSalt) == "" {
		return nil, errors.New("PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT zorunludur")
	}

	paymentAmountKurus := int(req.PaymentAmount*100 + 0.5)
	paymentAmountStr := strconv.Itoa(paymentAmountKurus)

	basketJSON, err := json.Marshal(basketToPayTR(req.UserBasket, paymentAmountKurus))
	if err != nil {
		return nil, err
	}
	userBasket := base64.StdEncoding.EncodeToString(basketJSON)

	noInstallment := "0"
	maxInstallment := "0"
	currency := "TL"
	testMode := "0"
	if strings.EqualFold(p.cfg.Mode, "test") {
		testMode = "1"
	}

	userIP := strings.TrimSpace(req.UserIP)
	if userIP == "" {
		userIP = "127.0.0.1"
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		email = "noreply@example.com"
	}
	userName := strings.TrimSpace(req.UserName)
	if userName == "" {
		userName = "Musteri"
	}
	userAddress := strings.TrimSpace(req.UserAddress)
	if userAddress == "" {
		userAddress = "Turkiye"
	}
	userPhone := digitsOnly(req.UserPhone)
	if userPhone == "" {
		userPhone = "5000000000"
	}

	hashStr := p.cfg.MerchantID + userIP + req.MerchantOID + email + paymentAmountStr + userBasket +
		noInstallment + maxInstallment + currency + testMode
	paytrToken := hmacBase64(p.cfg.MerchantKey, hashStr+p.cfg.MerchantSalt)

	form := url.Values{}
	form.Set("merchant_id", p.cfg.MerchantID)
	form.Set("user_ip", userIP)
	form.Set("merchant_oid", req.MerchantOID)
	form.Set("email", email)
	form.Set("payment_amount", paymentAmountStr)
	form.Set("paytr_token", paytrToken)
	form.Set("user_basket", userBasket)
	form.Set("debug_on", "0")
	form.Set("no_installment", noInstallment)
	form.Set("max_installment", maxInstallment)
	form.Set("user_name", userName)
	form.Set("user_address", userAddress)
	form.Set("user_phone", userPhone)
	form.Set("merchant_ok_url", req.OKURL)
	form.Set("merchant_fail_url", req.FailURL)
	form.Set("timeout_limit", "30")
	form.Set("currency", currency)
	form.Set("test_mode", testMode)
	form.Set("lang", "tr")

	apiURL := strings.TrimSpace(p.cfg.APIURL)
	if apiURL == "" {
		apiURL = "https://www.paytr.com/odeme/api/get-token"
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	var parsed struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
		Token  string `json:"token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("paytr yanıtı okunamadı: %w", err)
	}
	if !strings.EqualFold(parsed.Status, "success") || parsed.Token == "" {
		reason := parsed.Reason
		if reason == "" {
			reason = string(body)
		}
		return nil, fmt.Errorf("paytr token alınamadı: %s", reason)
	}
	return &TokenResult{
		Token:     parsed.Token,
		IframeURL: "https://www.paytr.com/odeme/guvenli/" + parsed.Token,
		Status:    "ok",
	}, nil
}

func (p *PayTRProvider) VerifyCallback(payload CallbackPayload) error {
	if strings.TrimSpace(payload.MerchantOID) == "" {
		return errors.New("merchant_oid zorunludur")
	}
	if strings.TrimSpace(payload.Status) == "" {
		return errors.New("status zorunludur")
	}
	if strings.TrimSpace(payload.TotalAmount) == "" {
		return errors.New("total_amount zorunludur")
	}
	if p.IsMock() {
		return nil
	}
	if strings.TrimSpace(payload.Hash) == "" {
		return errors.New("hash zorunludur")
	}
	expected := hmacBase64(p.cfg.MerchantKey, payload.MerchantOID+p.cfg.MerchantSalt+payload.Status+payload.TotalAmount)
	if !hmac.Equal([]byte(expected), []byte(payload.Hash)) {
		return errors.New("paytr callback hash doğrulaması başarısız")
	}
	return nil
}

func hmacBase64(key, message string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func basketToPayTR(items []BasketItem, fallbackKurus int) [][]interface{} {
	out := make([][]interface{}, 0, len(items))
	if len(items) == 0 {
		return [][]interface{}{{"Tibbi danismanlik", strconv.FormatFloat(float64(fallbackKurus)/100, 'f', 2, 64), 1}}
	}
	for _, it := range items {
		qty := it.Quantity
		if qty <= 0 {
			qty = 1
		}
		price := strconv.FormatFloat(it.Price, 'f', 2, 64)
		name := it.Name
		if name == "" {
			name = "Kalem"
		}
		out = append(out, []interface{}{name, price, qty})
	}
	return out
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Refund is not implemented via iframe API (admin may use PayTR panel).
func (p *PayTRProvider) Refund(ctx context.Context, transactionID string, amount float64, reason string) (string, error) {
	return "", errors.New("PAYTR iade bu API üzerinden desteklenmiyor; PayTR panelinden işlem yapın")
}

// PayTRTestCard is shown to patients in PAYTR test mode (iframe may auto-fill; Direct API needs these).
type PayTRTestCard struct {
	Label      string `json:"label"`
	Holder     string `json:"holder"`
	Number     string `json:"number"`
	Expiry     string `json:"expiry"`
	CVV        string `json:"cvv"`
	Note       string `json:"note,omitempty"`
}

// PayTRTestCards returns cards when mode is test; empty for mock/live.
func PayTRTestCards(mode string) []PayTRTestCard {
	if !strings.EqualFold(strings.TrimSpace(mode), "test") {
		return nil
	}
	return []PayTRTestCard{
		{Label: "Visa", Holder: "PAYTR TEST", Number: "4355 0843 5508 4358", Expiry: "12/30", CVV: "000"},
		{Label: "Mastercard", Holder: "PAYTR TEST", Number: "5406 6754 0667 5403", Expiry: "12/30", CVV: "000"},
		{Label: "Troy", Holder: "PAYTR TEST", Number: "9792 0303 9444 0796", Expiry: "12/30", CVV: "000", Note: "iframe testte kartlar otomatik de gelebilir"},
	}
}
