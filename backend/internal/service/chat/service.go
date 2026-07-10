package chat

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/repository"
)

type Message struct {
	ID             uuid.UUID  `json:"id"`
	ApplicationID  uuid.UUID  `json:"applicationId"`
	SenderUserID   uuid.UUID  `json:"senderUserId"`
	SenderName     string     `json:"senderName"`
	SenderRole     string     `json:"senderRole"`
	Content        string     `json:"content"`
	CreatedAt      time.Time  `json:"createdAt"`
	ReadAt         *time.Time `json:"readAt,omitempty"`
	IsMine         bool       `json:"isMine,omitempty"`
}

type Service struct {
	db  *repository.DB
	hub *Hub
}

func NewService(db *repository.DB) *Service {
	return &Service{db: db, hub: NewHub()}
}

func (s *Service) Hub() *Hub { return s.hub }

func (s *Service) ListMessages(ctx context.Context, appID, viewerID uuid.UUID) ([]Message, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id, m.application_id, m.sender_user_id, m.content, m.created_at, m.read_at,
		       u.first_name, u.last_name, u.role
		FROM application_messages m
		JOIN users u ON u.id = m.sender_user_id
		WHERE m.application_id = $1
		ORDER BY m.created_at ASC
		LIMIT 500
	`, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Message
	for rows.Next() {
		var m Message
		var fn, ln, role string
		if err := rows.Scan(&m.ID, &m.ApplicationID, &m.SenderUserID, &m.Content, &m.CreatedAt, &m.ReadAt, &fn, &ln, &role); err != nil {
			continue
		}
		m.SenderName = strings.TrimSpace(fn + " " + ln)
		m.SenderRole = role
		m.IsMine = m.SenderUserID == viewerID
		list = append(list, m)
	}
	if list == nil {
		list = []Message{}
	}
	return list, nil
}

func (s *Service) SendMessage(ctx context.Context, appID, senderID uuid.UUID, content string) (Message, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return Message{}, errors.New("Mesaj boş olamaz.")
	}
	if len(content) > 4000 {
		return Message{}, errors.New("Mesaj çok uzun.")
	}

	var msg Message
	var fn, ln, role string
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO application_messages (application_id, sender_user_id, content)
		VALUES ($1, $2, $3)
		RETURNING id, application_id, sender_user_id, content, created_at, read_at
	`, appID, senderID, content).Scan(&msg.ID, &msg.ApplicationID, &msg.SenderUserID, &msg.Content, &msg.CreatedAt, &msg.ReadAt)
	if err != nil {
		return Message{}, err
	}
	_ = s.db.Pool.QueryRow(ctx, `
		SELECT first_name, last_name, role FROM users WHERE id = $1
	`, senderID).Scan(&fn, &ln, &role)
	msg.SenderName = strings.TrimSpace(fn + " " + ln)
	msg.SenderRole = role
	msg.IsMine = true

	s.hub.Broadcast(appID.String(), msg)
	return msg, nil
}

func (s *Service) MarkRead(ctx context.Context, appID, readerID uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE application_messages
		SET read_at = now()
		WHERE application_id = $1
		  AND sender_user_id <> $2
		  AND read_at IS NULL
	`, appID, readerID)
	return err
}

// Hub manages WebSocket subscribers per application room.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]struct{}
}

type Client struct {
	AppID  string
	UserID uuid.UUID
	Send   chan Message
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*Client]struct{})}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[c.AppID] == nil {
		h.rooms[c.AppID] = make(map[*Client]struct{})
	}
	h.rooms[c.AppID][c] = struct{}{}
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room, ok := h.rooms[c.AppID]; ok {
		delete(room, c)
		if len(room) == 0 {
			delete(h.rooms, c.AppID)
		}
	}
	close(c.Send)
}

func (h *Hub) Broadcast(appID string, msg Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room := h.rooms[appID]
	for client := range room {
		out := msg
		out.IsMine = client.UserID == msg.SenderUserID
		select {
		case client.Send <- out:
		default:
		}
	}
}
