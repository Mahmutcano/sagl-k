# Medical Consultation Platform

Erciyes Üniversitesi Tıp Fakültesi için tıbbi danışmanlık (ikinci görüş) platformu.

* **Teknik dokümantasyon:** [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
* **Ayrı deploy (backend + frontend):** [DEPLOYMENT.md](./DEPLOYMENT.md)
* **Kullanıcı rehberi:** [KULLANICI_REHBERI.md](./KULLANICI_REHBERI.md)

## Proje yapısı

```
sagl-k/
├── backend/           # Go REST API (:8080) — ayrı deploy
├── frontend/web/      # Next.js (hasta + doktor + admin) — ayrı deploy
└── docs/
```

## Hızlı başlangıç (yerel)

```bash
cp .env.example .env
docker compose up -d postgres

cd backend && go run ./cmd/api

cd frontend/web && npm install && npm run dev
```

| Servis | URL |
|--------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:8080 |

Yerelde `NEXT_PUBLIC_API_URL` boş bırakılır; Next.js `/api` isteklerini backend’e proxy eder.

## Production (ayrı deploy)

1. **Backend:** `backend/` → `https://api.sizin-domain.com`
2. **Frontend:** `frontend/web/` → `NEXT_PUBLIC_API_URL=https://api.sizin-domain.com`
3. Backend CORS: `PORTAL_URL=https://app.sizin-domain.com`

Detay: [DEPLOYMENT.md](./DEPLOYMENT.md)

## Param test kartı

`PARAM_MODE=test` iken: `4546711234567894` · `12/26` · CVV `000` — [Param test kartları](https://dev.param.com.tr/tr/test-kartlari)
