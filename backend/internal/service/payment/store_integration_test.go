//go:build integration

package payment_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	appcfg "medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/domain"
	"medical-consultation-platform/backend/internal/repository"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
)

// Run: cd backend && go test -tags=integration ./internal/service/payment/ -count=1 -v
func TestPayTROrderPaymentInvoiceRoundTrip(t *testing.T) {
	_ = godotenv.Load(".env", "../.env", "../../.env", "../../../.env")
	cfg := appcfg.Load()
	if cfg.DatabaseURL == "" {
		t.Skip("DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := repository.New(ctx, cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	defer db.Close()

	store := paysvc.NewStore(db)
	paytr := paysvc.NewPayTRProvider(cfg.PayTR)

	var userID, appID uuid.UUID
	err = db.Pool.QueryRow(ctx, `
		SELECT u.id, a.id FROM applications a
		JOIN users u ON u.id = a.owner_user_id
		WHERE a.status_code = $1
		LIMIT 1
	`, domain.StatusPaymentPending).Scan(&userID, &appID)
	if err != nil {
		userID = uuid.New()
		appID = uuid.New()
		nid := "1" + uuid.New().String()[:10]
		phone := "555" + uuid.New().String()[:7]
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO users (id, national_identifier, email, phone_number, phone_country_code, password_hash, role, first_name, last_name, is_active)
			VALUES ($1,$2,$3,$4,'+90','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','patient','Int','Test',true)
		`, userID, nid, "int-"+userID.String()[:8]+"@example.com", phone)
		if err != nil {
			t.Fatalf("insert user: %v", err)
		}
		var hospitalID *uuid.UUID
		var hid uuid.UUID
		if e := db.Pool.QueryRow(ctx, `SELECT id FROM hospitals LIMIT 1`).Scan(&hid); e == nil {
			hospitalID = &hid
		}
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO applications (id, owner_user_id, hospital_id, status_code, status, application_number)
			VALUES ($1,$2,$3,$4,'payment_pending',$5)
		`, appID, userID, hospitalID, domain.StatusPaymentPending, "SMOKE"+uuid.New().String()[:8])
		if err != nil {
			t.Fatalf("insert app: %v", err)
		}
	}

	oid := paysvc.NewMerchantOID(appID)
	orderID, paymentID, merchantOID, err := store.CreateOrderAndPayment(ctx, paysvc.OrderRecord{
		ApplicationID:  appID,
		UserID:         userID,
		MerchantOID:    oid,
		Amount:         1500,
		Currency:       "TRY",
		IdempotencyKey: "paytr-int:" + appID.String() + ":" + uuid.New().String()[:8],
	}, "", "", map[string]interface{}{"provider": "paytr"})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if merchantOID == "" {
		t.Fatal("empty merchant oid")
	}

	tok, err := paytr.GetToken(ctx, paysvc.TokenRequest{
		MerchantOID: merchantOID, Email: "a@b.co", PaymentAmount: 1500,
		UserName: "Int Test", UserAddress: "TR", UserPhone: "555", UserIP: "127.0.0.1",
		UserBasket: []paysvc.BasketItem{{Name: "x", Price: 1500, Quantity: 1}},
		OKURL: "http://localhost/ok", FailURL: "http://localhost/fail",
	})
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	if err := store.SetPayTRToken(ctx, paymentID, tok.Token, tok.IframeURL); err != nil {
		t.Fatalf("set token: %v", err)
	}
	if err := store.MarkOrderPaid(ctx, orderID, paymentID, merchantOID, map[string]string{"status": "success"}); err != nil {
		t.Fatalf("mark paid: %v", err)
	}
	_, err = store.CreateInvoice(ctx, paysvc.InvoiceRecord{
		OrderID: orderID, PaymentID: &paymentID, ApplicationID: appID, UserID: userID,
		Provider: "parasut", ExternalID: "mock-" + uuid.New().String()[:8], InvoiceNumber: "INV-1",
		Status: domain.InvoiceIssued, Amount: 1500, Currency: "TRY",
	}, map[string]interface{}{"mock": true}, "")
	if err != nil {
		t.Fatalf("invoice: %v", err)
	}

	paid, err := store.FindPaidByApplication(ctx, appID)
	if err != nil || paid == nil {
		t.Fatalf("find paid: %v %#v", err, paid)
	}
	t.Logf("ok order=%s payment=%s merchant=%s", orderID, paymentID, merchantOID)
}
