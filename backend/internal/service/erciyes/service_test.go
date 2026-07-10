package erciyes

import (
	"testing"

	"medical-consultation-platform/backend/internal/config"
)

func TestMockLookupPatient(t *testing.T) {
	svc := NewService(config.Config{
		Erciyes:     config.ErciyesConfig{Mode: "mock", TargetInstitution: 1},
		PACSBaseURL: "https://pacs.example.com",
	})
	out, err := svc.LookupPatient("10000000146")
	if err != nil {
		t.Fatal(err)
	}
	if !out.Found || out.NationalIdentifier != "10000000146" {
		t.Fatalf("unexpected patient summary: %+v", out)
	}
}

func TestAppliesToErciyesOnly(t *testing.T) {
	svc := NewService(config.Config{
		Erciyes: config.ErciyesConfig{Mode: "mock", TargetInstitution: 1},
	})
	if !svc.AppliesTo(1) {
		t.Fatal("expected AppliesTo(1)")
	}
	if svc.AppliesTo(2) {
		t.Fatal("expected not AppliesTo(2)")
	}
}
