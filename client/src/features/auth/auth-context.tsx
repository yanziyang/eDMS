import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAccessToken } from "@/lib/api-client";
import type { CurrentUserDto } from "@/types/api";
import * as authApi from "./api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: CurrentUserDto | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: async (email, password) => {
        const response = await authApi.login(email, password);
        setAccessToken(response.accessToken);
        setUser(response.user);
        setStatus("authenticated");
      },
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // The local session is cleared regardless of whether the server call succeeded.
        } finally {
          setAccessToken(null);
          setUser(null);
          setStatus("unauthenticated");
        }
      },
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
