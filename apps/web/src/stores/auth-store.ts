import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User) => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      async login(email: string, password: string) {
        const data = await apiClient.post<LoginResponse>(
          '/api/auth/login',
          { email, password },
        );

        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      },

      async register(
        displayName: string,
        email: string,
        password: string,
      ) {
        await apiClient.post<RegisterResponse>('/api/auth/register', {
          displayName,
          email,
          password,
        });
      },

      logout() {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        });
      },

      setTokens(tokens: AuthTokens) {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      },

      setUser(user: User) {
        set({ user });
      },

      isAuthenticated() {
        return get().accessToken !== null && get().user !== null;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
