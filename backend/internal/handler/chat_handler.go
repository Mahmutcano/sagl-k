package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	authmw "medical-consultation-platform/backend/internal/middleware"
	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	chatsvc "medical-consultation-platform/backend/internal/service/chat"
)

var chatUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type ChatHandler struct {
	chat *chatsvc.Service
	db   *repository.DB
	jwt  *jwtmgr.Manager
}

func NewChatHandler(chat *chatsvc.Service, db *repository.DB, jwt *jwtmgr.Manager) *ChatHandler {
	return &ChatHandler{chat: chat, db: db, jwt: jwt}
}

func (h *ChatHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	msgs, err := h.chat.ListMessages(r.Context(), appID, claims.UserID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CHAT001", "Mesajlar yüklenemedi.")
		return
	}
	_ = h.chat.MarkRead(r.Context(), appID, claims.UserID)
	response.OK(w, msgs)
}

func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var req struct {
		Content string `json:"content"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	msg, err := h.chat.SendMessage(r.Context(), appID, claims.UserID, req.Content)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "CHAT002", err.Error())
		return
	}
	response.OK(w, msg)
}

func (h *ChatHandler) WebSocket(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	appIDStr := strings.TrimSpace(r.URL.Query().Get("applicationId"))
	if token == "" || appIDStr == "" {
		http.Error(w, "token ve applicationId gerekli", http.StatusBadRequest)
		return
	}
	claims, err := h.jwt.Parse(token)
	if err != nil {
		http.Error(w, "oturum geçersiz", http.StatusUnauthorized)
		return
	}
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		http.Error(w, "geçersiz başvuru", http.StatusBadRequest)
		return
	}
	ctx := authmw.ContextWithClaims(r.Context(), claims)
	if err := authmw.CanAccessApplication(ctx, h.db, appID); err != nil {
		http.Error(w, "erişim yok", http.StatusForbidden)
		return
	}

	conn, err := chatUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &chatsvc.Client{
		AppID:  appID.String(),
		UserID: claims.UserID,
		Send:   make(chan chatsvc.Message, 16),
	}
	h.chat.Hub().Register(client)
	defer h.chat.Hub().Unregister(client)

	go func() {
		for msg := range client.Send {
			payload, _ := json.Marshal(map[string]interface{}{
				"type": "message",
				"data": msg,
			})
			_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		}
	}()

	conn.SetReadLimit(4096)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
