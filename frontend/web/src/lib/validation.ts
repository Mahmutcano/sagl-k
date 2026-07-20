/**
 * Client-side validation mirroring backend/internal/pkg/validate.
 * Every rule returns a Turkish explanation for inline field feedback.
 */

import {
  normalizeNationalNumber,
  validateNationalPhone,
} from "@/lib/phone";
import { isTurkishNationality, validatePassportNumber } from "@/lib/nationality";

export type FieldError = {
  field: string;
  code: string;
  message: string;
};

export type FieldErrors = Record<string, string>;

function charCount(s: string): number {
  return Array.from(s).length;
}

export function errorsToMap(fields: FieldError[]): FieldErrors {
  const map: FieldErrors = {};
  for (const f of fields) {
    if (!map[f.field]) map[f.field] = f.message;
  }
  return map;
}

function digitsOnly(s: string) {
  return /^\d+$/.test(s);
}

function isValidTCKN(s: string): boolean {
  if (!digitsOnly(s) || s.length !== 11 || s[0] === "0") return false;
  const d = s.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  let d10 = ((odd * 7) - even) % 10;
  if (d10 < 0) d10 += 10;
  if (d10 !== d[9]) return false;
  const sum = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sum % 10 === d[10];
}

export function validateNationalId(value: string): string | null {
  const v = value.trim();
  if (!v) return "TC Kimlik Numarası zorunludur.";
  if (!digitsOnly(v) || v.length !== 11)
    return "TC Kimlik Numarası 11 haneli rakamlardan oluşmalıdır.";
  if (v[0] === "0") return "TC Kimlik Numarası 0 ile başlayamaz.";
  if (!isValidTCKN(v))
    return "TC Kimlik Numarası algoritma kontrolünden geçemedi. Lütfen numarayı kontrol edin.";
  return null;
}

export function validatePassword(value: string, opts?: { required?: boolean }): string | null {
  const required = opts?.required !== false;
  if (!value) return required ? "Şifre zorunludur." : null;
  if (value.length < 8) return "Şifre en az 8 karakter olmalıdır.";
  if (value.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value))
    return "Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.";
  return null;
}

/** Login password: required but no complexity (existing accounts may be weaker). */
export function validateLoginPassword(value: string): string | null {
  if (!value) return "Şifre zorunludur.";
  if (value.length > 128) return "Şifre çok uzun.";
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "E-posta adresi zorunludur.";
  if (v.length > 254) return "E-posta adresi en fazla 254 karakter olabilir.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return "Geçerli bir e-posta adresi girin (ör. ad@ornek.com).";
  return null;
}

/** Canonical TR national number for DB (no +90, no leading 0). */
export function normalizePhoneTR(value: string): string {
  return normalizeNationalNumber(value, "+90");
}

export function validatePhoneTR(value: string): string | null {
  return validateNationalPhone("+90", value);
}

export { validatePassportNumber, isTurkishNationality };

export function validatePersonName(value: string, label: string): string | null {
  const v = formatPersonName(value);
  if (!v) return `${label} zorunludur.`;
  if (charCount(v) < 2) return `${label} en az 2 karakter olmalıdır.`;
  if (charCount(v) > 80) return `${label} en fazla 80 karakter olabilir.`;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿĞğÜüŞşİıÖöÇç\s'-]+$/.test(v)) {
    return `${label} yalnızca harf, boşluk, tire veya kesme işareti içerebilir.`;
  }
  return null;
}

/** Turkish title-case: AHMET → Ahmet, ayşe → Ayşe */
export function formatPersonName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts
    .map((part) => {
      const chars = Array.from(part);
      if (!chars.length) return "";
      return turkishTitle(chars[0]) + chars.slice(1).map(turkishLower).join("");
    })
    .join(" ");
}

function turkishLower(ch: string): string {
  if (ch === "I") return "ı";
  if (ch === "İ") return "i";
  return ch.toLocaleLowerCase("tr-TR");
}

function turkishTitle(ch: string): string {
  if (ch === "i") return "İ";
  if (ch === "ı") return "I";
  return ch.toLocaleUpperCase("tr-TR");
}

export function validateBirthDate(value: string, opts?: { minAge?: number }): string | null {
  const v = value.trim();
  if (!v) return "Doğum tarihi zorunludur.";
  const t = new Date(v + "T00:00:00");
  if (Number.isNaN(t.getTime())) return "Doğum tarihi YYYY-MM-DD formatında olmalıdır.";
  const now = new Date();
  if (t > now) return "Doğum tarihi gelecekte olamaz.";
  let age = now.getFullYear() - t.getFullYear();
  const m = now.getMonth() - t.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < t.getDate())) age--;
  if (age > 120) return "Doğum tarihi geçersiz görünüyor.";
  if (opts?.minAge != null && age < opts.minAge) {
    return opts.minAge === 18
      ? "Kayıt için en az 18 yaşında olmalısınız."
      : `En az ${opts.minAge} yaşında olmalıdır.`;
  }
  return null;
}

export function validateDateOfBirth(value: string): string | null {
  return validateBirthDate(value, { minAge: 18 });
}

export function validateOTP(value: string): string | null {
  const v = value.trim();
  if (!v) return "Doğrulama kodu zorunludur.";
  if (!/^\d{4,8}$/.test(v))
    return "Doğrulama kodu 4–8 haneli rakamlardan oluşmalıdır.";
  return null;
}

export function validateHospitalCode(value: string): string | null {
  const v = value.trim();
  if (!v) return "Hastane kodu zorunludur.";
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(v))
    return "Hastane kodu 2–32 karakter, harf/rakam/tire/alt çizgi olmalıdır.";
  return null;
}

export function validateHospitalName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Hastane adı zorunludur.";
  if (charCount(v) < 2 || charCount(v) > 200)
    return "Hastane adı 2–200 karakter arasında olmalıdır.";
  return null;
}

export function validateRefundAmount(value: number): string | null {
  if (!Number.isFinite(value)) return "İade tutarı sayısal olmalıdır.";
  if (!(value > 0)) return "İade tutarı 0'dan büyük olmalıdır.";
  if (value > 1_000_000) return "İade tutarı üst sınırı aşıyor.";
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    return "İade tutarı en fazla 2 ondalık basamak (kuruş) içerebilir.";
  }
  return null;
}

export function validateRefundAmountAgainstPayment(
  amount: number,
  paymentAmount: number
): string | null {
  const base = validateRefundAmount(amount);
  if (base) return base;
  if (amount > paymentAmount + 1e-9) return "İade tutarı ödeme tutarını aşamaz.";
  return null;
}

export function validateRefundReason(value: string): string | null {
  const v = value.trim();
  if (!v) return "İade nedeni zorunludur.";
  if (charCount(v) < 5) return "İade nedeni en az 5 karakter olmalıdır.";
  if (charCount(v) > 500) return "İade nedeni en fazla 500 karakter olabilir.";
  return null;
}

export function validateMerchantOid(value: string): string | null {
  const v = value.trim();
  if (!v) return "Merchant OID zorunludur.";
  if (charCount(v) < 6 || charCount(v) > 64) {
    return "Merchant OID 6–64 karakter olmalıdır.";
  }
  if (!/^[A-Za-z0-9_-]+$/.test(v)) {
    return "Merchant OID yalnızca harf, rakam, tire veya alt çizgi içerebilir.";
  }
  return null;
}

export function validatePaymentAmount(value: number): string | null {
  if (!Number.isFinite(value)) return "Tutar sayısal olmalıdır.";
  if (value < 1) return "Tutar en az 1.00 TRY olmalıdır.";
  if (value > 1_000_000) return "Tutar üst sınırı aşıyor.";
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    return "Tutar en fazla 2 ondalık basamak (kuruş) içerebilir.";
  }
  return null;
}

export function validateDateYYYYMMDD(value: string, label = "Tarih"): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `${label} YYYY-MM-DD formatında olmalıdır.`;
  }
  const t = new Date(v + "T00:00:00");
  if (Number.isNaN(t.getTime())) return `${label} geçersiz.`;
  return null;
}

export function validatePaymentStatusFilter(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (!["pending", "paid", "failed", "refunded"].includes(v)) {
    return "Durum pending, paid, failed veya refunded olabilir.";
  }
  return null;
}

export type LoginInput = {
  nationalIdentifier: string;
  password: string;
};

export function validateLogin(input: LoginInput): FieldErrors {
  const errors: FieldErrors = {};
  const id = input.nationalIdentifier.trim();
  if (!id) {
    errors.nationalIdentifier = "TC Kimlik No veya pasaport numarası zorunludur.";
  } else if (/^\d{11}$/.test(id)) {
    const nid = validateNationalId(id);
    if (nid) errors.nationalIdentifier = nid;
  } else {
    const pp = validatePassportNumber(id);
    if (pp) errors.nationalIdentifier = pp;
  }
  const pw = validateLoginPassword(input.password);
  if (pw) errors.password = pw;
  return errors;
}

export type RegisterInput = {
  firstName: string;
  lastName: string;
  nationality: string;
  nationalIdentifier: string;
  passportNumber: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: number;
};

export function validateRegister(input: RegisterInput): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = formatPersonName(input.firstName);
  const lastName = formatPersonName(input.lastName);
  const fn = validatePersonName(firstName, "Ad");
  if (fn) errors.firstName = fn;
  const ln = validatePersonName(lastName, "Soyad");
  if (ln) errors.lastName = ln;

  if (!input.nationality?.trim()) {
    errors.nationality = "Uyruk seçiniz.";
  } else if (isTurkishNationality(input.nationality)) {
    const nid = validateNationalId(input.nationalIdentifier);
    if (nid) errors.nationalIdentifier = nid;
  } else {
    const pp = validatePassportNumber(input.passportNumber);
    if (pp) errors.passportNumber = pp;
  }

  const phone = validateNationalPhone(input.phoneCountryCode || "+90", input.phoneNumber);
  if (phone) errors.phoneNumber = phone;

  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const pw = validatePassword(input.password);
  if (pw) errors.password = pw;
  const dob = validateDateOfBirth(input.dateOfBirth);
  if (dob) {
    errors.dateOfBirth =
      dob === "Doğum tarihi zorunludur."
        ? "Doğum tarihi için gün, ay ve yıl seçiniz."
        : dob;
  }
  if (input.gender !== 1 && input.gender !== 2)
    errors.gender = "Cinsiyet 1 (Erkek) veya 2 (Kadın) olmalıdır.";
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export type RepresentedPersonInput = {
  firstName: string;
  lastName: string;
  nationalIdentifier: string;
  birthDate: string;
  gender: number;
};

export function validateRepresentedPerson(
  input: RepresentedPersonInput,
  applicantNationalId?: string | null
): FieldErrors {
  const errors: FieldErrors = {};
  const fn = validatePersonName(input.firstName, "Yakının adı");
  if (fn) errors.firstName = fn;
  const ln = validatePersonName(input.lastName, "Yakının soyadı");
  if (ln) errors.lastName = ln;
  const nid = validateNationalId(input.nationalIdentifier);
  if (nid) errors.nationalIdentifier = nid;
  else if (
    applicantNationalId &&
    input.nationalIdentifier.trim() === applicantNationalId.trim()
  ) {
    errors.nationalIdentifier =
      "Yakının TC Kimlik No başvuranın kimlik numarası ile aynı olamaz.";
  }
  const dob = validateBirthDate(input.birthDate);
  if (dob) errors.birthDate = dob;
  if (input.gender !== 1 && input.gender !== 2)
    errors.gender = "Cinsiyet seçiniz (Erkek veya Kadın).";
  return errors;
}
