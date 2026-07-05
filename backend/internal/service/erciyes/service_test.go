package erciyes

import (
	"errors"
	"testing"

	"medical-consultation-platform/backend/internal/config"
)

func TestMockInpatientByNationalIDSuffix(t *testing.T) {
	svc := NewService(config.Config{
		PACSBaseURL: "https://pacs.example.com",
		Erciyes:     config.ErciyesConfig{Mode: "mock", TargetInstitution: 1},
	})

	in, err := svc.CheckInpatient("10000000140")
	if err != nil {
		t.Fatal(err)
	}
	if !in.IsInpatient {
		t.Fatal("expected inpatient for TC ending with 0")
	}

	out, err := svc.CheckInpatient("10000000146")
	if err != nil {
		t.Fatal(err)
	}
	if out.IsInpatient {
		t.Fatal("expected not inpatient")
	}
}

func TestEnsureNotInpatientBlocksErciyesOnly(t *testing.T) {
	svc := NewService(config.Config{
		Erciyes: config.ErciyesConfig{Mode: "mock", TargetInstitution: 1},
	})

	_, err := svc.EnsureNotInpatient(1, "10000000140")
	if !errors.Is(err, ErrInpatientBlocked) {
		t.Fatalf("want ErrInpatientBlocked, got %v", err)
	}

	// Other institution skips HIS.
	st, err := svc.EnsureNotInpatient(2, "10000000140")
	if err != nil {
		t.Fatal(err)
	}
	if st.IsInpatient {
		t.Fatal("non-erciyes institution should not flag inpatient")
	}
}
