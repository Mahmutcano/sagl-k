export type CountryOption = {
  code: string;
  name: string;
  nameEn: string;
  flag: string;
  dial: string;
};

let cache: CountryOption[] | null = null;

export async function loadCountries(): Promise<CountryOption[]> {
  if (cache) return cache;
  const res = await fetch("/data/countries.json");
  if (!res.ok) throw new Error("countries load failed");
  const data = (await res.json()) as CountryOption[];
  cache = data;
  return data;
}

export function searchCountries(list: CountryOption[], query: string): CountryOption[] {
  const q = query.trim().toLocaleLowerCase("tr-TR");
  if (!q) return list;
  return list.filter((c) => {
    const hay = `${c.name} ${c.nameEn} ${c.code} ${c.dial}`.toLocaleLowerCase("tr-TR");
    return hay.includes(q);
  });
}

export const DEFAULT_COUNTRY_CODE = "TR";
export const DEFAULT_DIAL = "+90";
