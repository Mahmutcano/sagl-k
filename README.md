# Medical Consultation Platform

Erciyes Üniversitesi Tıp Fakültesi için tıbbi danışmanlık (ikinci görüş) platformu.

## Proje yapısı

```
medical-consultation-platform/
├── backend/              # Go REST API (:8080)
└── frontend/
    ├── portal/           # Hasta portalı (:3000)
    ├── doctor/           # Doktor portalı (:3001)
    └── admin/            # Yönetim paneli (:3002)
```

Tüm arayüz uygulamaları `frontend/` altındadır; her biri ayrı Next.js projesidir.

## Hızlı başlangıç

```bash
cp .env.example .env
docker compose up -d postgres

cd backend && go run ./cmd/api

cd frontend/portal && yarn dev   # :3000
cd frontend/doctor && yarn dev     # :3001
cd frontend/admin && yarn dev      # :3002
```

| Uygulama | URL |
|----------|-----|
| Hasta | http://localhost:3000 |
| Doktor | http://localhost:3001 |
| Yönetim | http://localhost:3002 |
| API | http://localhost:8080 |

Doktor portalında giriş yaptıktan sonra **Hasta alanı** sekmesiyle başvuruları görüntüleyebilirsiniz.
