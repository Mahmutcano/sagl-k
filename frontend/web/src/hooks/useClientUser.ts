"use client";

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/api";

/** sessionStorage is unavailable during SSR — read auth user only after mount. */
export function useClientUser() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return user;
}
