import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect } from "react";
import { useSession } from "@/contexts/SessionContext";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const isDevMode = import.meta.env.VITE_DEV_MODE === "true";
  const loginUrl = isDevMode ? "/login" : getLoginUrl();
  const { redirectOnUnauthenticated = false, redirectPath = loginUrl } =
    options ?? {};
  
  const { user, loading, isAuthenticated, refresh, clear } = useSession();
  const utils = trpc.useUtils();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      clear();
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Already logged out, just redirect
        clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return;
      }
      throw error;
    } finally {
      clear();
      await utils.auth.me.invalidate();
      
      // Always redirect to login page after logout, even in dev mode
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, [logoutMutation, utils, clear]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading || logoutMutation.isPending) return;
    if (user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    loading,
    user,
  ]);

  return {
    user,
    loading: loading || logoutMutation.isPending,
    error: logoutMutation.error ?? null,
    isAuthenticated,
    refresh,
    logout,
  };
}
