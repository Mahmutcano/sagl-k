package auth

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"medical-consultation-platform/backend/internal/config"
	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
	"medical-consultation-platform/backend/internal/pkg/password"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	"medical-consultation-platform/backend/internal/service/notification"
)

type Service struct {
	cfg   config.Config
	db    *repository.DB
	jwt   *jwtmgr.Manager
	notify *notification.Service
}

func NewService(cfg config.Config, db *repository.DB, jwt *jwtmgr.Manager, notify *notification.Service) *Service {
	return &Service{cfg: cfg, db: db, jwt: jwt, notify: notify}
}

type LoginRequest struct {
	NationalIdentifier string `json:"nationalIdentifier"`
	Password           string `json:"password"`
}

type LoginResult struct {
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	IsTfaNeeded  bool        `json:"isTfaNeeded"`
	User         interface{} `json:"user,omitempty"`
}

type RegisterInitRequest struct {
	FirstName          string `json:"firstName"`
	LastName           string `json:"lastName"`
	NationalIdentifier string `json:"nationalIdentifier"`
	PassportNumber     string `json:"passportNumber"`
	PhoneCountryCode   string `json:"phoneCountryCode"`
	PhoneNumber        string `json:"phoneNumber"`
	Email              string `json:"email"`
	Password           string `json:"password"`
	DateOfBirth        string `json:"dateOfBirth"`
	Gender             int    `json:"gender"`
	Nationality        string `json:"nationality"`
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*LoginResult, error) {
	if strings.TrimSpace(req.Password) == "" {
		return nil, errors.New("invalid credentials")
	}
	id := strings.TrimSpace(req.NationalIdentifier)
	var hash, role, firstName, lastName string
	var userID uuid.UUID
	var isDoctor, isNurse, isDeveloper bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, password_hash, role, first_name, last_name,
			role = 'doctor', role = 'nurse', is_developer
		FROM users
		WHERE is_active = true
		  AND (
			national_identifier = $1
			OR UPPER(COALESCE(passport_number, '')) = UPPER($1)
		  )
	`, id).Scan(&userID, &hash, &role, &firstName, &lastName, &isDoctor, &isNurse, &isDeveloper)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}
	if hash == "" || !password.Compare(hash, req.Password) {
		return nil, errors.New("invalid credentials")
	}
	access, _ := s.jwt.IssueAccess(userID, role)
	refresh, _ := s.jwt.IssueRefresh(userID, role)
	return &LoginResult{
		AccessToken:  access,
		RefreshToken: refresh,
		IsTfaNeeded:  false,
		User: map[string]interface{}{
			"id": userID.String(), "role": role,
			"firstName": firstName, "lastName": lastName,
			"isDoctor": isDoctor, "isNurse": isNurse, "isDeveloper": isDeveloper,
		},
	}, nil
}

func (s *Service) IsMock() bool {
	return s.cfg.SMS.Provider == "" || s.cfg.SMS.Provider == "mock"
}

func (s *Service) otpTTL() time.Duration {
	if s.cfg.OTPTTL > 0 {
		return s.cfg.OTPTTL
	}
	return 10 * time.Minute
}

func (s *Service) otpMinutes() int {
	m := int(s.otpTTL().Round(time.Minute) / time.Minute)
	if m < 1 {
		return 1
	}
	return m
}

type OTPChallenge struct {
	Code             string    `json:"-"`
	ExpiresInSeconds int       `json:"expiresInSeconds"`
	ExpiresAt        time.Time `json:"expiresAt"`
}

func (s *Service) newOTPChallenge() OTPChallenge {
	ttl := s.otpTTL()
	exp := time.Now().Add(ttl)
	return OTPChallenge{
		ExpiresInSeconds: int(ttl.Seconds()),
		ExpiresAt:        exp,
	}
}

// CheckRegisterUniqueness returns field errors when TC/passport, phone or email already exist.
func (s *Service) CheckRegisterUniqueness(ctx context.Context, req RegisterInitRequest) validate.Errors {
	var errs validate.Errors

	if nid := strings.TrimSpace(req.NationalIdentifier); nid != "" {
		var exists bool
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM users WHERE national_identifier = $1)
		`, nid).Scan(&exists)
		if exists {
			errs.Add("nationalIdentifier", "unique", "Bu TC Kimlik No zaten kullanılıyor. Giriş yapmayı deneyin.")
		}
	}
	if pp := strings.ToUpper(strings.TrimSpace(req.PassportNumber)); pp != "" {
		var exists bool
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM users WHERE UPPER(COALESCE(passport_number, '')) = $1)
		`, pp).Scan(&exists)
		if exists {
			errs.Add("passportNumber", "unique", "Bu pasaport numarası zaten kullanılıyor. Giriş yapmayı deneyin.")
		}
	}

	var phoneExists bool
	_ = s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM users
			WHERE phone_number = $1 AND COALESCE(phone_country_code, '+90') = $2
		)
	`, req.PhoneNumber, req.PhoneCountryCode).Scan(&phoneExists)
	if phoneExists {
		errs.Add("phoneNumber", "unique", "Bu telefon numarası zaten kullanılıyor. Giriş yapmayı deneyin.")
	}

	if email := strings.TrimSpace(req.Email); email != "" {
		var emailExists bool
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))
		`, email).Scan(&emailExists)
		if emailExists {
			errs.Add("email", "unique", "Bu e-posta adresi zaten kullanılıyor. Giriş yapmayı deneyin.")
		}
	}

	return errs
}

func (s *Service) logSMSOTP(ctx context.Context, purpose, e164, country, national, code, first, last, email, status, errMsg string, userID *uuid.UUID) {
	_, _ = s.db.Pool.Exec(ctx, `
		INSERT INTO sms_otp_logs (
			purpose, phone_e164, phone_country_code, phone_number, otp_code,
			first_name, last_name, email, user_id, status, error_message
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, purpose, e164, country, national, code, first, last, email, userID, status, nullIfEmpty(errMsg))
}

func nullIfEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func (s *Service) generatePatientNumber(ctx context.Context) (string, error) {
	year := time.Now().Year() % 100
	for i := 0; i < 12; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(900000))
		if err != nil {
			return "", err
		}
		candidate := fmt.Sprintf("HST-%02d-%06d", year, n.Int64()+100000)
		var exists bool
		_ = s.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE patient_number = $1)`, candidate).Scan(&exists)
		if !exists {
			return candidate, nil
		}
	}
	return "", errors.New("hasta numarası üretilemedi")
}

func (s *Service) InitiateRegister(ctx context.Context, req RegisterInitRequest) (OTPChallenge, error) {
	req.FirstName = validate.FormatPersonName(req.FirstName)
	req.LastName = validate.FormatPersonName(req.LastName)

	hash, err := password.Hash(req.Password)
	if err != nil {
		return OTPChallenge{}, err
	}
	pending := map[string]interface{}{
		"hash": hash, "req": req,
	}
	raw, _ := json.Marshal(pending)
	mins := s.otpMinutes()
	challenge := s.newOTPChallenge()
	smsTo := req.PhoneCountryCode + req.PhoneNumber
	if !strings.HasPrefix(smsTo, "+") {
		smsTo = "+" + smsTo
	}
	code, err := s.notify.SendSMS(
		ctx,
		smsTo,
		"register_otp",
		fmt.Sprintf("Kayıt doğrulama. Kod %d dakika geçerlidir", mins),
		nil,
		nil,
	)
	status := "sent"
	errMsg := ""
	if err != nil {
		status = "failed"
		errMsg = err.Error()
		s.logSMSOTP(ctx, "register", smsTo, req.PhoneCountryCode, req.PhoneNumber, "", req.FirstName, req.LastName, req.Email, status, errMsg, nil)
		return OTPChallenge{}, err
	}
	challenge.Code = code
	s.logSMSOTP(ctx, "register", smsTo, req.PhoneCountryCode, req.PhoneNumber, code, req.FirstName, req.LastName, req.Email, status, "", nil)

	if strings.TrimSpace(req.Email) != "" {
		emailBody := fmt.Sprintf(
			"Kayıt doğrulama kodunuz: %s\n\nBu kod %d dakika geçerlidir. Lütfen kayıt ekranına girerek işleminizi tamamlayın.",
			code, mins,
		)
		_ = s.notify.SendEmail(ctx, req.Email, "Kayıt Doğrulama Kodu", "register_otp", emailBody, nil)
	}

	emailArg := interface{}(nil)
	if e := strings.TrimSpace(req.Email); e != "" {
		emailArg = e
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO verification_tokens (phone_number, email, token, purpose, expires_at)
		VALUES ($1, $2, $3, 'register', $4)
	`, req.PhoneNumber, emailArg, code, challenge.ExpiresAt)
	if err != nil {
		return OTPChallenge{}, err
	}
	_ = raw
	return challenge, nil
}

func (s *Service) CompleteRegister(ctx context.Context, phone, code string, req RegisterInitRequest) (*LoginResult, error) {
	phone = strings.TrimSpace(phone)
	code = strings.TrimSpace(code)
	req.FirstName = validate.FormatPersonName(req.FirstName)
	req.LastName = validate.FormatPersonName(req.LastName)

	var expires time.Time
	var used *time.Time
	err := s.db.Pool.QueryRow(ctx, `
		SELECT expires_at, used_at FROM verification_tokens
		WHERE phone_number = $1 AND token = $2 AND purpose = 'register'
		ORDER BY created_at DESC LIMIT 1
	`, phone, code).Scan(&expires, &used)
	if err != nil || used != nil || time.Now().After(expires) {
		return nil, errors.New("Doğrulama kodu geçersiz veya süresi dolmuş. Yeni kod isteyin.")
	}
	hash, _ := password.Hash(req.Password)
	dob, _ := time.Parse("2006-01-02", req.DateOfBirth)

	country := strings.TrimSpace(req.PhoneCountryCode)
	if country == "" {
		country = "+90"
	}
	var nationalID *string
	var passport *string
	if nid := strings.TrimSpace(req.NationalIdentifier); nid != "" {
		nationalID = &nid
	}
	if pp := strings.ToUpper(strings.TrimSpace(req.PassportNumber)); pp != "" {
		passport = &pp
	}

	patientNo, err := s.generatePatientNumber(ctx)
	if err != nil {
		return nil, err
	}

	var emailArg interface{}
	if e := strings.TrimSpace(req.Email); e != "" {
		emailArg = e
	}

	var userID uuid.UUID
	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO users (
			email, phone_number, phone_country_code, password_hash,
			first_name, last_name, national_identifier, passport_number,
			date_of_birth, gender, nationality, patient_number, is_phone_verified, role
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,'patient')
		RETURNING id
	`, emailArg, phone, country, hash, req.FirstName, req.LastName, nationalID, passport, dob, req.Gender, req.Nationality, patientNo).Scan(&userID)
	if err != nil {
		return nil, registerInsertErr(err)
	}
	_, _ = s.db.Pool.Exec(ctx, `UPDATE verification_tokens SET used_at = now() WHERE phone_number = $1 AND token = $2`, phone, code)
	if strings.TrimSpace(req.Email) != "" {
		s.notify.SendWelcomeEmail(ctx, userID, req.Email, req.FirstName)
	}
	access, _ := s.jwt.IssueAccess(userID, "patient")
	refresh, _ := s.jwt.IssueRefresh(userID, "patient")
	return &LoginResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User: map[string]interface{}{
			"id": userID.String(), "role": "patient",
			"firstName": req.FirstName, "lastName": req.LastName,
			"patientNumber": patientNo,
			"isDoctor": false, "isNurse": false, "isDeveloper": false,
		},
	}, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*LoginResult, error) {
	claims, err := s.jwt.Parse(refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}
	var role string
	var isDoctor, isNurse, isDeveloper bool
	err = s.db.Pool.QueryRow(ctx, `
		SELECT role, role = 'doctor', role = 'nurse', is_developer
		FROM users WHERE id = $1 AND is_active = true
	`, claims.UserID).Scan(&role, &isDoctor, &isNurse, &isDeveloper)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}
	access, err := s.jwt.IssueAccess(claims.UserID, role)
	if err != nil {
		return nil, err
	}
	newRefresh, err := s.jwt.IssueRefresh(claims.UserID, role)
	if err != nil {
		return nil, err
	}
	return &LoginResult{
		AccessToken:  access,
		RefreshToken: newRefresh,
		User: map[string]interface{}{
			"id": claims.UserID.String(), "role": role,
			"isDoctor": isDoctor, "isNurse": isNurse, "isDeveloper": isDeveloper,
		},
	}, nil
}

func (s *Service) InitiateForgotPassword(ctx context.Context, phone, countryCode string) (OTPChallenge, error) {
	if countryCode == "" {
		countryCode = "+90"
	}
	var email, firstName, lastName string
	var userID uuid.UUID
	_ = s.db.Pool.QueryRow(ctx, `
		SELECT id, email, first_name, last_name FROM users
		WHERE phone_number = $1 AND COALESCE(phone_country_code, '+90') = $2 AND is_active = true
	`, phone, countryCode).Scan(&userID, &email, &firstName, &lastName)

	mins := s.otpMinutes()
	challenge := s.newOTPChallenge()
	smsTo := countryCode + phone
	code, err := s.notify.SendSMS(
		ctx,
		smsTo,
		"forgot_password",
		fmt.Sprintf("Şifre sıfırlama. Kod %d dakika geçerlidir", mins),
		nil,
		nil,
	)
	status := "sent"
	errMsg := ""
	if err != nil {
		status = "failed"
		errMsg = err.Error()
		var uid *uuid.UUID
		if userID != uuid.Nil {
			uid = &userID
		}
		s.logSMSOTP(ctx, "forgot_password", smsTo, countryCode, phone, "", firstName, lastName, email, status, errMsg, uid)
		return OTPChallenge{}, err
	}
	challenge.Code = code
	var uid *uuid.UUID
	if userID != uuid.Nil {
		uid = &userID
	}
	s.logSMSOTP(ctx, "forgot_password", smsTo, countryCode, phone, code, firstName, lastName, email, status, "", uid)

	if email != "" {
		emailBody := fmt.Sprintf(
			"Şifre sıfırlama kodunuz: %s\n\nBu kod %d dakika geçerlidir. Lütfen şifre sıfırlama ekranına girerek işleminizi tamamlayın.",
			code, mins,
		)
		_ = s.notify.SendEmail(ctx, email, "Şifre Sıfırlama Kodu", "forgot_password", emailBody, nil)
	}

	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO verification_tokens (phone_number, email, token, purpose, expires_at)
		VALUES ($1, $2, $3, 'forgot_password', $4)
	`, phone, email, code, challenge.ExpiresAt)
	if err != nil {
		return OTPChallenge{}, err
	}
	return challenge, nil
}

func (s *Service) CompleteForgotPassword(ctx context.Context, phone, code, newPassword string) error {
	var expires time.Time
	var used *time.Time
	err := s.db.Pool.QueryRow(ctx, `
		SELECT expires_at, used_at FROM verification_tokens
		WHERE phone_number = $1 AND token = $2 AND purpose = 'forgot_password'
		ORDER BY created_at DESC LIMIT 1
	`, phone, code).Scan(&expires, &used)
	if err != nil || used != nil || time.Now().After(expires) {
		return errors.New("Doğrulama kodu geçersiz veya süresi dolmuş. Yeni kod isteyin.")
	}
	hash, err := password.Hash(newPassword)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = now() WHERE phone_number = $1`, phone, hash)
	if err != nil {
		return err
	}
	_, _ = s.db.Pool.Exec(ctx, `UPDATE verification_tokens SET used_at = now() WHERE phone_number = $1 AND token = $2`, phone, code)
	return nil
}

func registerInsertErr(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		c := strings.ToLower(pgErr.ConstraintName)
		switch {
		case strings.Contains(c, "email"):
			return errors.New("Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.")
		case strings.Contains(c, "phone"):
			return errors.New("Bu telefon numarası zaten kayıtlı. Giriş yapmayı deneyin.")
		case strings.Contains(c, "national"):
			return errors.New("Bu TC Kimlik No zaten kullanılıyor. Giriş yapmayı deneyin.")
		case strings.Contains(c, "passport"):
			return errors.New("Bu pasaport numarası zaten kullanılıyor. Giriş yapmayı deneyin.")
		case strings.Contains(c, "patient_number"):
			return errors.New("Hasta numarası çakışması oluştu. Lütfen tekrar deneyin.")
		default:
			return errors.New("Bu bilgilerle zaten bir hesap var. Giriş yapmayı deneyin.")
		}
	}
	return err
}
