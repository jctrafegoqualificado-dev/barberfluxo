import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthUser } from "@/types";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  refreshAuth: () => Promise<boolean>;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Retorna quantos segundos faltam para o token expirar (negativo = já expirou)
function tokenSecondsLeft(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number"
      ? Math.floor((payload.exp * 1000 - Date.now()) / 1000)
      : -1;
  } catch {
    return -1;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),

      // Renova o token silenciosamente se faltar < 2h para expirar
      // Retorna true se renovou, false se não precisou, lança se falhou
      refreshAuth: async () => {
        const { token } = get();
        if (!token) return false;
        const secondsLeft = tokenSecondsLeft(token);
        // Só renova se faltar menos de 2 horas (7200s) e o token ainda for válido
        if (secondsLeft > 7200 || secondsLeft <= 0) return false;

        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return false;
        const { token: newToken } = await res.json();
        if (newToken) {
          set({ token: newToken });
          return true;
        }
        return false;
      },
    }),
    {
      name: "iadebarbearia-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.clearAuth();
        }
      },
    }
  )
);
