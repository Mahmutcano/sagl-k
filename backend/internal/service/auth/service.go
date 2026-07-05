package auth

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/config"
	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
	"medical-consultation-platform/backend/internal/pkg/password"
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
	var hash, role string
	var userID uuid.UUID
	var isDoctor, isNurse, isDeveloper bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, password_hash, role,
			role = 'doctor', role = 'nurse', is_developer
		FROM users WHERE national_identifier = $1 AND is_active = true
	`, req.NationalIdentifier).Scan(&userID, &hash, &role, &isDoctor, &isNurse, &isDeveloper)
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
			"isDoctor": isDoctor, "isNurse": isNurse, "isDeveloper": isDeveloper,
		},
	}, nil
}

func (s *Service) InitiateRegister(ctx context.Context, req RegisterInitRequest) error {
	hash, err := password.Hash(req.Password)
	if err != nil {
		return err
	}
	pending := map[string]interface{}{
		"hash": hash, "req": req,
	}
	raw, _ := json.Marshal(pending)
	code, err := s.notify.SendSMS(ctx, req.PhoneNumber, "register_otp", "Kayıt doğrulama", nil, nil)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO verification_tokens (phone_number, token, purpose, expires_at)
		VALUES ($1, $2, 'register', $3)
	`, req.PhoneNumber, code, time.Now().Add(10*time.Minute))
	if err != nil {
		return err
	}
	// store pending registration in token metadata via separate temp table would be better;
	// simplified: re-submit on complete with same payload
	_ = raw
	return nil
}

func (s *Service) CompleteRegister(ctx context.Context, phone, code string, req RegisterInitRequest) (*LoginResult, error) {
	var expires time.Time
	var used *time.Time
	err := s.db.Pool.QueryRow(ctx, `
		SELECT expires_at, used_at FROM verification_tokens
		WHERE phone_number = $1 AND token = $2 AND purpose = 'register'
		ORDER BY created_at DESC LIMIT 1
	`, phone, code).Scan(&expires, &used)
	if err != nil || used != nil || time.Now().After(expires) {
		return nil, errors.New("invalid or expired code")
	}
	hash, _ := password.Hash(req.Password)
	dob, _ := time.Parse("2006-01-02", req.DateOfBirth)
	var userID uuid.UUID
	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO users (email, phone_number, password_hash, first_name, last_name, national_identifier, date_of_birth, gender, nationality, is_phone_verified, role)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'patient')
		RETURNING id
	`, req.Email, phone, hash, req.FirstName, req.LastName, req.NationalIdentifier, dob, req.Gender, req.Nationality).Scan(&userID)
	if err != nil {
		return nil, err
	}
	_, _ = s.db.Pool.Exec(ctx, `UPDATE verification_tokens SET used_at = now() WHERE phone_number = $1 AND token = $2`, phone, code)
	s.notify.SendWelcomeEmail(ctx, userID, req.Email, req.FirstName)
	access, _ := s.jwt.IssueAccess(userID, "patient")
	refresh, _ := s.jwt.IssueRefresh(userID, "patient")
	return &LoginResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User: map[string]interface{}{
			"id": userID.String(), "role": "patient",
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

func (s *Service) InitiateForgotPassword(ctx context.Context, phone string) error {
	code, err := s.notify.SendSMS(ctx, phone, "forgot_password", "Şifre sıfırlama", nil, nil)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO verification_tokens (phone_number, token, purpose, expires_at)
		VALUES ($1, $2, 'forgot_password', $3)
	`, phone, code, time.Now().Add(10*time.Minute))
	return err
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
		return errors.New("invalid or expired code")
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
