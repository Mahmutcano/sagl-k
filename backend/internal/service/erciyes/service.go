package erciyes

import (
	"errors"
	"fmt"
	"strings"

	"medical-consultation-platform/backend/internal/config"
)

var (
	// ErrInpatientBlocked is returned when application must not proceed.
	ErrInpatientBlocked = errors.New("erciyes inpatient: application blocked")
	// ErrServiceUnavailable is returned when HIS cannot be reached in live mode.
	ErrServiceUnavailable = errors.New("erciyes service unavailable")
)

// Service orchestrates Erciyes HIS + PACS integrations.
type Service struct {
	client             Client
	targetInstitution  int
	blockOnUnavailable bool
}

func NewService(cfg config.Config) *Service {
	var client Client
	if cfg.Erciyes.Mode == "live" && cfg.Erciyes.BaseURL != "" {
		client = NewLiveClient(cfg.Erciyes, cfg.PACSBaseURL)
	} else {
		client = NewMockClient(cfg.PACSBaseURL)
	}
	target := cfg.Erciyes.TargetInstitution
	if target == 0 {
		target = TargetInstitutionErciyes
	}
	return &Service{
		client:             client,
		targetInstitution:  target,
		blockOnUnavailable: cfg.Erciyes.BlockOnUnavailable,
	}
}

func (s *Service) Mode() string { return s.client.Mode() }

func (s *Service) TargetInstitution() int { return s.targetInstitution }

func (s *Service) AppliesTo(targetInstitution int) bool {
	return targetInstitution == s.targetInstitution
}

// CheckInpatient queries HIS for the given national ID.
func (s *Service) CheckInpatient(nationalIdentifier string) (*InpatientStatus, error) {
	nid := strings.TrimSpace(nationalIdentifier)
	if nid == "" {
		return nil, fmt.Errorf("TC Kimlik Numarası zorunludur")
	}
	status, err := s.client.CheckInpatient(nid)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrServiceUnavailable, err)
	}
	return status, nil
}

// EnsureNotInpatient blocks Erciyes applications when the patient is admitted.
// nationalIdentifier is the patient (or represented person) TC.
func (s *Service) EnsureNotInpatient(targetInstitution int, nationalIdentifier string) (*InpatientStatus, error) {
	if !s.AppliesTo(targetInstitution) {
		return &InpatientStatus{
			NationalIdentifier: nationalIdentifier,
			IsInpatient:        false,
			Message:            "Erciyes dışı kurum; yatan hasta kontrolü uygulanmadı.",
			Source:             s.client.Mode(),
		}, nil
	}

	status, err := s.CheckInpatient(nationalIdentifier)
	if err != nil {
		if s.blockOnUnavailable {
			return nil, err
		}
		// Fail-open only when explicitly configured; default is fail-closed for safety.
		return nil, err
	}
	if status.IsInpatient {
		return status, ErrInpatientBlocked
	}
	return status, nil
}

func (s *Service) LookupPatient(nationalIdentifier string) (*PatientSummary, error) {
	return s.client.LookupPatient(strings.TrimSpace(nationalIdentifier))
}

func (s *Service) PACSURL(params map[string]string) (*PACSLink, error) {
	return s.client.PACSURL(params)
}

func (s *Service) Health() error {
	return s.client.Health()
}

// BlockMessage is the user-facing explanation when inpatient.
func BlockMessage(forRelative bool) string {
	if forRelative {
		return "Başvuru yaptığınız yakınınız şu anda Erciyes Üniversitesi Tıp Fakültesi Hastanesi'nde yatan bir hastaysa, onun adına başvuru oluşturulamaz. Başvuru oluşturmadan doğrudan hastaneden hizmet alabilirsiniz."
	}
	return "Şu anda Erciyes Üniversitesi Tıp Fakültesi Hastanesi'nde yatan bir hastaysanız, adınıza başvuru oluşturulamaz. Başvuru oluşturmadan doğrudan hastaneden hizmet alabilirsiniz."
}
