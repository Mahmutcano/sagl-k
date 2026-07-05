package validate

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	MinPaymentAmount = 1.0
	MaxPaymentAmount = 1_000_000.0
)

func PaymentProvider(errs *Errors, field, value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "", "param":
		return "param"
	case "bizimhesap", "bizim_hesap":
		return "bizim_hesap"
	default:
		errs.Add(field, "enum", "Ödeme sağlayıcısı param veya bizimhesap olmalıdır.")
		return value
	}
}

func PaymentAmount(errs *Errors, field string, amount float64) {
	if amount < MinPaymentAmount {
		errs.Add(field, "range", fmt.Sprintf("Tutar en az %.2f TRY olmalıdır.", MinPaymentAmount))
	}
	if amount > MaxPaymentAmount {
		errs.Add(field, "range", "Tutar üst sınırı aşıyor.")
	}
}

func CardHolder(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Kart üzerindeki isim zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < 3 {
		errs.Add(field, "min_length", "Kart sahibi adı en az 3 karakter olmalıdır.")
	}
}

func CardNumber(errs *Errors, field, value string) {
	digits := onlyDigits(value)
	if len(digits) < 13 || len(digits) > 19 {
		errs.Add(field, "format", "Geçerli bir kart numarası giriniz.")
		return
	}
	if !luhnValid(digits) {
		errs.Add(field, "format", "Kart numarası geçersiz.")
	}
}

func CardCVV(errs *Errors, field, value string) {
	digits := onlyDigits(value)
	if len(digits) < 3 || len(digits) > 4 {
		errs.Add(field, "format", "CVV 3 veya 4 haneli olmalıdır.")
	}
}

func CardExpiry(errs *Errors, monthField string, month int, yearField string, year int) {
	if month < 1 || month > 12 {
		errs.Add(monthField, "format", "Son kullanma ayı 1–12 arasında olmalıdır.")
	}
	if year < 100 {
		year += 2000
	}
	if year < time.Now().Year() || (year == time.Now().Year() && month < int(time.Now().Month())) {
		errs.Add(yearField, "expired", "Kartın son kullanma tarihi geçmiş.")
	}
}

func onlyDigits(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

func luhnValid(number string) bool {
	sum := 0
	alt := false
	for i := len(number) - 1; i >= 0; i-- {
		n := int(number[i] - '0')
		if alt {
			n *= 2
			if n > 9 {
				n -= 9
			}
		}
		sum += n
		alt = !alt
	}
	return sum%10 == 0
}
