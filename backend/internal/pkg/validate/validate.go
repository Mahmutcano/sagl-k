// Package validate provides field-level request validation with Turkish messages.
// Every rule returns a human-readable explanation so clients can show precise feedback.
package validate

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/pkg/response"
)

const (
	MaxBodyBytes       = 1 << 20 // 1 MiB
	MaxNoteLength      = 2000
	MaxNameLength      = 80
	MaxPasswordLength  = 128
	MinPasswordLength  = 8
	MaxSurveyJSONBytes = 512 << 10 // 512 KiB
	MaxPageSize        = 100
)

var (
	phoneTR     = regexp.MustCompile(`^5\d{9}$`)
	phoneE164   = regexp.MustCompile(`^\+?[1-9]\d{7,14}$`)
	digitsOnly  = regexp.MustCompile(`^\d+$`)
	otpCode     = regexp.MustCompile(`^\d{4,8}$`)
	profession  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)
	hospitalCode = regexp.MustCompile(`^[A-Za-z0-9_-]{2,32}$`)
)

// FieldError describes a single invalid field with an explanatory message.
type FieldError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Errors is a collection of field errors.
type Errors []FieldError

func (e Errors) Error() string {
	if len(e) == 0 {
		return "validation failed"
	}
	parts := make([]string, 0, len(e))
	for _, fe := range e {
		parts = append(parts, fe.Field+": "+fe.Message)
	}
	return strings.Join(parts, "; ")
}

func (e Errors) Has() bool { return len(e) > 0 }

func (e *Errors) Add(field, code, message string) {
	*e = append(*e, FieldError{Field: field, Code: code, Message: message})
}

// Fail writes a structured validation error response.
func Fail(w http.ResponseWriter, errs Errors) {
	response.FailWithDetails(w, http.StatusUnprocessableEntity, "VAL001", "Doğrulama hatası", map[string]interface{}{
		"fields": errs,
	})
}

// DecodeJSON reads and limits the request body, then unmarshals into dest.
// An empty body is allowed (dest stays at zero values).
func DecodeJSON(w http.ResponseWriter, r *http.Request, dest interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dest); err != nil {
		if errors.Is(err, io.EOF) {
			return true
		}
		if strings.Contains(err.Error(), "http: request body too large") {
			response.Fail(w, http.StatusRequestEntityTooLarge, "VAL002", "İstek gövdesi çok büyük (en fazla 1 MB).")
			return false
		}
		response.Fail(w, http.StatusBadRequest, "VAL003", "Geçersiz JSON gövdesi. Lütfen alan adlarını ve tipleri kontrol edin.")
		return false
	}
	return true
}

// --- Field validators ---

func Required(errs *Errors, field, value, label string) {
	if strings.TrimSpace(value) == "" {
		errs.Add(field, "required", fmt.Sprintf("%s zorunludur.", label))
	}
}

func NationalID(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "TC Kimlik Numarası zorunludur.")
		return
	}
	if !digitsOnly.MatchString(value) || len(value) != 11 {
		errs.Add(field, "format", "TC Kimlik Numarası 11 haneli rakamlardan oluşmalıdır.")
		return
	}
	if value[0] == '0' {
		errs.Add(field, "format", "TC Kimlik Numarası 0 ile başlayamaz.")
		return
	}
	if !isValidTCKN(value) {
		errs.Add(field, "checksum", "TC Kimlik Numarası algoritma kontrolünden geçemedi. Lütfen numarayı kontrol edin.")
	}
}

func isValidTCKN(s string) bool {
	digits := make([]int, 11)
	for i := 0; i < 11; i++ {
		digits[i] = int(s[i] - '0')
	}
	odd := digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
	even := digits[1] + digits[3] + digits[5] + digits[7]
	d10 := ((odd * 7) - even) % 10
	if d10 < 0 {
		d10 += 10
	}
	if d10 != digits[9] {
		return false
	}
	sum := 0
	for i := 0; i < 10; i++ {
		sum += digits[i]
	}
	return sum%10 == digits[10]
}

func Password(errs *Errors, field, value string) {
	if value == "" {
		errs.Add(field, "required", "Şifre zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < MinPasswordLength {
		errs.Add(field, "min_length", fmt.Sprintf("Şifre en az %d karakter olmalıdır.", MinPasswordLength))
		return
	}
	if utf8.RuneCountInString(value) > MaxPasswordLength {
		errs.Add(field, "max_length", fmt.Sprintf("Şifre en fazla %d karakter olabilir.", MaxPasswordLength))
		return
	}
	var hasUpper, hasLower, hasDigit bool
	for _, r := range value {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasUpper || !hasLower || !hasDigit {
		errs.Add(field, "complexity", "Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.")
	}
}

func Email(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "E-posta adresi zorunludur.")
		return
	}
	if len(value) > 254 {
		errs.Add(field, "max_length", "E-posta adresi en fazla 254 karakter olabilir.")
		return
	}
	addr, err := mail.ParseAddress(value)
	if err != nil || addr.Address != value {
		errs.Add(field, "format", "Geçerli bir e-posta adresi girin (ör. ad@ornek.com).")
	}
}

func PhoneTR(errs *Errors, field, value string) {
	value = strings.TrimSpace(strings.TrimPrefix(value, "+90"))
	value = strings.TrimPrefix(value, "90")
	value = strings.TrimPrefix(value, "0")
	value = strings.ReplaceAll(value, " ", "")
	if value == "" {
		errs.Add(field, "required", "Telefon numarası zorunludur.")
		return
	}
	if !phoneTR.MatchString(value) {
		errs.Add(field, "format", "Telefon numarası 5XX XXX XX XX formatında 10 haneli olmalıdır (başında 0 olmadan).")
	}
}

func PhoneOptionalE164(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	if !phoneE164.MatchString(value) && !phoneTR.MatchString(strings.TrimPrefix(strings.TrimPrefix(value, "+90"), "0")) {
		errs.Add(field, "format", "Telefon numarası geçersiz.")
	}
}

func PersonName(errs *Errors, field, value, label string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", fmt.Sprintf("%s zorunludur.", label))
		return
	}
	n := utf8.RuneCountInString(value)
	if n < 2 {
		errs.Add(field, "min_length", fmt.Sprintf("%s en az 2 karakter olmalıdır.", label))
		return
	}
	if n > MaxNameLength {
		errs.Add(field, "max_length", fmt.Sprintf("%s en fazla %d karakter olabilir.", label, MaxNameLength))
		return
	}
	for _, r := range value {
		if unicode.IsLetter(r) || r == ' ' || r == '-' || r == '\'' {
			continue
		}
		errs.Add(field, "format", fmt.Sprintf("%s yalnızca harf, boşluk, tire veya kesme işareti içerebilir.", label))
		return
	}
}

func DateOfBirth(errs *Errors, field, value string) {
	BirthDate(errs, field, value, 18, "Kayıt için en az 18 yaşında olmalısınız.")
}

// BirthDate validates a calendar date. minAge < 0 skips age floor (yakın hasta için).
func BirthDate(errs *Errors, field, value string, minAge int, minAgeMsg string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Doğum tarihi zorunludur.")
		return
	}
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		errs.Add(field, "format", "Doğum tarihi YYYY-MM-DD formatında olmalıdır.")
		return
	}
	now := time.Now()
	if t.After(now) {
		errs.Add(field, "range", "Doğum tarihi gelecekte olamaz.")
		return
	}
	age := now.Year() - t.Year()
	if now.YearDay() < t.YearDay() {
		age--
	}
	if minAge >= 0 && age < minAge {
		if minAgeMsg == "" {
			minAgeMsg = fmt.Sprintf("En az %d yaşında olmalıdır.", minAge)
		}
		errs.Add(field, "range", minAgeMsg)
	}
	if age > 120 {
		errs.Add(field, "range", "Doğum tarihi geçersiz görünüyor.")
	}
}

func Gender(errs *Errors, field string, value int) {
	if value != 1 && value != 2 {
		errs.Add(field, "enum", "Cinsiyet 1 (Erkek) veya 2 (Kadın) olmalıdır.")
	}
}

func MatchGenderTCKN(errs *Errors, idField, genderField, tckn string, gender int) {
	tckn = strings.TrimSpace(tckn)
	if len(tckn) != 11 {
		return
	}
	digit10 := int(tckn[9] - '0')
	isMale := digit10%2 != 0
	if isMale && gender != 1 {
		errs.Add(genderField, "mismatch", "T.C. Kimlik Numarası (10. hanesi tek) Erkek cinsiyeti ile eşleşmelidir.")
	} else if !isMale && gender != 2 {
		errs.Add(genderField, "mismatch", "T.C. Kimlik Numarası (10. hanesi çift) Kadın cinsiyeti ile eşleşmelidir.")
	}
}

func OTP(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Doğrulama kodu zorunludur.")
		return
	}
	if !otpCode.MatchString(value) {
		errs.Add(field, "format", "Doğrulama kodu 4–8 haneli rakamlardan oluşmalıdır.")
	}
}

func UUID(errs *Errors, field, value, label string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", fmt.Sprintf("%s zorunludur.", label))
		return
	}
	if _, err := uuid.Parse(value); err != nil {
		errs.Add(field, "format", fmt.Sprintf("%s geçerli bir kimlik (UUID) olmalıdır.", label))
	}
}

func ProfessionCode(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Branş kodu zorunludur.")
		return
	}
	if !profession.MatchString(value) {
		errs.Add(field, "format", "Branş kodu geçersiz karakterler içeriyor.")
	}
}

func TargetInstitution(errs *Errors, field string, value int) {
	if value < 1 || value > 99 {
		errs.Add(field, "range", "Hedef kurum kodu 1–99 arasında olmalıdır.")
	}
}

func SurveyData(errs *Errors, field, data string) {
	if data == "" {
		return
	}
	if len(data) > MaxSurveyJSONBytes {
		errs.Add(field, "max_length", "Anket verisi çok büyük (en fazla 512 KB).")
		return
	}
	if !json.Valid([]byte(data)) {
		errs.Add(field, "format", "Anket verisi geçerli JSON olmalıdır.")
	}
}

// ReportJSON validates başvuru / doktor raporu gövdesi (JSON; base64 değil).
func ReportJSON(errs *Errors, field, data string) {
	if strings.TrimSpace(data) == "" {
		errs.Add(field, "required", "Rapor verisi zorunludur.")
		return
	}
	if len(data) > MaxSurveyJSONBytes {
		errs.Add(field, "max_length", "Rapor verisi çok büyük (en fazla 512 KB).")
		return
	}
	if !json.Valid([]byte(data)) {
		errs.Add(field, "format", "Rapor verisi geçerli JSON olmalıdır (base64 kabul edilmez).")
	}
}

// PDFData is deprecated alias; reports are JSON.
func PDFData(errs *Errors, field, data string) {
	ReportJSON(errs, field, data)
}

func NoteContent(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Not içeriği zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) > MaxNoteLength {
		errs.Add(field, "max_length", fmt.Sprintf("Not en fazla %d karakter olabilir.", MaxNoteLength))
	}
}

func Paging(errs *Errors, page, pageSize int) (int, int) {
	if page < 0 {
		errs.Add("page", "range", "Sayfa numarası 0 veya pozitif olmalıdır.")
		page = 0
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > MaxPageSize {
		errs.Add("pageSize", "range", fmt.Sprintf("Sayfa boyutu en fazla %d olabilir.", MaxPageSize))
		pageSize = MaxPageSize
	}
	return page, pageSize
}

func HospitalCode(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Hastane kodu zorunludur.")
		return
	}
	if !hospitalCode.MatchString(value) {
		errs.Add(field, "format", "Hastane kodu 2–32 karakter, harf/rakam/tire/alt çizgi olmalıdır.")
	}
}

func HospitalName(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Hastane adı zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < 2 || utf8.RuneCountInString(value) > 200 {
		errs.Add(field, "length", "Hastane adı 2–200 karakter arasında olmalıdır.")
	}
}

func RefundAmount(errs *Errors, field string, amount float64) {
	if amount <= 0 {
		errs.Add(field, "range", "İade tutarı 0'dan büyük olmalıdır.")
	}
	if amount > 1_000_000 {
		errs.Add(field, "range", "İade tutarı üst sınırı aşıyor.")
	}
}

func RefundReason(errs *Errors, field, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "İade nedeni zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < 5 {
		errs.Add(field, "min_length", "İade nedeni en az 5 karakter olmalıdır.")
	}
	if utf8.RuneCountInString(value) > 500 {
		errs.Add(field, "max_length", "İade nedeni en fazla 500 karakter olabilir.")
	}
}

func RejectionReason(errs *Errors, field, value string, isApproved bool) {
	if isApproved {
		return
	}
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", "Red nedeni zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < 5 {
		errs.Add(field, "min_length", "Red nedeni en az 5 karakter olmalıdır.")
	}
}

// NormalizePhoneTR strips country/leading zero prefixes for storage.
func NormalizePhoneTR(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "+90")
	value = strings.TrimPrefix(value, "90")
	value = strings.TrimPrefix(value, "0")
	return strings.ReplaceAll(value, " ", "")
}
