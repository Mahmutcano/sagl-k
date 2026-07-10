export type NationalityOption = {
  code: string; // ISO alpha-2/3 stored in users.nationality
  name: string;
  flag: string;
};

export const NATIONALITIES: NationalityOption[] = [
  { code: "TR", name: "Türkiye", flag: "🇹🇷" },
  { code: "DE", name: "Almanya", flag: "🇩🇪" },
  { code: "GB", name: "Birleşik Krallık", flag: "🇬🇧" },
  { code: "US", name: "Amerika Birleşik Devletleri", flag: "🇺🇸" },
  { code: "NL", name: "Hollanda", flag: "🇳🇱" },
  { code: "FR", name: "Fransa", flag: "🇫🇷" },
  { code: "AZ", name: "Azerbaycan", flag: "🇦🇿" },
  { code: "SY", name: "Suriye", flag: "🇸🇾" },
  { code: "IQ", name: "Irak", flag: "🇮🇶" },
  { code: "IR", name: "İran", flag: "🇮🇷" },
  { code: "RU", name: "Rusya", flag: "🇷🇺" },
  { code: "SA", name: "Suudi Arabistan", flag: "🇸🇦" },
  { code: "AE", name: "Birleşik Arap Emirlikleri", flag: "🇦🇪" },
  { code: "XX", name: "Diğer", flag: "🌍" },
];

export function isTurkishNationality(code: string): boolean {
  return code.toUpperCase() === "TR";
}

export function validatePassportNumber(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (!v) return "Pasaport numarası zorunludur.";
  if (v.length < 5 || v.length > 20) return "Pasaport numarası 5–20 karakter olmalıdır.";
  if (!/^[A-Z0-9]+$/.test(v)) return "Pasaport numarası yalnızca harf ve rakam içermelidir.";
  return null;
}
