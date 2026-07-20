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

## PAYTR ödeme (stage / test)

- `PAYTR_MODE=mock` — iframe yok; UI’da “Test ödemesini tamamla”
- `PAYTR_MODE=test` — iframe + `test_mode=1`; aşağıdaki test kartları
- `PAYTR_MODE=live` — gerçek tahsilat (`PAYTR_CALLBACK_URL` public HTTPS)

### Test kartları ([PAYTR dokümantasyonu](https://dev.paytr.com/en/direkt-api/test-kart-bilgileri))

| Kart | Numara | SKT | CVV |
|------|--------|-----|-----|
| Visa | `4355 0843 5508 4358` | `12/30` (gelecek tarih) | `000` |
| Mastercard | `5406 6754 0667 5403` | `12/30` | `000` |
| Troy | `9792 0303 9444 0796` | `12/30` | `000` |

Kart sahibi: `PAYTR TEST` (serbest). iFrame API’de test kartları çoğu zaman otomatik gelir; Direct API için yukarıdakiler zorunludur.

**Admin:** Ödemeler & Faturalar listesinde `merchant_oid`, sipariş/fatura durumu, callback ve CSV export görünür. Başvuru detayında ödeme paneli + e-makbuz.
