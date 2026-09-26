import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, Linking } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { env } from "../../config/env";
import { watchAccount } from "../../lib/monitoring";
import { supabase } from "../../lib/supabase";

export type Account = { id: string; email: string };

/** What a sign-up ended as — the two are not the same screen afterwards. */
export type SignUpResult = "signed-in" | "confirm-email";

type AuthContextValue = {
  /** `undefined` while the stored session is being read from the device. */
  account: Account | null | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /**
   * Erases the account and everything hanging off it. Irreversible.
   *
   * The password is asked for again and checked against the server: this is one
   * tap away from the map, and a borrowed phone should not be enough.
   */
  deleteAccount: (password: string) => Promise<void>;

  /** Sends the link that lets a forgotten password be replaced. */
  sendReset: (email: string) => Promise<void>;
  /**
   * True from the moment a recovery link is opened until a new password is
   * written. The app shows one screen and one only while it holds.
   */
  recovering: boolean;
  /** Writes the new password and ends the recovery. */
  setPassword: (password: string) => Promise<void>;
};

/**
 * Where the recovery link comes back to.
 *
 * Built from the running variant's own scheme, never written out: three
 * applications can sit side by side on one phone — production, test,
 * development — and a link must reopen the one that asked for it, not
 * whichever iOS picks first.
 *
 * **Each scheme has to be listed in the Supabase dashboard**, under
 * Authentication → URL Configuration → Redirect URLs, or the server quietly
 * sends the reader to the project's site instead.
 */
const RETURN_TO = `${env.scheme}://reset`;

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Who is signed in, and the three ways that changes.
 *
 * It owns nothing else: the collection is loaded by `EventsProvider`, which is
 * mounted under this one and keyed on the account, so switching accounts
 * rebuilds it from nothing rather than leaving one reader's events on another
 * reader's map.
 *
 * Errors are thrown rather than swallowed. The screens raising them have a
 * dialogue to say what happened; a provider has only the console.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const client = supabase();
    let alive = true;

    void client.auth.getSession().then(({ data }) => {
      if (alive) setAccount(toAccount(data.session));
    });

    // Fires for sign-in, sign-out, and every silent token refresh — which is
    // why the whole state is derived from it rather than set by the callers.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const who = toAccount(session);
      setAccount(who);
      // So a crash report can say "the same reader, four times" without ever
      // saying who that reader is.
      watchAccount(who?.id ?? null);
    });

    /**
     * The token only renews while the app is in front.
     *
     * supabase-js runs a timer; a backgrounded app has none. Told when to stop
     * and start, it refreshes on return instead of waking to an expired
     * session and a screen full of empty lists.
     */
    const watching = AppState.addEventListener("change", (state) => {
      if (state === "active") void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    if (AppState.currentState === "active") void client.auth.startAutoRefresh();

    return () => {
      alive = false;
      data.subscription.unsubscribe();
      watching.remove();
    };
  }, []);

  /**
   * The recovery link, read by hand.
   *
   * `detectSessionInUrl` is for a browser; here the link arrives through the
   * operating system, either while the app is running or as the very thing
   * that launched it — so both are listened for. The code is exchanged for a
   * session, and `recovering` then keeps the reader on the one screen that
   * matters until they have chosen a password. Signing them straight into the
   * map would leave them with a session and no way to know what their password
   * is.
   */
  useEffect(() => {
    const open = async (url: string | null) => {
      if (!url || !url.startsWith(RETURN_TO)) return;
      const query = new URL(url).searchParams;

      const failed = query.get("error_description") ?? query.get("error");
      if (failed) {
        console.warn("Lien de réinitialisation refusé :", failed);
        return;
      }

      const code = query.get("code");
      if (!code) return;

      const { error } = await supabase().auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("Lien de réinitialisation expiré :", error.message);
        return;
      }
      setRecovering(true);
    };

    void Linking.getInitialURL().then(open);
    const listening = Linking.addEventListener("url", (event) => void open(event.url));
    return () => listening.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(translate(error.message));
  }, []);

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const { data, error } = await supabase().auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(translate(error.message));
      // No session means the project asks for the address to be confirmed
      // first. The screen says so rather than pretending to have signed in.
      return data.session ? "signed-in" : "confirm-email";
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase().auth.signOut();
    if (error) throw new Error(translate(error.message));
    // Leaving mid-recovery is a way out of it, not a way to skip it.
    setRecovering(false);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const client = supabase();
    const { data } = await client.auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new Error("Session expirée — reconnectez-vous.");

    // Proof it is really them, and not a phone left on a table.
    const { error: refused } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (refused) throw new Error(translate(refused.message));

    const { error } = await client.rpc("delete_own_account");
    if (error) throw new Error(translate(error.message));

    // Locally, and on purpose: the account no longer exists, so a server-side
    // sign-out would be answered by a session that is already void.
    await client.auth.signOut({ scope: "local" });
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RETURN_TO,
    });
    if (error) throw new Error(translate(error.message));
  }, []);

  const setPassword = useCallback(async (password: string) => {
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw new Error(translate(error.message));
    setRecovering(false);
  }, []);

  const value = useMemo(
    () => ({
      account,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      sendReset,
      recovering,
      setPassword,
    }),
    [account, signIn, signUp, signOut, deleteAccount, sendReset, recovering, setPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider");
  return value;
}

function toAccount(session: Session | null): Account | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? "" };
}

/**
 * Supabase answers in English, and in the language of its own internals.
 *
 * Only the handful a reader can actually meet is translated; anything else is
 * passed through, since a message nobody expected is more useful verbatim than
 * rewritten into a guess.
 */
function translate(message: string): string {
  const said = message.toLowerCase();
  if (said.includes("invalid login credentials")) {
    return "Adresse ou mot de passe incorrect.";
  }
  if (said.includes("email not confirmed")) {
    return "Cette adresse n'a pas encore été confirmée. Ouvrez le lien reçu par courriel.";
  }
  if (said.includes("user already registered")) {
    return "Un compte existe déjà avec cette adresse.";
  }
  if (said.includes("is invalid")) {
    return "Cette adresse est refusée. Vérifiez-la, ou essayez-en une autre.";
  }
  if (said.includes("new password should be different")) {
    return "Choisissez un mot de passe différent de l'ancien.";
  }
  if (said.includes("password should be")) {
    return "Mot de passe trop court pour ce projet.";
  }
  if (said.includes("rate limit") || said.includes("too many")) {
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  if (said.includes("network") || said.includes("fetch")) {
    return "Pas de réseau. Vérifiez la connexion et réessayez.";
  }
  return message;
}
