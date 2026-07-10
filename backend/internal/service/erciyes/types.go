package erciyes

// TargetInstitutionErciyes is the institution code for Erciyes University Hospital.
const TargetInstitutionErciyes = 1

// PatientSummary is basic demographics returned by HIS when available.
type PatientSummary struct {
	NationalIdentifier string `json:"nationalIdentifier"`
	FirstName          string `json:"firstName,omitempty"`
	LastName           string `json:"lastName,omitempty"`
	Found              bool   `json:"found"`
}

// PACSLink is a viewer URL for imaging studies.
type PACSLink struct {
	URL      string `json:"url"`
	StudyUID string `json:"studyUid,omitempty"`
}

// Client talks to Erciyes hospital information systems.
type Client interface {
	LookupPatient(nationalIdentifier string) (*PatientSummary, error)
	PACSURL(params map[string]string) (*PACSLink, error)
	Health() error
	Mode() string
}
