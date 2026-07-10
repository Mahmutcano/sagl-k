package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL   string
	APIPort       string
	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration
	PortalURL     string
	DoctorURL     string
	AdminURL      string
	CORSOrigins   []string
	SMS           SMSConfig
	Email         EmailConfig
	Param         ParamConfig
	BizimHesap    BizimHesapConfig
	PACSBaseURL          string
	Erciyes              ErciyesConfig
	PaymentAmount        float64
	DefaultPaymentProvider string
	UploadDir            string
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
	Provider string
	Username string
	Password string
	Header   string
}

type EmailConfig struct {
	Provider string
	Host     string
	Port     string
	User     string
	Password string
	From     string
}

type ParamConfig struct {
	ClientCode     string
	ClientUsername string
	ClientPassword string
	GUID           string
	Mode           string
	APIURL         string
}

type BizimHesapConfig struct {
	APIKey  string
	FirmID  string
	Mode    string
	APIURL  string
}

func Load() Config {
	return Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://mcp:mcp_secret@localhost:5432/medical_consultation?sslmode=disable"),
		APIPort:       getEnv("PORT", getEnv("API_PORT", "8080")),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-in-production-min-32-chars"),
		JWTAccessTTL:  parseDuration(getEnv("JWT_ACCESS_TTL", "24h"), 24*time.Hour),
		JWTRefreshTTL: parseDuration(getEnv("JWT_REFRESH_TTL", "720h"), 720*time.Hour),
		PortalURL:     getEnv("PORTAL_URL", "http://localhost:3000"),
		DoctorURL:     getEnv("DOCTOR_URL", "http://localhost:3000"),
		AdminURL:      getEnv("ADMIN_URL", "http://localhost:3000"),
		CORSOrigins:   parseCSV(getEnv("CORS_ALLOWED_ORIGINS", "")),
		SMS: SMSConfig{
			Provider: getEnv("SMS_PROVIDER", "mock"),
			Username: os.Getenv("SMS_USERNAME"),
			Password: os.Getenv("SMS_PASSWORD"),
			Header:   os.Getenv("SMS_HEADER"),
		},
		Email: EmailConfig{
			Provider: getEnv("EMAIL_PROVIDER", "mock"),
			Host:     os.Getenv("SMTP_HOST"),
			Port:     getEnv("SMTP_PORT", "587"),
			User:     os.Getenv("SMTP_USER"),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     getEnv("SMTP_FROM", "noreply@example.com"),
		},
		Param: ParamConfig{
			ClientCode:     os.Getenv("PARAM_CLIENT_CODE"),
			ClientUsername: os.Getenv("PARAM_CLIENT_USERNAME"),
			ClientPassword: os.Getenv("PARAM_CLIENT_PASSWORD"),
			GUID:           os.Getenv("PARAM_GUID"),
			Mode:           getEnv("PARAM_MODE", "test"),
			APIURL:         getEnv("PARAM_API_URL", "https://posws.param.com.tr/turkpos.ws/service_turkpos_prod.asmx"),
		},
		BizimHesap: BizimHesapConfig{
			APIKey: os.Getenv("BIZIMHESAP_API_KEY"),
			FirmID: os.Getenv("BIZIMHESAP_FIRM_ID"),
			Mode:   getEnv("BIZIMHESAP_MODE", "test"),
			APIURL: getEnv("BIZIMHESAP_API_URL", "https://api.bizimhesap.com"),
		},
		PACSBaseURL:            getEnv("PACS_BASE_URL", "https://pacs.example.com"),
		PaymentAmount:          getEnvFloat("PAYMENT_AMOUNT", 1500),
		DefaultPaymentProvider: getEnv("DEFAULT_PAYMENT_PROVIDER", "param"),
		UploadDir:              getEnv("UPLOAD_DIR", "./uploads"),
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
