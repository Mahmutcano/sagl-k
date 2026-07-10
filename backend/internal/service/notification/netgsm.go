package notification

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// NetgsmSMS sends SMS via Netgsm HTTP API (https://www.netgsm.com.tr/dokuman).
type NetgsmSMS struct {
	username string
	password string
	header   string
	client   *http.Client
}

func NewNetgsmSMS(username, password, header string) (*NetgsmSMS, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	header = strings.TrimSpace(header)
	if username == "" || password == "" {
		return nil, fmt.Errorf("netgsm: SMS_USERNAME ve SMS_PASSWORD zorunludur")
	}
	if header == "" {
		return nil, fmt.Errorf("netgsm: SMS_HEADER (gönderici başlığı) zorunludur")
	}
	return &NetgsmSMS{
		username: username,
		password: password,
		header:   header,
		client:   &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (n *NetgsmSMS) Send(ctx context.Context, phone, message string) error {
	gsm := normalizeGSM(phone)
	if gsm == "" {
		return fmt.Errorf("netgsm: geçersiz telefon numarası")
	}
	endpoint := "https://api.netgsm.com.tr/sms/send/get/"
	q := url.Values{}
	q.Set("usercode", n.username)
	q.Set("password", n.password)
	q.Set("gsmno", gsm)
	q.Set("message", message)
	q.Set("msgheader", n.header)
	q.Set("dil", "TR")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("netgsm: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	code := strings.TrimSpace(string(body))
	if code == "00" || (len(code) > 2 && isAllDigits(code)) {
		return nil
	}
	return fmt.Errorf("netgsm hata kodu: %s", code)
}

func isAllDigits(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return len(s) > 0
}

func normalizeGSM(phone string) string {
	digits := make([]byte, 0, 15)
	for i := 0; i < len(phone); i++ {
		if phone[i] >= '0' && phone[i] <= '9' {
			digits = append(digits, phone[i])
		}
	}
	s := string(digits)
	switch {
	case len(s) == 10 && s[0] == '5':
		return "90" + s
	case len(s) == 11 && s[0] == '0' && s[1] == '5':
		return "9" + s
	case len(s) == 12 && strings.HasPrefix(s, "90"):
		return s
	case len(s) >= 10 && len(s) <= 15:
		// E.164 digits without '+' (international or already-normalized TR).
		return s
	default:
		return ""
	}
}
