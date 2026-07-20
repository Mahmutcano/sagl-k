package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL            string
	APIPort                string
	JWTSecret              string
	JWTAccessTTL           time.Duration
	JWTRefreshTTL          time.Duration
	OTPTTL                 time.Duration
	PortalURL              string
	DoctorURL              string
	AdminURL               string
	CORSOrigins            []string
	SMS                    SMSConfig
	Email                  EmailConfig
	PayTR                  PayTRConfig
	Parasut                ParasutConfig
	PACSBaseURL            string
	Erciyes                ErciyesConfig
	PaymentAmount          float64
	DefaultPaymentProvider string
	UploadDir              string
	ContactInboxEmail      string
}

// ErciyesConfig connects to Erciyes University Hospital HIS web services.
type ErciyesConfig struct {
	Mode              string // mock | live
	BaseURL           string
	Username          string
	Password          string
	APIKey            string
	Protocol          string // json | soap
	PatientPath       string
	SOAPAction        string
	SOAPNamespace     string
	Timeout           time.Duration
	TargetInstitution int
}

type SMSConfig struct {
	Provider   string // mock | verimor | netgsm (legacy)
	Username   string
	Password   string
	Header     string // NetGSM header / Verimor source_addr fallback
	VerimorURL string
}

type EmailConfig struct {
	Provider          string // mock | mailersend | smtp (legacy)
	Host              string
	Port              string
	User              string
	Password          string
	From              string
	MailerSendAPIKey  string
	MailerSendFrom    string
	MailerSendFromName string
}

type PayTRConfig struct {
	MerchantID   string
	MerchantKey  string
	MerchantSalt string
	Mode         string // mock | test | live
	APIURL       string
	CallbackURL  string
	OKURL        string // optional template override
	FailURL      string
}

type ParasutConfig struct {
	ClientID     string
	ClientSecret string
	CompanyID    string
	Username     string
	Password     string
	Mode         string // mock | test | live
	APIURL       string
}

func Load() Config {
	smsUser := firstNonEmpty(os.Getenv("VERIMOR_USERNAME"), os.Getenv("SMS_USERNAME"))
	smsPass := firstNonEmpty(os.Getenv("VERIMOR_PASSWORD"), os.Getenv("SMS_PASSWORD"))
	smsHeader := firstNonEmpty(os.Getenv("VERIMOR_SOURCE_ADDR"), os.Getenv("SMS_HEADER"))

	mailFrom := firstNonEmpty(os.Getenv("MAILERSEND_FROM_EMAIL"), os.Getenv("SMTP_FROM"), "noreply@example.com")

	return Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://mcp:mcp_secret@localhost:5432/medical_consultation?sslmode=disable"),
		APIPort:       getEnv("PORT", getEnv("API_PORT", "8080")),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-in-production-min-32-chars"),
		JWTAccessTTL:  parseDuration(getEnv("JWT_ACCESS_TTL", "24h"), 24*time.Hour),
		JWTRefreshTTL: parseDuration(getEnv("JWT_REFRESH_TTL", "720h"), 720*time.Hour),
		OTPTTL:        parseDuration(getEnv("OTP_TTL", "10m"), 10*time.Minute),
		PortalURL:     getEnv("PORTAL_URL", "http://localhost:3000"),
		DoctorURL:     getEnv("DOCTOR_URL", "http://localhost:3000"),
		AdminURL:      getEnv("ADMIN_URL", "http://localhost:3000"),
		CORSOrigins:   parseCSV(getEnv("CORS_ALLOWED_ORIGINS", "")),
		SMS: SMSConfig{
			Provider:   getEnv("SMS_PROVIDER", "mock"),
			Username:   smsUser,
			Password:   smsPass,
			Header:     smsHeader,
			VerimorURL: getEnv("VERIMOR_API_URL", "https://sms.verimor.com.tr/v2/send.json"),
		},
		Email: EmailConfig{
			Provider:           getEnv("EMAIL_PROVIDER", "mock"),
			Host:               os.Getenv("SMTP_HOST"),
			Port:               getEnv("SMTP_PORT", "587"),
			User:               os.Getenv("SMTP_USER"),
			Password:           os.Getenv("SMTP_PASSWORD"),
			From:               mailFrom,
			MailerSendAPIKey:   os.Getenv("MAILERSEND_API_KEY"),
			MailerSendFrom:     mailFrom,
			MailerSendFromName: getEnv("MAILERSEND_FROM_NAME", "Erciyes Tibbi Danismanlik"),
		},
		PayTR: PayTRConfig{
			MerchantID:   os.Getenv("PAYTR_MERCHANT_ID"),
			MerchantKey:  os.Getenv("PAYTR_MERCHANT_KEY"),
			MerchantSalt: os.Getenv("PAYTR_MERCHANT_SALT"),
			Mode:         getEnv("PAYTR_MODE", "mock"),
			APIURL:       getEnv("PAYTR_API_URL", "https://www.paytr.com/odeme/api/get-token"),
			CallbackURL:  os.Getenv("PAYTR_CALLBACK_URL"),
			OKURL:        os.Getenv("PAYTR_OK_URL"),
			FailURL:      os.Getenv("PAYTR_FAIL_URL"),
		},
		Parasut: ParasutConfig{
			ClientID:     os.Getenv("PARASUT_CLIENT_ID"),
			ClientSecret: os.Getenv("PARASUT_CLIENT_SECRET"),
			CompanyID:    os.Getenv("PARASUT_COMPANY_ID"),
			Username:     os.Getenv("PARASUT_USERNAME"),
			Password:     os.Getenv("PARASUT_PASSWORD"),
			Mode:         getEnv("PARASUT_MODE", "mock"),
			APIURL:       getEnv("PARASUT_API_URL", "https://api.parasut.com"),
		},
		PACSBaseURL:            getEnv("PACS_BASE_URL", "https://pacs.example.com"),
		PaymentAmount:          getEnvFloat("PAYMENT_AMOUNT", 1500),
		DefaultPaymentProvider: getEnv("DEFAULT_PAYMENT_PROVIDER", "paytr"),
		UploadDir:              getEnv("UPLOAD_DIR", "./uploads"),
		ContactInboxEmail:      getEnv("CONTACT_INBOX_EMAIL", mailFrom),
		Erciyes: ErciyesConfig{
			Mode:              getEnv("ERCIYES_MODE", "mock"),
			BaseURL:           os.Getenv("ERCIYES_BASE_URL"),
			Username:          os.Getenv("ERCIYES_USERNAME"),
			Password:          os.Getenv("ERCIYES_PASSWORD"),
			APIKey:            os.Getenv("ERCIYES_API_KEY"),
			Protocol:          getEnv("ERCIYES_PROTOCOL", "json"),
			PatientPath:       getEnv("ERCIYES_PATIENT_PATH", "/api/hasta/sorgula"),
			SOAPAction:        os.Getenv("ERCIYES_SOAP_ACTION"),
			SOAPNamespace:     getEnv("ERCIYES_SOAP_NAMESPACE", "http://erciyes.edu.tr/his"),
			Timeout:           parseDuration(getEnv("ERCIYES_TIMEOUT", "10s"), 10*time.Second),
			TargetInstitution: getEnvInt("ERCIYES_TARGET_INSTITUTION", 1),
		},
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func getEnvFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return d
}

func parseCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
