import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, schoolLandingPath, setUnauthorizedHandler, type User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    accountType: "school" | "methodist",
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  impersonateSchool: (schoolId: number) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function redirectToAuth() {
  if (window.location.pathname.startsWith("/auth")) {
    return;
  }
  window.location.assign("/auth");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: currentUser } = await api.me();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      redirectToAuth();
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      accountType: "school" | "methodist",
    ) => {
      const { user: loggedInUser } = await api.login(email, password, accountType);
      setUser(loggedInUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // даже если сессия уже протухла — выходим локально
    }
    setUser(null);
  }, []);

  const impersonateSchool = useCallback(async (schoolId: number) => {
    const { user: schoolUser } = await api.impersonateSchool(schoolId);
    setUser(schoolUser);
    window.location.assign(schoolLandingPath(schoolUser));
  }, []);

  const stopImpersonation = useCallback(async () => {
    const { schoolId } = await api.stopImpersonation();
    window.location.assign(`/admin/schools/${schoolId}`);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      impersonateSchool,
      stopImpersonation,
    }),
    [user, loading, login, logout, refresh, impersonateSchool, stopImpersonation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
