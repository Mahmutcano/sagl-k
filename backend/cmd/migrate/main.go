package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Prefer local .env; only fall back to stage when DATABASE_URL is unset.
	// Explicit DATABASE_URL in the environment always wins (godotenv does not override).
	loadEnvFiles(".env", "../.env", "../.env.stage")
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("database ping: %v", err)
	}

	if err := ensureMigrationsTable(ctx, pool); err != nil {
		log.Fatalf("migrations table: %v", err)
	}

	dir := filepath.Join("migrations")
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}

	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		log.Fatalf("glob migrations: %v", err)
	}
	sort.Strings(files)
	if len(files) == 0 {
		log.Fatalf("no migration files in %s", dir)
	}

	applied, err := loadApplied(ctx, pool)
	if err != nil {
		log.Fatalf("load applied: %v", err)
	}

	if len(applied) == 0 {
		if err := maybeBaseline(ctx, pool, files); err != nil {
			log.Fatalf("baseline: %v", err)
		}
		applied, err = loadApplied(ctx, pool)
		if err != nil {
			log.Fatalf("reload applied: %v", err)
		}
	}

	var ran int
	for _, path := range files {
		name := filepath.Base(path)
		if applied[name] {
			log.Printf("skip  %s (already applied)", name)
			continue
		}
		body, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("read %s: %v", name, err)
		}
		log.Printf("apply %s", name)
		tx, err := pool.Begin(ctx)
		if err != nil {
			log.Fatalf("begin tx for %s: %v", name, err)
		}
		if _, err := tx.Exec(ctx, string(body)); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("exec %s: %v", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("record %s: %v", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Fatalf("commit %s: %v", name, err)
		}
		ran++
	}

	if ran == 0 {
		log.Println("database is up to date")
		return
	}
	log.Printf("applied %d migration(s)", ran)
}

func ensureMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	return err
}

func loadApplied(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx, `SELECT name FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out[name] = true
	}
	return out, rows.Err()
}

// maybeBaseline marks migration files as applied when the schema already reflects them.
func maybeBaseline(ctx context.Context, pool *pgxpool.Pool, files []string) error {
	var usersExists bool
	if err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'users'
		)
	`).Scan(&usersExists); err != nil {
		return err
	}
	if !usersExists {
		return nil
	}

	log.Println("existing schema detected — baselining migration history")
	for _, path := range files {
		name := filepath.Base(path)
		ok, err := migrationAlreadyApplied(ctx, pool, name)
		if err != nil {
			return err
		}
		if !ok {
			continue
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO schema_migrations (name) VALUES ($1)
			ON CONFLICT (name) DO NOTHING
		`, name); err != nil {
			return fmt.Errorf("baseline %s: %w", name, err)
		}
		log.Printf("baseline %s", name)
	}
	return nil
}

func migrationAlreadyApplied(ctx context.Context, pool *pgxpool.Pool, name string) (bool, error) {
	switch name {
	case "001_init.sql":
		return tableExists(ctx, pool, "users")
	case "002_remove_third_party_seed.sql":
		// Data cleanup; safe to re-run but baseline if core schema exists.
		return tableExists(ctx, pool, "hospitals")
	case "003_report_json_not_base64.sql":
		return columnExists(ctx, pool, "application_surveys", "report_json")
	case "004_grant_mcp.sql":
		return tableExists(ctx, pool, "users")
	case "005_application_number_doctor_scope.sql":
		return columnExists(ctx, pool, "applications", "application_number")
	default:
		return false, nil
	}
}

func tableExists(ctx context.Context, pool *pgxpool.Pool, table string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		)
	`, table).Scan(&ok)
	return ok, err
}

func columnExists(ctx context.Context, pool *pgxpool.Pool, table, column string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
		)
	`, table, column).Scan(&ok)
	return ok, err
}

func loadEnvFiles(paths ...string) {
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("loaded env: %s", path)
		}
	}
}
