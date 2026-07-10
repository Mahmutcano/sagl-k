package erciyes

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"medical-consultation-platform/backend/internal/config"
)

// LiveClient calls Erciyes HIS over HTTP (JSON or SOAP).
type LiveClient struct {
	cfg  config.ErciyesConfig
	pacs string
	http *http.Client
	mode string
}

func NewLiveClient(cfg config.ErciyesConfig, pacsBaseURL string) *LiveClient {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &LiveClient{
		cfg:  cfg,
		pacs: strings.TrimRight(pacsBaseURL, "/"),
		http: &http.Client{Timeout: timeout},
		mode: "live",
	}
}

func (c *LiveClient) Mode() string { return c.mode }

func (c *LiveClient) Health() error {
	if c.cfg.BaseURL == "" {
		return fmt.Errorf("ERCIYES_BASE_URL tanımlı değil")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(c.cfg.BaseURL, "/")+"/health", nil)
	if err != nil {
		return err
	}
	c.applyAuth(req)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 500 {
		return fmt.Errorf("erciyes servisi yanıt vermedi (%d)", res.StatusCode)
	}
	return nil
}

func (c *LiveClient) applyAuth(req *http.Request) {
	if c.cfg.Username != "" {
		req.SetBasicAuth(c.cfg.Username, c.cfg.Password)
	}
	if c.cfg.APIKey != "" {
		req.Header.Set("X-API-Key", c.cfg.APIKey)
	}
	req.Header.Set("Accept", "application/json")
}

func (c *LiveClient) LookupPatient(nationalIdentifier string) (*PatientSummary, error) {
	endpoint := strings.TrimRight(c.cfg.BaseURL, "/") + c.cfg.PatientPath
	q := url.Values{"nationalIdentifier": {nationalIdentifier}, "tcKimlikNo": {nationalIdentifier}}
	ctx, cancel := context.WithTimeout(context.Background(), c.cfg.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return &PatientSummary{NationalIdentifier: nationalIdentifier, Found: false}, nil
	}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	var parsed struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Ad        string `json:"ad"`
		Soyad     string `json:"soyad"`
		Found     *bool  `json:"found"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	found := true
	if parsed.Found != nil {
		found = *parsed.Found
	}
	return &PatientSummary{
		NationalIdentifier: nationalIdentifier,
		FirstName:          firstNonEmpty(parsed.FirstName, parsed.Ad),
		LastName:           firstNonEmpty(parsed.LastName, parsed.Soyad),
		Found:              found,
	}, nil
}

func (c *LiveClient) PACSURL(params map[string]string) (*PACSLink, error) {
	if c.pacs == "" {
		return nil, fmt.Errorf("PACS_BASE_URL tanımlı değil")
	}
	q := url.Values{}
	for k, v := range params {
		if v != "" {
			q.Set(k, v)
		}
	}
	link := c.pacs
	if enc := q.Encode(); enc != "" {
		link = c.pacs + "/?" + enc
	}
	return &PACSLink{URL: link, StudyUID: params["studyUid"]}, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
