# Medical Consultation Platform

Erciyes Üniversitesi Tıp Fakültesi için tıbbi danışmanlık (ikinci görüş) platformu.

* 🧑‍💻 **Teknik Dokümantasyon**: Sistem mimarisi, veritabanı şeması ve API detayları için [PROJECT_DOCUMENTATION.md](file:///Users/canozgan/Documents/sagl-k/PROJECT_DOCUMENTATION.md) dosyasını inceleyebilirsiniz.
* 👥 **Yönetici ve Kullanıcı Rehberi**: Yazılımcı olmayan kullanıcılar, doktorlar ve hastane yöneticileri için hazırlanan açıklayıcı rehbere [KULLANICI_REHBERI.md](file:///Users/canozgan/Documents/sagl-k/KULLANICI_REHBERI.md) dosyasından ulaşabilirsiniz.

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
