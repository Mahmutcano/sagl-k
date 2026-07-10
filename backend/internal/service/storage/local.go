package storage

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

type Local struct {
	Root string
}

func NewLocal(root string) (*Local, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		root = "./uploads"
	}
	if err := os.MkdirAll(root, 0o750); err != nil {
		fallback := filepath.Join(os.TempDir(), "medical-consultation-uploads")
		log.Printf("[storage] upload dir %q unavailable (%v); falling back to %q", root, err, fallback)
		if err2 := os.MkdirAll(fallback, 0o750); err2 != nil {
			return nil, fmt.Errorf("upload dir hazırlanamadı: %w", err2)
		}
		root = fallback
	}
	return &Local{Root: root}, nil
}

func (l *Local) Save(appID uuid.UUID, fileName string, r io.Reader) (relativePath string, size int64, err error) {
	safeName := sanitizeFileName(fileName)
	if safeName == "" {
		safeName = "file"
	}
	dir := filepath.Join(l.Root, appID.String())
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", 0, err
	}
	relativePath = filepath.Join(appID.String(), uuid.NewString()+"_"+safeName)
	abs := filepath.Join(l.Root, relativePath)
	f, err := os.OpenFile(abs, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	n, err := io.Copy(f, r)
	if err != nil {
		_ = os.Remove(abs)
		return "", 0, err
	}
	return relativePath, n, nil
}

func (l *Local) Open(relativePath string) (*os.File, error) {
	abs, err := l.safeAbs(relativePath)
	if err != nil {
		return nil, err
	}
	return os.Open(abs)
}

func (l *Local) Remove(relativePath string) error {
	abs, err := l.safeAbs(relativePath)
	if err != nil {
		return err
	}
	return os.Remove(abs)
}

func (l *Local) safeAbs(relativePath string) (string, error) {
	clean := filepath.Clean(relativePath)
	if clean == "." || strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid storage path")
	}
	abs := filepath.Join(l.Root, clean)
	rootAbs, err := filepath.Abs(l.Root)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(abs)
	if err != nil {
		return "", err
	}
	if !strings.HasPrefix(targetAbs, rootAbs+string(os.PathSeparator)) && targetAbs != rootAbs {
		return "", fmt.Errorf("invalid storage path")
	}
	return targetAbs, nil
}

func sanitizeFileName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			return r
		case r == '.', r == '-', r == '_':
			return r
		default:
			return '_'
		}
	}, name)
	return strings.Trim(name, "._")
}
