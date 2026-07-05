package erciyes

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
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
	cfg    config.ErciyesConfig
	pacs   string
	http   *http.Client
	mode   string
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

func (c *LiveClient) CheckInpatient(nationalIdentifier string) (*InpatientStatus, error) {
	if c.cfg.Protocol == "soap" {
		return c.checkInpatientSOAP(nationalIdentifier)
	}
	return c.checkInpatientJSON(nationalIdentifier)
}

type inpatientJSONRequest struct {
	NationalIdentifier string `json:"nationalIdentifier"`
	TCKimlikNo         string `json:"tcKimlikNo"`
}

type inpatientJSONResponse struct {
	IsInpatient   bool   `json:"isInpatient"`
	YatanHastaMi  *bool  `json:"yatanHastaMi"`
	ProtocolNo    string `json:"protocolNo"`
	ProtokolNo    string `json:"protokolNo"`
	WardName      string `json:"wardName"`
	ServisAdi     string `json:"servisAdi"`
	BedNo         string `json:"bedNo"`
	YatakNo       string `json:"yatakNo"`
	AdmissionDate string `json:"admissionDate"`
	YatisTarihi   string `json:"yatisTarihi"`
	Message       string `json:"message"`
	Mesaj         string `json:"mesaj"`
}

func (c *LiveClient) checkInpatientJSON(nationalIdentifier string) (*InpatientStatus, error) {
	endpoint := strings.TrimRight(c.cfg.BaseURL, "/") + c.cfg.InpatientPath
	body, _ := json.Marshal(inpatientJSONRequest{
		NationalIdentifier: nationalIdentifier,
		TCKimlikNo:         nationalIdentifier,
	})
	ctx, cancel := context.WithTimeout(context.Background(), c.cfg.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	c.applyAuth(req)

	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erciyes bağlantı hatası: %w", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("erciyes servisi hata döndü (%d)", res.StatusCode)
	}

	var parsed inpatientJSONResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("erciyes yanıtı okunamadı: %w", err)
	}

	isInpatient := parsed.IsInpatient
	if parsed.YatanHastaMi != nil {
		isInpatient = *parsed.YatanHastaMi
	}
	protocol := firstNonEmpty(parsed.ProtocolNo, parsed.ProtokolNo)
	ward := firstNonEmpty(parsed.WardName, parsed.ServisAdi)
	bed := firstNonEmpty(parsed.BedNo, parsed.YatakNo)
	msg := firstNonEmpty(parsed.Message, parsed.Mesaj)
	if msg == "" {
		if isInpatient {
			msg = "Hasta Erciyes Üniversitesi Tıp Fakültesi Hastanesi'nde yatmaktadır."
		} else {
			msg = "Hasta yatan hasta kaydı bulunamadı."
		}
	}

	status := &InpatientStatus{
		NationalIdentifier: nationalIdentifier,
		IsInpatient:        isInpatient,
		ProtocolNo:         protocol,
		WardName:           ward,
		BedNo:              bed,
		Message:            msg,
		Source:             "live",
	}
	if ad := firstNonEmpty(parsed.AdmissionDate, parsed.YatisTarihi); ad != "" {
		if t, err := time.Parse("2006-01-02", ad); err == nil {
			status.AdmissionDate = &t
		} else if t, err := time.Parse(time.RFC3339, ad); err == nil {
			status.AdmissionDate = &t
		}
	}
	return status, nil
}

// Minimal SOAP envelope for HIS endpoints that expect XML.
func (c *LiveClient) checkInpatientSOAP(nationalIdentifier string) (*InpatientStatus, error) {
	endpoint := strings.TrimRight(c.cfg.BaseURL, "/") + c.cfg.InpatientPath
	envelope := fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="%s">
  <soap:Body>
    <tns:CheckInpatient>
      <tns:NationalIdentifier>%s</tns:NationalIdentifier>
    </tns:CheckInpatient>
  </soap:Body>
</soap:Envelope>`, xmlEscape(c.cfg.SOAPNamespace), xmlEscape(nationalIdentifier))

	ctx, cancel := context.WithTimeout(context.Background(), c.cfg.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(envelope))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	if c.cfg.SOAPAction != "" {
		req.Header.Set("SOAPAction", c.cfg.SOAPAction)
	}
	c.applyAuth(req)

	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erciyes SOAP bağlantı hatası: %w", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("erciyes SOAP hata (%d)", res.StatusCode)
	}

	// Flexible parse: look for common tags.
	isInpatient := strings.Contains(strings.ToLower(string(raw)), "<isinpatient>true</isinpatient>") ||
		strings.Contains(strings.ToLower(string(raw)), "<yatanhastami>true</yatanhastami>")

	var doc struct {
		XMLName xml.Name
	}
	_ = xml.Unmarshal(raw, &doc)

	msg := "Hasta yatan hasta kaydı bulunamadı."
	if isInpatient {
		msg = "Hasta Erciyes Üniversitesi Tıp Fakültesi Hastanesi'nde yatmaktadır."
	}
	return &InpatientStatus{
		NationalIdentifier: nationalIdentifier,
		IsInpatient:        isInpatient,
		Message:            msg,
		Source:             "live",
	}, nil
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

func xmlEscape(s string) string {
	var b strings.Builder
	xml.EscapeText(&b, []byte(s))
	return b.String()
}
