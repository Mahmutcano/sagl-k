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

**Seçenek A** — build context `backend/`:
```bash
cd backend && docker build -t mcp-api .
```

**Seçenek B** — build context repo kökü:
```bash
docker build -f Dockerfile.backend -t mcp-api .
```

```bash
docker run -p 8080:8080 --env-file backend/.env -v mcp-uploads:/data/uploads mcp-api
docker run --rm --env-file backend/.env mcp-api /app/migrate
```

Kök `docker-compose.yml` yalnızca **postgres + api** içindir; frontend dahil değildir.

### Railway (backend servisi)

Repo’da **iki ayrı Railway service** kullanın. Kök `railway.toml` yoktur; karışıklığı önlemek için servis başına config:

| Ayar | Değer |
|------|--------|
| **Config file** | `railway.backend.toml` (repo kökü) veya `backend/railway.toml` |
| **Root Directory** | `.` veya `backend` |
| **Dockerfile** | `Dockerfile.backend` (kök) veya `Dockerfile` (`backend/`) |
| **Health check** | `/health` |

`go.mod not found` → Root Directory ile Dockerfile eşleşmiyor.

| Root Directory | Dockerfile path |
|----------------|-----------------|
| `backend` | `Dockerfile` |
| `.` (repo kökü) | `Dockerfile.backend` |

**Yanlış:** Root=`.` + Dockerfile=`backend/Dockerfile` → `go.mod` bulunamaz.  
**Yanlış:** Frontend servisinde backend `railway.toml` kullanmak → health check `/health` backend’e gider, frontend fail eder.

Zorunlu env: `DATABASE_URL`, `JWT_SECRET`. DB bağlanamazsa process ayağa kalkmaz ve health check düşer.

Platform `PORT` değişkenini otomatik verir (API buna bağlanır).

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

### Railway (frontend servisi)

| Ayar | Değer |
|------|--------|
| **Config file** | `railway.frontend.toml` (repo kökü) veya `frontend/web/railway.toml` |
| **Root Directory** | `.` veya `frontend/web` |
| **Dockerfile** | `Dockerfile.frontend` (kök) veya `Dockerfile` (`frontend/web/`) |
| **Health check** | `/health` (Next.js route) |
| **Build arg / env** | `NEXT_PUBLIC_API_URL=https://api...` |

İlk build’de `NEXT_PUBLIC_API_URL` set edilmeli; aksi halde tarayıcı yerel proxy bekler.

---

## 3. Deploy sırası

1. PostgreSQL + migration
2. **Backend** deploy → `https://api.../health` → `{"status":"ok"}`
3. Backend env: `PORTAL_URL` = frontend URL
4. Ödeme / bildirim env (Railway Variables):
   - `DEFAULT_PAYMENT_PROVIDER=paytr`
   - `PAYTR_MODE=mock|test|live` + `PAYTR_MERCHANT_*` (test/live)
   - `PAYTR_CALLBACK_URL=https://<api-host>/api/v1/payments/paytr/callback` (public HTTPS; auth yok, hash doğrulamalı)
   - `SMS_PROVIDER=mock|verimor`, `EMAIL_PROVIDER=mock|mailersend`, `PARASUT_MODE=mock|test|live`
5. Migration: `014_paytr_orders_invoices.sql` (orders + invoices + payments PAYTR kolonları)
6. **Frontend** deploy → `NEXT_PUBLIC_API_URL` = backend URL
7. Smoke: başvuru → PAYTR token/iframe (veya mock simulate) → callback → fatura satırı

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
| Health check failed (frontend) | Ayrı service + `railway.frontend.toml`; path `/health`; `HOSTNAME=0.0.0.0` (Dockerfile’da) |
| Health check failed (backend) | `DATABASE_URL` / `JWT_SECRET`; Deploy Logs’ta crash; path `/health` |
| CORS hatası | Backend `PORTAL_URL` = frontend origin; gerekirse `CORS_ALLOWED_ORIGINS` |
| API 404 / network | `NEXT_PUBLIC_API_URL` yanlış veya trailing `/` |
| Ödeme / upload | Backend `UPLOAD_DIR` kalıcı volume değil |
| PAYTR callback 404 / unpaid | `PAYTR_CALLBACK_URL` yanlış host; migration 014 eksik; merchant hash |
| Fatura oluşmuyor | `PARASUT_MODE` / credentials; callback sonrası async — `invoices.status` kontrol et |
| JWT / oturum | Aynı `JWT_SECRET`; HTTPS önerilir |

---

## 6. İlgili dosyalar

- [`backend/Dockerfile`](../backend/Dockerfile) · [`Dockerfile.backend`](../Dockerfile.backend)
- [`frontend/web/Dockerfile`](../frontend/web/Dockerfile) · [`Dockerfile.frontend`](../Dockerfile.frontend)
- [`railway.backend.toml`](../railway.backend.toml) · [`railway.frontend.toml`](../railway.frontend.toml)
- [`docker-compose.yml`](../docker-compose.yml) — yerel postgres + api
- [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) — mimari ve API
