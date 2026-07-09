# Backend API — Railway / Docker
# Build context: backend/ klasörü VEYA monorepo kökü (ikisi de çalışır)
#
#   cd backend && docker build -t mcp-api .
#   docker build -f backend/Dockerfile -t mcp-api .
#   docker build -f Dockerfile.backend -t mcp-api .

FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /workspace
COPY . /workspace
RUN set -eux; \
    if [ -f go.mod ]; then \
      BUILD_DIR=/workspace; \
    elif [ -f backend/go.mod ]; then \
      BUILD_DIR=/workspace/backend; \
    else \
      echo "ERROR: go.mod not found. Railway Root Directory = backend veya repo kökü olmalı."; \
      ls -la /workspace; \
      exit 1; \
    fi; \
    cd "$BUILD_DIR"; \
    go mod download 2>/dev/null || true; \
    go mod tidy; \
    CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api; \
    CGO_ENABLED=0 GOOS=linux go build -o /migrate ./cmd/migrate; \
    cp -r migrations /migrations

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /api /app/api
COPY --from=builder /migrate /app/migrate
COPY --from=builder /migrations /app/migrations
EXPOSE 8080
CMD ["/app/api"]
