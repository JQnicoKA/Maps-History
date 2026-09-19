import * as Sentry from "@sentry/react-native";

import { env } from "../config/env";

/**
 * Where a crash goes to be seen.
 *
 * Without this, a bug on somebody else's phone is a bug that never existed: no
 * screen, no log, nothing but a reader who stops using the app. What is sent is
 * the exception and where it happened — never what is in it.
 *
 * **Nothing personal travels.** The account's identifier is attached so that
 * "one reader hit this forty times" can be told from "forty readers hit it
 * once", but the address behind it stays here. Sentry cannot say who anyone is,
 * only that they are the same someone.
 */
export function startMonitoring(): void {
  if (!env.hasSentry) return;

  Sentry.init({
    dsn: env.sentryDsn,
    // Errors only. Performance tracing is a separate quota, and a map that
    // draws itself sixty times a second would fill it in an afternoon.
    tracesSampleRate: 0,
    // Never the email, never the IP: the identifier below is enough to count
    // readers, and it is all this app is willing to say about them.
    sendDefaultPii: false,
    environment: __DEV__ ? "development" : "production",
  });
}

/** Ties the reports that follow to one account — pseudonymously. */
export function watchAccount(id: string | null): void {
  if (!env.hasSentry) return;
  Sentry.setUser(id === null ? null : { id });
}

/**
 * Reports something the app caught and recovered from.
 *
 * An error that reaches the boundary has already been shown to the reader; this
 * is how it also reaches whoever can fix it.
 */
export function report(error: unknown, context?: Record<string, unknown>): void {
  if (!env.hasSentry) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
