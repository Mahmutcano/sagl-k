package erciyes

import (
	"fmt"
	"net/url"
	"strings"
	"time"
)

// MockClient simulates Erciyes HIS for local development.
// National IDs ending with "0" are treated as inpatient.
type MockClient struct {
	pacs string
}

func NewMockClient(pacsBaseURL string) *MockClient {
	return &MockClient{pacs: strings.TrimRight(pacsBaseURL, "/")}
}

func (m *MockClient) Mode() string { return "mock" }

func (m *MockClient) Health() error { return nil }

func (m *MockClient) CheckInpatient(nationalIdentifier string) (*InpatientStatus, error) {
	nid := strings.TrimSpace(nationalIdentifier)
	isInpatient := strings.HasSuffix(nid, "0")
	status := &InpatientStatus{
		NationalIdentifier: nid,
		IsInpatient:        isInpatient,
		Source:             "mock",
	}
	if isInpatient {
		now := time.Now().Add(-48 * time.Hour)
		status.ProtocolNo = "MOCK-PROT-" + nid[len(nid)-4:]
		status.WardName = "Dahiliye Servisi"
		status.BedNo = "12-A"
		status.AdmissionDate = &now
		status.Message = "Hasta Erciyes Üniversitesi Tıp Fakültesi Hastanesi'nde yatmaktadır. (mock)"
	} else {
		status.Message = "Hasta yatan hasta kaydı bulunamadı. (mock)"
	}
	return status, nil
}

func (m *MockClient) LookupPatient(nationalIdentifier string) (*PatientSummary, error) {
	nid := strings.TrimSpace(nationalIdentifier)
	return &PatientSummary{
		NationalIdentifier: nid,
		FirstName:          "Mock",
		LastName:           "Hasta",
		Found:              true,
	}, nil
}

func (m *MockClient) PACSURL(params map[string]string) (*PACSLink, error) {
	base := m.pacs
	if base == "" {
		base = "https://pacs.example.com"
	}
	q := url.Values{}
	for k, v := range params {
		if v != "" {
			q.Set(k, v)
		}
	}
	link := base
	if enc := q.Encode(); enc != "" {
		link = fmt.Sprintf("%s/?%s", base, enc)
	}
	return &PACSLink{URL: link, StudyUID: params["studyUid"]}, nil
}
