# Ayrı Deploy Rehberi (Backend + Frontend)

Backend ve frontend **bağımsız** servisler olarak deploy edilir. Yerelde tek makinede çalışır; production’da genelde iki URL kullanılır.

| Servis | Dizin | Örnek URL |
|--------|--------|-----------|
| **Backend (Go API)** | `backend/` | `https://api.ornek.edu.tr` |
| **Frontend (Next.js)** | `frontend/web/` | `https://app.ornek.edu.tr` |
| **PostgreSQL** | Harici (Railway, RDS, vb.) | — |

---

## 1. Backend deploy

### Gereksinimler
- PostgreSQL (`DATABASE_URL`)
- Kalıcı disk: `UPLOAD_DIR` (başvuru ekleri)
- Migration’lar: `backend/migrations/` (ilk kurulumda çalıştırın)

### Ortam değişkenleri (özet)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...min-32-char...
PORTAL_URL=https://app.ornek.edu.tr
DOCTOR_URL=https://app.ornek.edu.tr
ADMIN_URL=https://app.ornek.edu.tr
UPLOAD_DIR=/data/uploads
```

Tam liste: [`backend/.env.example`](../backend/.env.example)

**CORS:** Frontend farklı bir domaindeyse `PORTAL_URL` (ve gerekirse `DOCTOR_URL`, `ADMIN_URL`) production frontend URL’si olmalı. Ek domainler için:

```env
CORS_ALLOWED_ORIGINS=https://www.ornek.edu.tr,https://staging.ornek.edu.tr
```

### Docker

**Build context mutlaka `backend/` klasörü olmalı** (repo kökünden değil):

```bash
cd backend
docker build -t mcp-api .
docker run -p 8080:8080 --env-file .env -v mcp-uploads:/data/uploads mcp-api
```

Repo kökünden build etmeyin (`docker build -f backend/Dockerfile .` → `COPY migrations` hatası).

Migration (container içinden):

```bash
docker run --rm --env-file .env mcp-api /app/migrate
```

Kök `docker-compose.yml` yalnızca **postgres + api** içindir; frontend dahil değildir.

### Railway / Render
- **Root directory:** `backend` (önemli — monorepo kökü değil)
- **Dockerfile:** `Dockerfile` (veya `backend/Dockerfile` yalnızca root=backend ise)
- **Health check:** `GET /health`
- Platform `PORT` değişkenini otomatik verir (API buna bağlanır).

### Migration

```bash
cd backend
export DATABASE_URL=...
go run ./cmd/migrate
```

---

## 2. Frontend deploy

### Gereksinimler
- Build/runtime’da **`NEXT_PUBLIC_API_URL`** = backend’in public URL’si (ör. `https://api.ornek.edu.tr`)
- **Slash olmadan** tanımlayın.

```env
NEXT_PUBLIC_API_URL=https://api.ornek.edu.tr
```

Tam liste: [`frontend/web/.env.example`](../frontend/web/.env.example)

> `NEXT_PUBLIC_API_URL` set edildiğinde Next.js `/api` proxy’si **kapalıdır**; tarayıcı doğrudan backend’e istek atar. CORS backend’de açık olmalıdır.

### Docker

```bash
cd frontend/web
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.ornek.edu.tr \
  -t mcp-web .
docker run -p 3000:3000 -e PORT=3000 mcp-web
```

### Vercel
- **Root directory:** `frontend/web`
- **Environment:** `NEXT_PUBLIC_API_URL=https://api.ornek.edu.tr`
- Build: `npm run build` / `next build`

### Railway (frontend)
- **Root directory:** `frontend/web`
- **Dockerfile:** `frontend/web/Dockerfile`
- Build arg / env: `NEXT_PUBLIC_API_URL`

---

## 3. Deploy sırası

1. PostgreSQL + migration
2. **Backend** deploy → `https://api.../health` → `{"status":"ok"}`
3. Backend env: `PORTAL_URL` = frontend URL
4. **Frontend** deploy → `NEXT_PUBLIC_API_URL` = backend URL
5. Tarayıcıdan giriş / başvuru / ödeme smoke test

---

## 4. Yerel geliştirme (ayrı process)

```bash
# Terminal 1 — DB
docker compose up -d postgres

# Terminal 2 — API
cd backend && cp .env.example .env && go run ./cmd/api

# Terminal 3 — Web (proxy modu; NEXT_PUBLIC_API_URL boş)
cd frontend/web && npm run dev
```

`NEXT_PUBLIC_API_URL` boşken `next.config.mjs` istekleri `localhost:8080`’e proxy eder.

---

## 5. Sık hatalar

| Belirti | Çözüm |
|---------|--------|
| CORS hatası | Backend `PORTAL_URL` = frontend origin; gerekirse `CORS_ALLOWED_ORIGINS` |
| API 404 / network | `NEXT_PUBLIC_API_URL` yanlış veya trailing `/` |
| Ödeme / upload | Backend `UPLOAD_DIR` kalıcı volume değil |
| JWT / oturum | Aynı `JWT_SECRET`; HTTPS önerilir |

---

## 6. İlgili dosyalar

- [`backend/Dockerfile`](../backend/Dockerfile)
- [`frontend/web/Dockerfile`](../frontend/web/Dockerfile)
- [`docker-compose.yml`](../docker-compose.yml) — yerel postgres + api
- [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) — mimari ve API
