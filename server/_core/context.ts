import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  
  try {
    const parsed = parseCookieHeader(cookieHeader);
    for (const [key, value] of Object.entries(parsed)) {
      if (value) cookies.set(key, value);
    }
  } catch (error) {
    // Invalid cookie header, return empty map
  }
  
  return cookies;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Check if there's a session cookie before attempting authentication
  // This prevents dev mode from auto-creating a user after logout
  const cookies = parseCookies(opts.req.headers.cookie);
  const sessionCookie = cookies.get(COOKIE_NAME);

  // Only attempt authentication if there's a cookie
  // This ensures that after logout, we return null instead of auto-creating a dev user
  if (sessionCookie) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
