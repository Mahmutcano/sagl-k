package handler

import (
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	authmw "medical-consultation-platform/backend/internal/middleware"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/service/storage"
)

const (
	maxAttachmentBytes = 10 << 20 // 10 MiB
	maxAttachmentsPerApp = 10
)

var allowedAttachmentMIME = map[string]struct{}{
	"application/pdf": {},
	"image/jpeg":      {},
	"image/png":       {},
}

func (h *ApplicationHandler) storage() (*storage.Local, error) {
	return storage.NewLocal(h.cfg.UploadDir)
}

func (h *ApplicationHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, file_name, mime_type, file_size, created_at
		FROM application_attachments
		WHERE application_id = $1
		ORDER BY created_at
	`, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP141", "Dosya listesi alınamadı.")
		return
	}
	defer rows.Close()
	list := []map[string]interface{}{}
	for rows.Next() {
		var id, name string
		var mime *string
		var size *int64
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &mime, &size, &createdAt); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id": id, "fileName": name, "createdAt": createdAt,
		}
		if mime != nil {
			item["mimeType"] = *mime
		}
		if size != nil {
			item["fileSize"] = *size
		}
		list = append(list, item)
	}
	response.OK(w, list)
}

func (h *ApplicationHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var statusCode int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT status_code FROM applications WHERE id = $1`, appID).Scan(&statusCode); err != nil {
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}
	if statusCode != 0 {
		response.Fail(w, http.StatusBadRequest, "APP142", "Ödeme sonrası dosya yüklenemez.")
		return
	}

	var count int
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM application_attachments WHERE application_id = $1`, appID).Scan(&count)
	if count >= maxAttachmentsPerApp {
		response.Fail(w, http.StatusBadRequest, "APP143", "En fazla 10 dosya yükleyebilirsiniz.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentBytes+1024)
	if err := r.ParseMultipartForm(maxAttachmentBytes); err != nil {
		response.Fail(w, http.StatusRequestEntityTooLarge, "APP144", "Dosya çok büyük (en fazla 10 MB).")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "APP145", "Dosya alanı (file) zorunludur.")
		return
	}
	defer file.Close()

	mime := header.Header.Get("Content-Type")
	if mime == "" {
		mime = mimeFromExt(header.Filename)
	}
	if _, ok := allowedAttachmentMIME[strings.Split(mime, ";")[0]]; !ok {
		response.Fail(w, http.StatusBadRequest, "APP146", "Yalnızca PDF, JPEG ve PNG dosyaları yüklenebilir.")
		return
	}

	store, err := h.storage()
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP147", "Dosya depolama hazır değil.")
		return
	}
	path, size, err := store.Save(appID, header.Filename, io.LimitReader(file, maxAttachmentBytes+1))
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP148", "Dosya kaydedilemedi.")
		return
	}
	if size > maxAttachmentBytes {
		_ = store.Remove(path)
		response.Fail(w, http.StatusRequestEntityTooLarge, "APP144", "Dosya çok büyük (en fazla 10 MB).")
		return
	}

	var attachmentID uuid.UUID
	err = h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO application_attachments (application_id, file_name, mime_type, storage_path, file_size)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, appID, header.Filename, mime, path, size).Scan(&attachmentID)
	if err != nil {
		_ = store.Remove(path)
		response.Fail(w, http.StatusInternalServerError, "APP149", "Dosya kaydı oluşturulamadı.")
		return
	}
	response.OK(w, map[string]interface{}{
		"id": attachmentID.String(), "fileName": header.Filename, "fileSize": size, "mimeType": mime,
	})
}

func (h *ApplicationHandler) DownloadAttachment(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	attachmentID, err := uuid.Parse(chi.URLParam(r, "attachmentId"))
	if err != nil {
		var errs validate.Errors
		errs.Add("attachmentId", "format", "Dosya kimliği geçersiz.")
		validate.Fail(w, errs)
		return
	}
	var fileName, storagePath, mime string
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT file_name, storage_path, COALESCE(mime_type, 'application/octet-stream')
		FROM application_attachments
		WHERE id = $1 AND application_id = $2
	`, attachmentID, appID).Scan(&fileName, &storagePath, &mime)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP151", "Dosya bulunamadı.")
		return
	}
	store, err := h.storage()
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP147", "Dosya depolama hazır değil.")
		return
	}
	f, err := store.Open(storagePath)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP151", "Dosya bulunamadı.")
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP151", "Dosya bulunamadı.")
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	http.ServeContent(w, r, fileName, info.ModTime(), f)
}

func (h *ApplicationHandler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var statusCode int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT status_code FROM applications WHERE id = $1`, appID).Scan(&statusCode); err != nil {
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}
	if statusCode != 0 {
		response.Fail(w, http.StatusBadRequest, "APP152", "Ödeme sonrası dosya silinemez.")
		return
	}
	attachmentID, err := uuid.Parse(chi.URLParam(r, "attachmentId"))
	if err != nil {
		var errs validate.Errors
		errs.Add("attachmentId", "format", "Dosya kimliği geçersiz.")
		validate.Fail(w, errs)
		return
	}
	var storagePath string
	err = h.db.Pool.QueryRow(r.Context(), `
		DELETE FROM application_attachments
		WHERE id = $1 AND application_id = $2
		RETURNING storage_path
	`, attachmentID, appID).Scan(&storagePath)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP151", "Dosya bulunamadı.")
		return
	}
	if store, err := h.storage(); err == nil {
		_ = store.Remove(storagePath)
	}
	response.OK(w, map[string]bool{"deleted": true})
}

func mimeFromExt(name string) string {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".pdf":
		return "application/pdf"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	default:
		return "application/octet-stream"
	}
}
