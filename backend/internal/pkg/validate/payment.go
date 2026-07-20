package validate

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	MinPaymentAmount = 1.0
	MaxPaymentAmount = 1_000_000.0
	MaxMerchantOID   = 64
	MinMerchantOID   = 6
)

var merchantOIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func PaymentProvider(errs *Errors, field, value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "", "paytr":
		return "paytr"
	case "param", "bizimhesap", "bizim_hesap":
		errs.Add(field, "invalid", "Ödeme yalnızca PAYTR ile yapılır.")
		return "paytr"
	default:
		errs.Add(field, "enum", "Ödeme sağlayıcısı yalnızca paytr olabilir.")
		return value
	}
}

// PaymentAmount validates major-unit TRY amounts (1.00 – 1_000_000.00, max 2 decimals).
func PaymentAmount(errs *Errors, field string, amount float64) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		errs.Add(field, "format", "Tutar sayısal olmalıdır.")
		return
	}
	if amount < MinPaymentAmount {
		errs.Add(field, "range", fmt.Sprintf("Tutar en az %.2f TRY olmalıdır.", MinPaymentAmount))
	}
	if amount > MaxPaymentAmount {
		errs.Add(field, "range", "Tutar üst sınırı aşıyor.")
	}
	// Reject more than 2 decimal places (kuruş).
	scaled := amount * 100
	if math.Abs(scaled-math.Round(scaled)) > 1e-6 {
		errs.Add(field, "format", "Tutar en fazla 2 ondalık basamak (kuruş) içerebilir.")
	}
}

// MerchantOID validates PAYTR merchant_oid (unique order key).
func MerchantOID(errs *Errors, field, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Merchant OID zorunludur.")
		return value
	}
	if utf8.RuneCountInString(value) < MinMerchantOID || utf8.RuneCountInString(value) > MaxMerchantOID {
		errs.Add(field, "length", fmt.Sprintf("Merchant OID %d–%d karakter olmalıdır.", MinMerchantOID, MaxMerchantOID))
		return value
	}
	if !merchantOIDRe.MatchString(value) {
		errs.Add(field, "format", "Merchant OID yalnızca harf, rakam, tire veya alt çizgi içerebilir.")
	}
	return value
}

// PayTRCallbackStatus accepts success / failed (PAYTR notification).
func PayTRCallbackStatus(errs *Errors, field, value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "success", "failed":
		return value
	case "":
		errs.Add(field, "required", "Ödeme durumu (status) zorunludur.")
		return value
	default:
		errs.Add(field, "enum", "Ödeme durumu success veya failed olmalıdır.")
		return value
	}
}

// PayTRTotalAmountKurus validates total_amount from PAYTR (kuruş, digits only).
func PayTRTotalAmountKurus(errs *Errors, field, value string) (int64, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Ödeme tutarı (total_amount) zorunludur.")
		return 0, false
	}
	if !digitsOnly.MatchString(value) {
		errs.Add(field, "format", "Ödeme tutarı yalnızca rakamlardan oluşmalıdır (kuruş).")
		return 0, false
	}
	n, err := strconv.ParseInt(value, 10, 64)
	if err != nil || n <= 0 {
		errs.Add(field, "range", "Ödeme tutarı 0'dan büyük olmalıdır.")
		return 0, false
	}
	maxKurus := int64(MaxPaymentAmount * 100)
	if n > maxKurus {
		errs.Add(field, "range", "Ödeme tutarı üst sınırı aşıyor.")
		return 0, false
	}
	return n, true
}

// PayTRCallbackHash requires non-empty hash for non-mock verification path.
func PayTRCallbackHash(errs *Errors, field, value string, requireHash bool) {
	value = strings.TrimSpace(value)
	if requireHash && value == "" {
		errs.Add(field, "required", "Callback hash zorunludur.")
	}
	if value != "" && utf8.RuneCountInString(value) > 256 {
		errs.Add(field, "max_length", "Callback hash çok uzun.")
	}
}

// AmountMatchesKurus checks order TRY amount equals PAYTR kuruş string (±1 kuruş).
func AmountMatchesKurus(orderAmountTRY float64, totalAmountKurus int64) bool {
	expected := int64(math.Round(orderAmountTRY * 100))
	diff := expected - totalAmountKurus
	if diff < 0 {
		diff = -diff
	}
	return diff <= 1
}

// PaymentListStatus filters admin payment list (?status=).
func PaymentListStatus(errs *Errors, field, value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	switch value {
	case "pending", "paid", "failed", "refunded":
		return value
	default:
		errs.Add(field, "enum", "Durum pending, paid, failed veya refunded olabilir.")
		return value
	}
}

// DateYYYYMMDD optional query date (admin filters).
func DateYYYYMMDD(errs *Errors, field, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) != 10 || value[4] != '-' || value[7] != '-' {
		errs.Add(field, "format", "Tarih YYYY-MM-DD formatında olmalıdır.")
		return value
	}
	for i, c := range value {
		if i == 4 || i == 7 {
			continue
		}
		if c < '0' || c > '9' {
			errs.Add(field, "format", "Tarih YYYY-MM-DD formatında olmalıdır.")
			return value
		}
	}
	return value
}

// PayTRCustomerEmail requires a usable email for token request.
func PayTRCustomerEmail(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Ödeme için hesap e-postası zorunludur.")
		return
	}
	Email(errs, field, value)
}

// PayTRCustomerPhone soft-validates phone (non-empty recommended for PAYTR).
func PayTRCustomerPhone(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Ödeme için telefon numarası zorunludur.")
		return
	}
	digits := ""
	for i := 0; i < len(value); i++ {
		if value[i] >= '0' && value[i] <= '9' {
			digits += string(value[i])
		}
	}
	if len(digits) < 10 || len(digits) > 15 {
		errs.Add(field, "format", "Geçerli bir telefon numarası giriniz.")
	}
}

// PayTRCustomerName requires payer display name.
func PayTRCustomerName(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Ödeme için ad soyad zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < 3 {
		errs.Add(field, "min_length", "Ad soyad en az 3 karakter olmalıdır.")
	}
	if utf8.RuneCountInString(value) > 120 {
		errs.Add(field, "max_length", "Ad soyad en fazla 120 karakter olabilir.")
	}
}
