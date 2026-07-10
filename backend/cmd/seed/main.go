package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	loadEnvFiles(
		"../.env.stage",
		"../.env",
		".env",
	)

	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		log.Fatal("DATABASE_URL is required (set in .env.stage or environment)")
	}

	sqlPath := filepath.Join("scripts", "seed_demo_users.sql")
	if len(os.Args) > 1 {
		sqlPath = os.Args[1]
	}

	body, err := os.ReadFile(sqlPath)
	if err != nil {
		log.Fatalf("read seed file: %v", err)
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

	if _, err := pool.Exec(ctx, string(body)); err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	log.Printf("seed ok: %s", sqlPath)
}

func loadEnvFiles(paths ...string) {
	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("loaded env: %s", path)
		}
	}
}
