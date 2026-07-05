package payment

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"medical-consultation-platform/backend/internal/repository"
)

type PaymentRecord struct {
	ID                    uuid.UUID
	ApplicationID         uuid.UUID
	UserID                uuid.UUID
	Provider              string
	ProviderTransactionID string
	Amount                float64
	Currency              string
	Status                string
	IdempotencyKey        string
}

type Store struct {
	db *repository.DB
}

func NewStore(db *repository.DB) *Store {
	return &Store{db: db}
}

func (s *Store) FindPaidByApplication(ctx context.Context, appID uuid.UUID) (*PaymentRecord, error) {
	var rec PaymentRecord
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, application_id, user_id, provider::text, COALESCE(provider_transaction_id,''),
		       amount, currency, status::text, idempotency_key
		FROM payments
		WHERE application_id = $1 AND status = 'paid'
		ORDER BY created_at DESC LIMIT 1
	`, appID).Scan(&rec.ID, &rec.ApplicationID, &rec.UserID, &rec.Provider,
		&rec.ProviderTransactionID, &rec.Amount, &rec.Currency, &rec.Status, &rec.IdempotencyKey)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (s *Store) FindByID(ctx context.Context, id uuid.UUID) (*PaymentRecord, error) {
	var rec PaymentRecord
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, application_id, user_id, provider::text, COALESCE(provider_transaction_id,''),
		       amount, currency, status::text, idempotency_key
		FROM payments WHERE id = $1
	`, id).Scan(&rec.ID, &rec.ApplicationID, &rec.UserID, &rec.Provider,
		&rec.ProviderTransactionID, &rec.Amount, &rec.Currency, &rec.Status, &rec.IdempotencyKey)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (s *Store) CreatePending(ctx context.Context, rec PaymentRecord, metadata map[string]interface{}) (uuid.UUID, error) {
	meta, _ := json.Marshal(metadata)
	var id uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO payments (application_id, user_id, provider, amount, currency, status, idempotency_key, metadata)
		VALUES ($1,$2,$3::payment_provider,$4,$5,'pending',$6,$7)
		ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
		RETURNING id
	`, rec.ApplicationID, rec.UserID, rec.Provider, rec.Amount, rec.Currency, rec.IdempotencyKey, meta).Scan(&id)
	return id, err
}

func (s *Store) MarkPaid(ctx context.Context, paymentID uuid.UUID, transactionID string, metadata map[string]interface{}) error {
	meta, _ := json.Marshal(metadata)
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE payments SET status = 'paid', provider_transaction_id = $2, paid_at = $3,
			metadata = metadata || $4::jsonb, updated_at = now()
		WHERE id = $1
	`, paymentID, transactionID, time.Now(), meta)
	return err
}

func (s *Store) MarkFailed(ctx context.Context, paymentID uuid.UUID, reason string) error {
	meta, _ := json.Marshal(map[string]string{"error": reason})
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE payments SET status = 'failed', metadata = metadata || $2::jsonb, updated_at = now()
		WHERE id = $1
	`, paymentID, meta)
	return err
}

func (s *Store) MarkRefundFailed(ctx context.Context, refundID uuid.UUID, _ string) error {
	_, err := s.db.Pool.Exec(ctx, `UPDATE refunds SET status = 'failed' WHERE id = $1`, refundID)
	return err
}

func (s *Store) CompleteRefund(ctx context.Context, refundID uuid.UUID, providerRefundID string, paymentID uuid.UUID) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE refunds SET status = 'refunded', provider_refund_id = $2, processed_at = $3
		WHERE id = $1
	`, refundID, providerRefundID, time.Now())
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE payments SET status = 'refunded', updated_at = now() WHERE id = $1`, paymentID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func IsNotFound(err error) bool {
	return err == pgx.ErrNoRows
}

func NormalizeProvider(name string) string {
	switch name {
	case "bizimhesap", "bizim_hesap":
		return "bizim_hesap"
	default:
		return "param"
	}
}

func ProviderDBValue(name string) string {
	if name == "bizim_hesap" {
		return "bizim_hesap"
	}
	return "param"
}
