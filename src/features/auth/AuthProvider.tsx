import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";

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
};

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

  useEffect(() => {
    const client = supabase();
    let alive = true;

    void client.auth.getSession().then(({ data }) => {
      if (alive) setAccount(toAccount(data.session));
    });

    // Fires for sign-in, sign-out, and every silent token refresh — which is
    // why the whole state is derived from it rather than set by the callers.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setAccount(toAccount(session));
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

  const value = useMemo(
    () => ({ account, signIn, signUp, signOut, deleteAccount }),
    [account, signIn, signUp, signOut, deleteAccount],
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
