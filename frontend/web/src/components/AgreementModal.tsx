"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type AgreementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  title: string;
  type: "terms" | "kvkk";
};

export function AgreementModal({ isOpen, onClose, onAccept, title, type }: AgreementModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      // Reset scroll
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
          // If content fits without scrolling, enable accept immediately
          const el = scrollContainerRef.current;
          if (el.scrollHeight <= el.clientHeight) {
            setHasScrolledToBottom(true);
          }
        }
      }, 50);
    }
  }, [isOpen]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    // Check if scrolled to bottom with 4px tolerance
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 4;
    if (isBottom) {
      setHasScrolledToBottom(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-muted-foreground hover:text-foreground text-xl"
            aria-label="Kapat"
          >
            &times;
          </button>
        </div>
        
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 text-sm text-foreground/80 leading-relaxed space-y-4"
        >
          {type === "terms" ? (
            <>
              <p className="font-semibold text-foreground">1. Giriş ve Hizmet Kapsamı</p>
              <p>
                İşbu Kullanım Koşulları, Erciyes Üniversitesi Tıbbi Danışmanlık Platformu&apos;na (&quot;Platform&quot;) hasta veya 
                temsilci sıfatıyla üye olan kullanıcıların uyması gereken kuralları belirler. Platform, hekimlerden 
                ikinci görüş ve tıbbi danışmanlık hizmeti alınması amacıyla kurulmuştur. Platform üzerinden acil 
                tıbbi müdahale, acil tanı veya tedavi hizmeti verilmemektedir. Acil durumlarda derhal 112 Acil 
                Çağrı merkezine başvurulmalıdır.
              </p>
              <p className="font-semibold text-foreground">2. Üyelik ve Kimlik Bilgileri</p>
              <p>
                Platforma kayıt olurken T.C. Kimlik Numarası, ad, soyad ve cinsiyet bilgilerinin doğru ve tutarlı 
                girilmesi zorunludur. Yanlış veya yanıltıcı beyanlardan doğacak hukuki ve cezai sorumluluk tamamen 
                kullanıcıya aittir. T.C. Kimlik Numarası doğrulaması Erciyes Üniversitesi sistemleri üzerinden yapılmaktadır.
              </p>
              <p className="font-semibold text-foreground">3. Bilgi ve Belge Paylaşımı</p>
              <p>
                Kullanıcı, tıbbi danışmanlık talep ederken yüklediği epikriz raporları, tahlil sonuçları ve radyolojik 
                görüntülerin doğruluğundan sorumludur. Eksik veya hatalı bilgi paylaşımı nedeniyle oluşabilecek hekim 
                görüşü sapmalarından Erciyes Üniversitesi sorumlu tutulamaz.
              </p>
              <p className="font-semibold text-foreground">4. Ödeme ve Ücretlendirme</p>
              <p>
                Hizmet ücreti, danışmanlık talep edilen hekime göre değişiklik gösterebilir. Ödeme işlemi tamamlanmadan 
                başvuru hekime yönlendirilmez. Hizmetin iptali ve ücret iadesi, hekim incelemeye başlamadığı sürece 
                admin onayı ile gerçekleştirilebilir. İncelemesi başlamış başvurularda iade yapılamaz.
              </p>
              <p className="font-semibold text-foreground">5. Fikri Mülkiyet ve Görüş Raporu</p>
              <p>
                Hekimler tarafından hazırlanan danışmanlık raporları yalnızca bilgilendirme ve rehberlik amacı taşır. 
                Raporlar reçete yerine geçmez. Raporun fikri mülkiyet hakları saklı olup, ticari amaçla çoğaltılması 
                ve dağıtılması yasaktır.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">1. Veri Sorumlusu</p>
              <p>
                Erciyes Üniversitesi Tıp Fakültesi (&quot;Üniversite&quot;) olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu 
                (&quot;KVKK&quot;) uyarınca, kişisel verilerinizi kanuna ve dürüstlük kurallarına uygun olarak işliyor ve koruyoruz.
              </p>
              <p className="font-semibold text-foreground">2. İşlenen Kişisel Verileriniz</p>
              <p>
                Platform kapsamında; T.C. Kimlik Numarası, Ad, Soyad, Doğum Tarihi, Cinsiyet gibi kimlik verileriniz; 
                Telefon ve E-posta gibi iletişim verileriniz; Platforma yüklediğiniz tahlil, epikriz, tetkik ve röntgen 
                gibi özel nitelikli sağlık verileriniz işlenmektedir.
              </p>
              <p className="font-semibold text-foreground">3. Veri İşleme Amaçları</p>
              <p>
                Kişisel verileriniz ve özel nitelikli sağlık verileriniz;
                <br />
                - Hekimlerimiz tarafından tıbbi danışmanlık ve ikinci görüş hizmetinin yürütülmesi,
                <br />
                - Faturalandırma, ödeme tahsilatı ve iade süreçlerinin yönetilmesi,
                <br />
                - Kimlik doğrulama süreçlerinin işletilmesi,
                <br />
                - Güvenlik ve mevzuata uyum yükümlülüklerinin yerine getirilmesi amacıyla işlenir.
              </p>
              <p className="font-semibold text-foreground">4. Veri Aktarımı</p>
              <p>
                Kişisel verileriniz, kanuni yükümlülüklerin yerine getirilmesi amacıyla yetkili kamu kurum ve kuruluşları 
                haricinde üçüncü taraflarla paylaşılmamaktadır. Sağlık verileriniz yalnızca başvurunuzu inceleyen 
                ilgili uzman hekim ve tıbbi sekreterler tarafından görülebilir.
              </p>
              <p className="font-semibold text-foreground">5. İlgili Kişi Hakları</p>
              <p>
                KVKK 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, 
                düzeltilmesini veya silinmesini isteme haklarına sahipsiniz. Başvurularınızı Üniversite veri sorumlusu 
                temsilcisine yazılı olarak iletebilirsiniz.
              </p>
            </>
          )}
        </div>
        
        <div className="flex flex-col gap-2 border-t px-6 py-4 bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {!hasScrolledToBottom ? "Lütfen onaylamak için metni sonuna kadar okuyun." : "Metni okudunuz, onaylayabilirsiniz."}
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Kapat</Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => {
                onAccept();
                onClose();
              }}
              disabled={!hasScrolledToBottom}
            >
              Okudum, Onaylıyorum
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
