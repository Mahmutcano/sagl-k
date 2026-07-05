# Tıbbi Danışmanlık — Frontend

Tek Next.js uygulaması; hasta, doktor/hemşire ve yönetim panelleri aynı portta.

## Çalıştırma

```bash
yarn install   # veya ../portal/node_modules symlink
yarn dev       # http://localhost:3000
```

Backend ayrı: `cd ../../backend && go run ./cmd/api` → `:8080`

## Rotalar

| Alan | Giriş | Panel |
|------|-------|-------|
| Ana hub | `/` | Üç portal kartı |
| Hasta | `/patient/login` | `/patient/applications` |
| Doktor | `/doctor/login` | `/doctor/dashboard` |
| Admin | `/admin/login` | `/admin` |

## Test hesapları

- Admin: TC `10000000146` / `Admin123!`
- Doktor: TC `20000000114` / `Doctor123!`
- Hasta: `/patient/register` ile kayıt

## Eski uygulamalar

`frontend/portal`, `frontend/doctor`, `frontend/admin` artık kullanılmıyor; tüm geliştirme `frontend/web` üzerinden yapılır.
