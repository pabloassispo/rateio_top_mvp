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
  cpf: string | null;
  contato: string | null;
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
  clear: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = "rateio_session_user";

export function SessionProvider({ children }: { children: ReactNode }) {
  // Try to restore user from localStorage initially (optimistic)
  const [initialUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(true);

  // Fetch user data from server
  // Always refetch on mount and window focus to ensure fresh state
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always consider data stale to force refetch
    enabled: true,
    // Use initial data from localStorage for optimistic rendering
    initialData: initialUser || undefined,
  });

  const utils = trpc.useUtils();

  // Update user state when query data changes
  useEffect(() => {
    const isLoading = meQuery.isLoading || meQuery.isFetching;
    
    // Update loading state
    setLoading(isLoading);

    // Update user state based on query result
    if (!isLoading) {
      // Query has finished - update state based on result
      if (meQuery.data) {
        // User is authenticated
        setUser(meQuery.data);
        if (typeof window !== "undefined") {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(meQuery.data));
        }
      } else {
        // User is not authenticated (null or error)
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } else if (meQuery.data) {
      // Still loading but we have cached data - use it optimistically
      setUser(meQuery.data);
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, meQuery.isFetching]);

  // Don't restore from localStorage - always rely on server response
  // This ensures that if cookie is cleared, state is also cleared

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

  const clear = useCallback(async () => {
    // Clear user state immediately
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    // Clear tRPC cache and reset query to null
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
    // Reset query to force fresh fetch on next access
    utils.auth.me.reset();
    // Force refetch to ensure fresh state (this will return null if not authenticated)
    await meQuery.refetch();
  }, [utils, meQuery]);

  // Sync localStorage with user state (only when user exists from server)
  // Don't restore from localStorage to avoid stale data after logout
  useEffect(() => {
    if (user && meQuery.data) {
      // Only sync if we have valid data from server
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else if (!meQuery.isLoading && !meQuery.isFetching) {
      // Clear localStorage when we know user is not authenticated
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [user, meQuery.data, meQuery.isLoading, meQuery.isFetching]);

  const value: SessionContextType = {
    user,
    loading: loading || meQuery.isLoading || meQuery.isFetching,
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

