/**
 * Canonical phone storage:
 * - phone_country_code: "+90" (always with leading +)
 * - phone_number: national digits only, no leading 0, no country code
 *   e.g. TR → "5321234567"
 *
 * Never store mixed formats in DB.
 */

export type PhoneCountry = {
  code: string; // ISO 3166-1 alpha-2
  dial: string; // e.g. "+90"
  name: string;
  flag: string;
  nationalLength?: { min: number; max: number };
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "TR", dial: "+90", name: "Türkiye", flag: "🇹🇷", nationalLength: { min: 10, max: 10 } },
  { code: "DE", dial: "+49", name: "Almanya", flag: "🇩🇪", nationalLength: { min: 6, max: 13 } },
  { code: "GB", dial: "+44", name: "Birleşik Krallık", flag: "🇬🇧", nationalLength: { min: 7, max: 11 } },
  { code: "US", dial: "+1", name: "ABD", flag: "🇺🇸", nationalLength: { min: 10, max: 10 } },
  { code: "NL", dial: "+31", name: "Hollanda", flag: "🇳🇱", nationalLength: { min: 8, max: 10 } },
  { code: "FR", dial: "+33", name: "Fransa", flag: "🇫🇷", nationalLength: { min: 9, max: 9 } },
  { code: "AZ", dial: "+994", name: "Azerbaycan", flag: "🇦🇿", nationalLength: { min: 9, max: 10 } },
  { code: "SY", dial: "+963", name: "Suriye", flag: "🇸🇾", nationalLength: { min: 8, max: 10 } },
  { code: "IQ", dial: "+964", name: "Irak", flag: "🇮🇶", nationalLength: { min: 8, max: 10 } },
  { code: "IR", dial: "+98", name: "İran", flag: "🇮🇷", nationalLength: { min: 8, max: 11 } },
  { code: "RU", dial: "+7", name: "Rusya", flag: "🇷🇺", nationalLength: { min: 10, max: 10 } },
  { code: "SA", dial: "+966", name: "Suudi Arabistan", flag: "🇸🇦", nationalLength: { min: 8, max: 10 } },
  { code: "AE", dial: "+971", name: "BAE", flag: "🇦🇪", nationalLength: { min: 8, max: 10 } },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** National number for DB: strip leading zeros, no country code. */
export function normalizeNationalNumber(value: string, dial = "+90"): string {
  let v = digitsOnly(value);
  const dialDigits = digitsOnly(dial);
  if (dialDigits && v.startsWith(dialDigits) && v.length > dialDigits.length + 4) {
    v = v.slice(dialDigits.length);
  }
  while (v.startsWith("0")) v = v.slice(1);
  return v;
}

export function toE164(countryDial: string, nationalNumber: string): string {
  const dial = countryDial.startsWith("+") ? countryDial : `+${countryDial}`;
  const national = normalizeNationalNumber(nationalNumber, dial);
  return `${dial}${national}`;
}

/** Format national digits for input display (TR-friendly grouping). */
export function formatNationalInput(value: string, dial = "+90"): string {
  const v = normalizeNationalNumber(value, dial).slice(0, 15);
  if (dial === "+90") {
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.slice(0, 3)} ${v.slice(3)}`;
    if (v.length <= 8) return `${v.slice(0, 3)} ${v.slice(3, 6)} ${v.slice(6)}`;
    return `${v.slice(0, 3)} ${v.slice(3, 6)} ${v.slice(6, 8)} ${v.slice(8, 10)}`;
  }
  return v;
}

export function formatPhoneDisplay(countryDial: string, nationalNumber: string): string {
  const dial = countryDial.startsWith("+") ? countryDial : `+${countryDial}`;
  const national = formatNationalInput(nationalNumber, dial);
  return `${dial} ${national}`.trim();
}

export function validateNationalPhone(
  countryDial: string,
  nationalNumber: string
): string | null {
  const country =
    PHONE_COUNTRIES.find((c) => c.dial === countryDial) ?? DEFAULT_PHONE_COUNTRY;
  const v = normalizeNationalNumber(nationalNumber, country.dial);
  if (!v) return "Telefon numarası zorunludur.";
  const { min = 6, max = 15 } = country.nationalLength ?? {};
  if (v.length < min || v.length > max) {
    return `Telefon numarası ${min === max ? `${min}` : `${min}–${max}`} haneli olmalıdır.`;
  }
  if (country.dial === "+90" && !/^5\d{9}$/.test(v)) {
    return "Türkiye için numara 5XX XXX XX XX formatında 10 haneli olmalıdır.";
  }
  return null;
}

/** @deprecated use normalizeNationalNumber — kept for gradual migration */
export function normalizePhoneTR(value: string): string {
  return normalizeNationalNumber(value, "+90");
}

/** @deprecated use validateNationalPhone */
export function validatePhoneTR(value: string): string | null {
  return validateNationalPhone("+90", value);
}
