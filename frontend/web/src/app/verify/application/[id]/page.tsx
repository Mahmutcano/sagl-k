"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function VerifyPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const apiURL = `/api/v1/public/applications/${params.id}/verify?code=${code}`;

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg border overflow-hidden flex flex-col h-[90vh]">
        <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold">Erciyes Üniversitesi Tıp Fakültesi</h1>
            <p className="text-xs text-primary-foreground/80 font-medium">Tıbbi Danışmanlık · Evrak Doğrulama Sistemi</p>
          </div>
          <span className="text-xs bg-white/20 px-2.5 py-1 rounded font-mono font-semibold">GÜVENLİ ELEKTRONİK BELGE</span>
        </div>
        <div className="flex-1 w-full bg-white relative">
          <iframe
            src={apiURL}
            title="Doğrulama Önizleme"
            className="w-full h-full border-none"
          />
        </div>
        <div className="bg-slate-50 border-t px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Bu belge 5070 Sayılı Elektronik İmza Kanununa göre güvenli elektronik imza ile kayıt altına alınmıştır.
          </p>
          <Button variant="outline" size="sm" type="button" onClick={() => window.print()} className="cursor-pointer font-semibold shadow-sm hover:shadow-md transition-all">
            Yazdır / PDF Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}
