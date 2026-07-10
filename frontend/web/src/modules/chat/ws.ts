export function wsBaseUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api) {
    try {
      const u = new URL(api);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      return u.origin;
    } catch {
      return "ws://localhost:8080";
    }
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:8080";
}
