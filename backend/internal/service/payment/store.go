package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"medical-consultation-platform/backend/internal/domain"
	"medical-consultation-platform/backend/internal/repository"
)

type PaymentRecord struct {
	ID                    uuid.UUID
	OrderID               *uuid.UUID
	ApplicationID         uuid.UUID
	UserID                uuid.UUID
	Provider              string
	ProviderTransactionID string
	Amount                float64
	Currency              string
	Status                string
	IdempotencyKey        string
	PaytrToken            string
}

type OrderRecord struct {
	ID             uuid.UUID
	ApplicationID  uuid.UUID
	UserID         uuid.UUID
	MerchantOID    string
	Amount         float64
	Currency       string
	Status         string
	IdempotencyKey string
}

type InvoiceRecord struct {
	ID            uuid.UUID
	OrderID       uuid.UUID
	PaymentID     *uuid.UUID
	ApplicationID uuid.UUID
	UserID        uuid.UUID
	Provider      string
	ExternalID    string
	InvoiceNumber string
	Status        string
	PDFURL        string
	Amount        float64
	Currency      string
}

type Store struct {
	db *repository.DB
}

func NewStore(db *repository.DB) *Store {
	return &Store{db: db}
}

func (s *Store) FindPaidByApplication(ctx context.Context, appID uuid.UUID) (*PaymentRecord, error) {
	var rec PaymentRecord
	var orderID *uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, order_id, application_id, user_id, provider::text, COALESCE(provider_transaction_id,''),
		       amount, currency, status::text, COALESCE(idempotency_key,''), COALESCE(paytr_token,'')
		FROM payments
		WHERE application_id = $1 AND status = 'paid'
		ORDER BY created_at DESC LIMIT 1
	`, appID).Scan(&rec.ID, &orderID, &rec.ApplicationID, &rec.UserID, &rec.Provider,
		&rec.ProviderTransactionID, &rec.Amount, &rec.Currency, &rec.Status, &rec.IdempotencyKey, &rec.PaytrToken)
	if err != nil {
		return nil, err
	}
	rec.OrderID = orderID
	return &rec, nil
}

func (s *Store) FindByID(ctx context.Context, id uuid.UUID) (*PaymentRecord, error) {
	var rec PaymentRecord
	var orderID *uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, order_id, application_id, user_id, provider::text, COALESCE(provider_transaction_id,''),
		       amount, currency, status::text, COALESCE(idempotency_key,''), COALESCE(paytr_token,'')
		FROM payments WHERE id = $1
	`, id).Scan(&rec.ID, &orderID, &rec.ApplicationID, &rec.UserID, &rec.Provider,
		&rec.ProviderTransactionID, &rec.Amount, &rec.Currency, &rec.Status, &rec.IdempotencyKey, &rec.PaytrToken)
	if err != nil {
		return nil, err
	}
	rec.OrderID = orderID
	return &rec, nil
}

func (s *Store) FindOrderByMerchantOID(ctx context.Context, merchantOID string) (*OrderRecord, error) {
	var rec OrderRecord
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, application_id, user_id, merchant_oid, amount, currency, status::text, COALESCE(idempotency_key,'')
		FROM orders WHERE merchant_oid = $1
	`, merchantOID).Scan(&rec.ID, &rec.ApplicationID, &rec.UserID, &rec.MerchantOID,
		&rec.Amount, &rec.Currency, &rec.Status, &rec.IdempotencyKey)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (s *Store) FindPendingPaymentByOrder(ctx context.Context, orderID uuid.UUID) (*PaymentRecord, error) {
	var rec PaymentRecord
	var oid *uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, order_id, application_id, user_id, provider::text, COALESCE(provider_transaction_id,''),
		       amount, currency, status::text, COALESCE(idempotency_key,''), COALESCE(paytr_token,'')
		FROM payments
		WHERE order_id = $1 AND status IN ('pending')
		ORDER BY created_at DESC LIMIT 1
	`, orderID).Scan(&rec.ID, &oid, &rec.ApplicationID, &rec.UserID, &rec.Provider,
		&rec.ProviderTransactionID, &rec.Amount, &rec.Currency, &rec.Status, &rec.IdempotencyKey, &rec.PaytrToken)
	if err != nil {
		return nil, err
	}
	rec.OrderID = oid
	return &rec, nil
}

func (s *Store) CreateOrderAndPayment(ctx context.Context, order OrderRecord, paytrToken, iframeURL string, metadata map[string]interface{}) (orderID, paymentID uuid.UUID, merchantOID string, err error) {
	meta, _ := json.Marshal(metadata)
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", err
	}
	defer tx.Rollback(ctx)

	// On idempotent retry keep the existing merchant_oid so token/simulate stay aligned
	// (React Strict Mode and "Yeniden başlat" both re-hit this path).
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (application_id, user_id, merchant_oid, amount, currency, status, idempotency_key)
		VALUES ($1,$2,$3,$4,$5,'awaiting_payment'::order_status,$6)
		ON CONFLICT (idempotency_key) DO UPDATE
		  SET updated_at = now(),
		      status = CASE WHEN orders.status = 'paid' THEN orders.status ELSE 'awaiting_payment'::order_status END
		RETURNING id, status::text, merchant_oid
	`, order.ApplicationID, order.UserID, order.MerchantOID, order.Amount, order.Currency, order.IdempotencyKey).Scan(&orderID, &order.Status, &merchantOID)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", err
	}
	if order.Status == domain.OrderPaid {
		return orderID, uuid.Nil, merchantOID, fmt.Errorf("order already paid")
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO payments (application_id, user_id, order_id, provider, amount, currency, status, idempotency_key, metadata, paytr_token, paytr_iframe_url)
		VALUES ($1,$2,$3,'paytr'::payment_provider,$4,$5,'pending',$6,$7,$8,$9)
		ON CONFLICT (idempotency_key) DO UPDATE
		  SET updated_at = now(),
		      paytr_token = EXCLUDED.paytr_token,
		      paytr_iframe_url = EXCLUDED.paytr_iframe_url,
		      order_id = EXCLUDED.order_id,
		      metadata = payments.metadata || EXCLUDED.metadata
		RETURNING id
	`, order.ApplicationID, order.UserID, orderID, order.Amount, order.Currency, order.IdempotencyKey, meta, paytrToken, iframeURL).Scan(&paymentID)
	if err != nil {
		return uuid.Nil, uuid.Nil, "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, uuid.Nil, "", err
	}
	return orderID, paymentID, merchantOID, nil
}

// SetPayTRToken updates iframe credentials after the canonical merchant_oid is known.
func (s *Store) SetPayTRToken(ctx context.Context, paymentID uuid.UUID, paytrToken, iframeURL string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE payments SET paytr_token = $2, paytr_iframe_url = $3, updated_at = now()
		WHERE id = $1
	`, paymentID, paytrToken, iframeURL)
	return err
}

func (s *Store) MarkOrderPaid(ctx context.Context, orderID, paymentID uuid.UUID, transactionID string, callback map[string]string) error {
	raw, _ := json.Marshal(callback)
	meta, _ := json.Marshal(map[string]interface{}{"orderId": orderID.String()})
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE orders SET status = 'paid', paid_at = $2, updated_at = now()
		WHERE id = $1 AND status <> 'paid'
	`, orderID, time.Now())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		// already paid — idempotent success
		return tx.Commit(ctx)
	}
	_, err = tx.Exec(ctx, `
		UPDATE payments SET status = 'paid', provider_transaction_id = $2, paid_at = $3,
			callback_payload = $4::jsonb, metadata = metadata || $5::jsonb, updated_at = now()
		WHERE id = $1
	`, paymentID, transactionID, time.Now(), raw, meta)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) MarkOrderFailed(ctx context.Context, orderID, paymentID uuid.UUID, reason string, callback map[string]string) error {
	raw, _ := json.Marshal(callback)
	meta, _ := json.Marshal(map[string]string{"error": reason})
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, _ = tx.Exec(ctx, `
		UPDATE orders SET status = 'failed', updated_at = now()
		WHERE id = $1 AND status <> 'paid'
	`, orderID)
	_, err = tx.Exec(ctx, `
		UPDATE payments SET status = 'failed', callback_payload = $2::jsonb,
			metadata = metadata || $3::jsonb, updated_at = now()
		WHERE id = $1 AND status <> 'paid'
	`, paymentID, raw, meta)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateInvoice(ctx context.Context, inv InvoiceRecord, raw map[string]interface{}, errMsg string) (uuid.UUID, error) {
	rawJSON, _ := json.Marshal(raw)
	status := inv.Status
	if status == "" {
		status = domain.InvoicePending
	}
	var id uuid.UUID
	var issuedAt *time.Time
	if status == domain.InvoiceIssued {
		now := time.Now()
		issuedAt = &now
	}
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO invoices (
			order_id, payment_id, application_id, user_id, provider, external_id, invoice_number,
			status, pdf_url, amount, currency, error_message, raw_response, issued_at
		) VALUES (
			$1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),$8::invoice_status,NULLIF($9,''),$10,$11,NULLIF($12,''),$13,$14
		) RETURNING id
	`, inv.OrderID, inv.PaymentID, inv.ApplicationID, inv.UserID, inv.Provider, inv.ExternalID, inv.InvoiceNumber,
		status, inv.PDFURL, inv.Amount, inv.Currency, errMsg, rawJSON, issuedAt).Scan(&id)
	return id, err
}

func (s *Store) CreatePending(ctx context.Context, rec PaymentRecord, metadata map[string]interface{}) (uuid.UUID, error) {
	meta, _ := json.Marshal(metadata)
	var id uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO payments (application_id, user_id, order_id, provider, amount, currency, status, idempotency_key, metadata)
		VALUES ($1,$2,$3,$4::payment_provider,$5,$6,'pending',$7,$8)
		ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
		RETURNING id
	`, rec.ApplicationID, rec.UserID, rec.OrderID, rec.Provider, rec.Amount, rec.Currency, rec.IdempotencyKey, meta).Scan(&id)
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
	name = strings.ToLower(strings.TrimSpace(name))
	switch name {
	case "paytr", "":
		return "paytr"
	case "bizimhesap", "bizim_hesap":
		return "bizim_hesap"
	case "param":
		return "param"
	default:
		return "paytr"
	}
}

func ProviderDBValue(name string) string {
	switch NormalizeProvider(name) {
	case "bizim_hesap":
		return "bizim_hesap"
	case "param":
		return "param"
	default:
		return "paytr"
	}
}

func NewMerchantOID(appID uuid.UUID) string {
	// PAYTR: alphanumeric, max 64
	raw := strings.ReplaceAll(appID.String(), "-", "")
	suffix := fmt.Sprintf("%d", time.Now().Unix()%1000000)
	oid := "A" + raw[:12] + suffix
	if len(oid) > 64 {
		oid = oid[:64]
	}
	return oid
}
