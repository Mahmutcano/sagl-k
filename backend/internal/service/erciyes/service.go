package erciyes

import (
	"errors"
	"strings"

	"medical-consultation-platform/backend/internal/config"
)

// ErrServiceUnavailable is returned when HIS cannot be reached in live mode.
var ErrServiceUnavailable = errors.New("erciyes service unavailable")

// Service orchestrates Erciyes HIS + PACS integrations.
type Service struct {
	client            Client
	targetInstitution int
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
		client:            client,
		targetInstitution: target,
	}
}

func (s *Service) Mode() string { return s.client.Mode() }

func (s *Service) TargetInstitution() int { return s.targetInstitution }

func (s *Service) AppliesTo(targetInstitution int) bool {
	return targetInstitution == s.targetInstitution
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
