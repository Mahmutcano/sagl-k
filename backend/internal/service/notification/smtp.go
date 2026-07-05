package notification

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
)

// SMTPEmail sends mail via SMTP with STARTTLS.
type SMTPEmail struct {
	host     string
	port     string
	user     string
	password string
	from     string
}

func NewSMTPEmail(host, port, user, password, from string) (*SMTPEmail, error) {
	host = strings.TrimSpace(host)
	port = strings.TrimSpace(port)
	from = strings.TrimSpace(from)
	if host == "" {
		return nil, fmt.Errorf("smtp: SMTP_HOST zorunludur")
	}
	if port == "" {
		port = "587"
	}
	if from == "" {
		return nil, fmt.Errorf("smtp: SMTP_FROM zorunludur")
	}
	return &SMTPEmail{host: host, port: port, user: strings.TrimSpace(user), password: password, from: from}, nil
}

func (s *SMTPEmail) Send(ctx context.Context, to, subject, body string) error {
	to = strings.TrimSpace(to)
	if to == "" || !strings.Contains(to, "@") {
		return fmt.Errorf("smtp: geçersiz alıcı e-posta")
	}
	addr := net.JoinHostPort(s.host, s.port)
	msg := buildMIME(s.from, to, subject, body)

	if s.user == "" {
		return smtp.SendMail(addr, nil, s.from, []string{to}, msg)
	}

	auth := smtp.PlainAuth("", s.user, s.password, s.host)
	tlsConfig := &tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}
	conn, err := tls.DialWithDialer(&net.Dialer{}, "tcp", addr, tlsConfig)
	if err != nil {
		// Fallback: plain + STARTTLS via SendMail
		return smtp.SendMail(addr, auth, s.from, []string{to}, msg)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return err
	}
	defer client.Close()

	if err = client.Auth(auth); err != nil {
		return err
	}
	if err = client.Mail(s.from); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write(msg); err != nil {
		return err
	}
	return w.Close()
}

func buildMIME(from, to, subject, body string) []byte {
	return []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, to, subject, body,
	))
}
