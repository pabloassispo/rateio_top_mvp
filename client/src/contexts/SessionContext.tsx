import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

// Define User type locally to avoid import issues
type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  password: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type SessionContextType = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = "rateio_session_user";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data from server
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    enabled: true,
  });

  const utils = trpc.useUtils();

  // Update user state when query data changes
  useEffect(() => {
    if (meQuery.data) {
      // Always update user state with fresh data from server
      setUser(meQuery.data);
      if (typeof window !== "undefined") {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(meQuery.data));
      }
    } else if (meQuery.isError || (meQuery.data === null && !meQuery.isLoading)) {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    
    if (!meQuery.isLoading && !meQuery.isFetching) {
      setLoading(false);
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, meQuery.isFetching]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await utils.auth.me.invalidate();
    const result = await meQuery.refetch();
    if (result.data) {
      setUser(result.data);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [utils, meQuery]);

  const clear = useCallback(() => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  // Sync localStorage with user state
  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [user]);

  const value: SessionContextType = {
    user,
    loading: loading || meQuery.isLoading,
    isAuthenticated: Boolean(user),
    refresh,
    clear,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

