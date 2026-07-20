package validate

import "testing"

func TestPaymentAmount(t *testing.T) {
	cases := []struct {
		amount float64
		ok     bool
	}{
		{0, false},
		{0.5, false},
		{1, true},
		{1500.99, true},
		{1500.999, false},
		{1_000_001, false},
	}
	for _, tc := range cases {
		var errs Errors
		PaymentAmount(&errs, "amount", tc.amount)
		if errs.Has() == tc.ok {
			t.Errorf("PaymentAmount(%v) errs=%v want ok=%v", tc.amount, errs, tc.ok)
		}
	}
}

func TestMerchantOID(t *testing.T) {
	var errs Errors
	MerchantOID(&errs, "merchantOid", "")
	if !errs.Has() {
		t.Fatal("empty oid should fail")
	}
	errs = nil
	MerchantOID(&errs, "merchantOid", "A12!!")
	if !errs.Has() {
		t.Fatal("invalid chars should fail")
	}
	errs = nil
	out := MerchantOID(&errs, "merchantOid", "A60dd3bbd9d91549382")
	if errs.Has() || out == "" {
		t.Fatalf("valid oid failed: %v", errs)
	}
}

func TestPayTRCallbackStatus(t *testing.T) {
	var errs Errors
	if PayTRCallbackStatus(&errs, "status", "SUCCESS") != "success" || errs.Has() {
		t.Fatalf("success: %v", errs)
	}
	errs = nil
	PayTRCallbackStatus(&errs, "status", "pending")
	if !errs.Has() {
		t.Fatal("pending should fail")
	}
}

func TestPayTRTotalAmountKurus(t *testing.T) {
	var errs Errors
	n, ok := PayTRTotalAmountKurus(&errs, "total_amount", "150000")
	if !ok || n != 150000 || errs.Has() {
		t.Fatalf("got %d ok=%v errs=%v", n, ok, errs)
	}
	errs = nil
	_, ok = PayTRTotalAmountKurus(&errs, "total_amount", "15.00")
	if ok || !errs.Has() {
		t.Fatal("decimal kuruş string should fail")
	}
}

func TestAmountMatchesKurus(t *testing.T) {
	if !AmountMatchesKurus(1500, 150000) {
		t.Fatal("1500 TRY should match 150000 kuruş")
	}
	if AmountMatchesKurus(1500, 149000) {
		t.Fatal("mismatch should fail")
	}
}

func TestPaymentListStatus(t *testing.T) {
	var errs Errors
	if PaymentListStatus(&errs, "status", "paid") != "paid" || errs.Has() {
		t.Fatal("paid")
	}
	errs = nil
	PaymentListStatus(&errs, "status", "foo")
	if !errs.Has() {
		t.Fatal("foo should fail")
	}
}
