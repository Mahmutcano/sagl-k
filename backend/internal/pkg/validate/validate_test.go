package validate

import "testing"

func TestNationalID(t *testing.T) {
	cases := []struct {
		in    string
		valid bool
	}{
		{"", false},
		{"123", false},
		{"00000000000", false},
		{"11111111111", false},
		{"10000000146", true}, // known valid algorithm sample
	}
	for _, tc := range cases {
		var errs Errors
		NationalID(&errs, "nationalIdentifier", tc.in)
		got := !errs.Has()
		if got != tc.valid {
			t.Errorf("NationalID(%q) valid=%v, want %v (%v)", tc.in, got, tc.valid, errs)
		}
	}
}

func TestPasswordComplexity(t *testing.T) {
	var errs Errors
	Password(&errs, "password", "short")
	if !errs.Has() {
		t.Fatal("expected short password to fail")
	}
	errs = nil
	Password(&errs, "password", "ValidPass1")
	if errs.Has() {
		t.Fatalf("expected valid password, got %v", errs)
	}
}
