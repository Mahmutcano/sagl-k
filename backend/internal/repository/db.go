package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	db.Pool.Close()
}

func (db *DB) LogNotification(ctx context.Context, channel, recipient, templateKey, status string, userID, appID *uuid.UUID, preview string) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO notification_logs (channel, recipient, template_key, status, user_id, application_id, body_preview, sent_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $4 = 'sent' THEN now() ELSE NULL END)
	`, channel, recipient, templateKey, status, userID, appID, preview)
	return err
}
