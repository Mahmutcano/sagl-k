package erciyes

import "time"

// TargetInstitutionErciyes is the institution code for Erciyes University Hospital.
const TargetInstitutionErciyes = 1

// InpatientStatus is the result of a HIS inpatient lookup.
type InpatientStatus struct {
	NationalIdentifier string     `json:"nationalIdentifier"`
	IsInpatient        bool       `json:"isInpatient"`
	ProtocolNo         string     `json:"protocolNo,omitempty"`
	WardName           string     `json:"wardName,omitempty"`
	BedNo              string     `json:"bedNo,omitempty"`
	AdmissionDate      *time.Time `json:"admissionDate,omitempty"`
	Message            string     `json:"message"`
	Source             string     `json:"source"` // mock | live
}

// PatientSummary is basic demographics returned by HIS when available.
type PatientSummary struct {
	NationalIdentifier string `json:"nationalIdentifier"`
	FirstName          string `json:"firstName,omitempty"`
	LastName           string `json:"lastName,omitempty"`
	Found              bool   `json:"found"`
}

// PACSLink is a viewer URL for imaging studies.
type PACSLink struct {
	URL     string `json:"url"`
	StudyUID string `json:"studyUid,omitempty"`
}

// Client talks to Erciyes hospital information systems.
type Client interface {
	// CheckInpatient returns whether the person is currently admitted at Erciyes.
	CheckInpatient(nationalIdentifier string) (*InpatientStatus, error)
	// LookupPatient optionally resolves patient demographics from HIS.
	LookupPatient(nationalIdentifier string) (*PatientSummary, error)
	// PACSURL builds an imaging viewer URL.
	PACSURL(params map[string]string) (*PACSLink, error)
	// Health checks connectivity to the remote service.
	Health() error
	// Mode returns mock or live.
	Mode() string
}
