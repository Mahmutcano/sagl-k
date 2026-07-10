package erciyes

import (
	"fmt"
	"net/url"
	"strings"
)

// MockClient simulates Erciyes HIS for local development.
type MockClient struct {
	pacs string
}

func NewMockClient(pacsBaseURL string) *MockClient {
	return &MockClient{pacs: strings.TrimRight(pacsBaseURL, "/")}
}

func (m *MockClient) Mode() string { return "mock" }

func (m *MockClient) Health() error { return nil }

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
