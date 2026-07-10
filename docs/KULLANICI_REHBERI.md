# Tıbbi Danışmanlık ve İkinci Görüş Sistemi — Yönetici ve Kullanıcı Tanıtım Rehberi

Bu rehber, teknik bilgiye sahip olmayan (doktorlar, hastane yöneticileri, proje yöneticileri ve hastalar) kişilerin sistemin ne işe yaradığını, nasıl çalıştığını ve kimlerin hangi rollere sahip olduğunu kolayca anlayabilmesi amacıyla hazırlanmıştır.

---

## 1. Bu Sistem Nedir ve Ne İşe Yarar?

Bu platform, Erciyes Üniversitesi Tıp Fakültesi hastalarının, **hastaneye fiziksel olarak gitmelerine gerek kalmadan** tahlil sonuçları, epikriz raporları ve radyolojik (röntgen, MR, tomografi vb.) görüntüleri üzerinden uzman doktorlardan yazılı bir değerlendirme ("ikinci görüş raporu") almalarını sağlayan bir dijital sağlık portalıdır.

### Neden Bu Sisteme İhtiyaç Var?
- **Kolaylık**: Hastalar sıra beklemeden veya uzak şehirlerden seyahat etmeden uzman hekim görüşüne ulaşır.
- **Güven**: Tahlil ve teşhisler, Erciyes Üniversitesi'nin uzman hekim kadrosu tarafından detaylıca incelenir.
- **Zaman Tasarrufu**: Hekimler kendi panellerinden başvuruları sırayla inceleyip raporları dijital ortamda hazırlar.

---

## 2. Sistemdeki Rol ve Görevler (Kim, Ne Yapıyor?)

Sistemde net bir görev dağılımı bulunur. Her kullanıcının görebileceği ekranlar ve yapabileceği işlemler kendi yetkilerine göre sınırlıdır:

### 👤 1. Hasta (Vatandaş)
Sistemin ana kullanıcısıdır.
- Platforma üye olur ve kişisel bilgilerini girer.
- Kendisi veya bir yakını (çocuğu, eşi, anne/babası vb.) adına başvuru oluşturabilir.
- Şikayetlerini açıklar, tahlil/epikriz dosyalarını sisteme yükler.
- Tercih ettiği doktoru seçer ve danışmanlık ücretini kredi kartıyla güvenli şekilde öder.
- Doktor raporunu tamamladığında, sistem üzerinden raporu okur ve bilgisayarına indirebilir.

### 🧑‍⚕️ 2. Tıbbi Sekreter / Hemşire (Ön İnceleme Ekibi — *İleride AI Agent / Çağrı Merkezi*)
Bu rol, hastanın yüklediği evrakları kontrol eden "filtre" adımıdır. 
- **Şimdilik Devre Dışı**: Mevcut sistemde arada bir insan/sekreter katmanı bulunmamaktadır. Hasta ödemeyi yaptığı an başvuru **doğrudan** doktorun ekranına düşer.
- **Gelecek Planı**: İlerleyen süreçte bu ön kontrol ve evrak onaylama adımının bir **AI Agent (Yapay Zeka Temsilcisi)** veya **Çağrı Merkezi** ekibi tarafından yönetilmesi planlanmaktadır. Bu sayede hatalı veya eksik başvurular doktora gitmeden önce otomatik tespit edilip düzeltilecektir.

### 🩺 3. Uzman Hekim (Doktor)
Tıbbi kararı veren ve raporu yazan kişidir.
- Ön incelemeden geçen ve kendi branşına atanan hastaların listesini görür.
- Hastanın şikayetlerini okur, yüklediği tahlil ve raporları inceler.
- Hastanenin röntgen/MR sistemine (PACS) entegre bağlantı sayesinde hastanın filmlerini doğrudan kendi ekranında görüntüler.
- Raporu yazarken ara ara taslak olarak kaydedebilir.
- İnceleme bittiğinde nihai görüş raporunu onaylar. Bu onay ile başvuru sonuçlanır ve rapor hastaya açılır.

### ⚙️ 4. Sistem Yöneticisi (Admin)
Sistemin arka plandaki yöneticisidir.
- Yeni doktor hesapları açar veya branşları düzenler.
- Yapılan tüm ödemeleri ve para hareketlerini raporlar.
- İptal edilen başvuruların ücret iadesi (refund) işlemlerini banka sistemine iletir.
- Sistemde kimin ne zaman hangi işlemi yaptığını (güvenlik loglarını) takip eder.

---

## 3. Başvurunun Yolculuğu (Adım Adım Nasıl Çalışıyor?)

Bir hastanın başvuru yapıp raporunu almasına kadar geçen süreç şu an için **doğrudan** hasta ve hekim arasında gerçekleşir:

```
[HASTA]                                                     [UZMAN HEKİM]
Üye Ol & Ödeme Yap ──> (Doğrudan Doktor Kuyruğuna Sevk) ──> Doktor İncelemesi ──> Nihai Rapor Hazır
```

1. **Başvuru ve Ödeme**: Hasta şikayetlerini yazar, dosyalarını yükler, doktorunu seçer ve ödemeyi kredi kartıyla güvenli şekilde yapar.
2. **Hekim Kuyruğuna İletim**: Ödemesi tamamlanan başvuru, arada herhangi bir aracı katman (sekreter/hemşire) olmadan **doğrudan** seçilen uzman doktorun inceleme ekranına düşer. *(İleride bu adımın belgeleri kontrol eden bir AI Agent veya Çağrı Merkezi sistemi ile güçlendirilmesi planlanmaktadır).*
3. **Doktor Değerlendirmesi**: Doktor hastanın tüm tıbbi geçmişini inceler. Gerekirse hastanın hastanedeki eski röntgen ve MR filmlerine de sistemden tek tıkla ulaşır. Raporunu yazar.
4. **Rapor Teslimi**: Doktor raporu onayladığı an hastaya "Raporunuz hazırlanmıştır" diye SMS ve E-posta gider. Hasta kendi paneline girip raporu okur veya PDF olarak bilgisayarına indirir.

---

## 4. Diğer Önemli Detaylar ve Teknolojik Kolaylıklar

### 🖼️ Film ve Görüntüleme (PACS) Entegrasyonu
Hastaların büyük boyutlu röntgen veya MR dosyalarını bilgisayarlarından yüklemeye çalışmaları çok zordur. Sistemimiz sayesinde, hasta sadece kimlik numarasını girdiğinde, doktor kendi inceleme ekranındaki özel bir bağlantı vasıtasıyla hastanın Erciyes Üniversitesi sistemindeki eski radyoloji görüntülerine doğrudan erişebilir.

### 💳 Güvenli Ödeme ve Kolay İade
Ödeme işlemleri Param ile yapılır. Başarılı ödeme sonrası fatura Bizim Hesap üzerinden otomatik oluşturulur. Eğer doktor başvuruyu kabul edemeyecek bir durumdaysa (örneğin hastanın durumu acil müdahale gerektiriyorsa ve bu platformun kapsamı dışındaysa), başvuru iptal edilir ve admin onayıyla ödenen ücret hastanın kartına otomatik olarak iade edilir.

### ✉️ Anlık Bildirimler
Süreç boyunca hastanın sürekli sistemi kontrol etmesi gerekmez. 
- Kayıt olurken telefona gelen onay kodu,
- Evraklarda eksiklik olduğunda yapılan uyarı,
- Doktorun raporu tamamladığı bilgisi,
kullanıcıya SMS ve E-posta yoluyla anında bildirilir.
