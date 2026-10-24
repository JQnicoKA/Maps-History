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
import { TERMS_VERSION } from "../../config/contact";
import { watchAccount } from "../../lib/monitoring";
import { signInWith, type SocialProvider } from "./social";
import { supabase } from "../../lib/supabase";

export type Account = {
  id: string;
  email: string;
  /**
   * A-t-il un mot de passe ?
   *
   * Faux pour qui est entré par Apple, Google ou Facebook et n'a jamais rien
   * choisi. Deux écrans en dépendent : on ne propose pas de **changer** un mot
   * de passe qui n'existe pas, et la suppression ne peut pas en demander un
   * comme preuve. Lu sur les identités que Supabase attache à la session — la
   * liste dit exactement par quelles portes ce compte peut s'ouvrir.
   */
  hasPassword: boolean;
  /** Les fournisseurs rattachés : `email`, `apple`, `google`, `facebook`. */
  providers: string[];
};

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
  /**
   * Efface le compte et tout ce qu'il contient.
   *
   * `password` vaut `null` pour un compte sans mot de passe — ouvert par
   * Apple, Google ou Facebook. La preuve d'identité passe alors par la feuille
   * du fournisseur, et `"cancelled"` dit qu'elle a été refermée : ce n'est pas
   * un échec, c'est une hésitation, et le compte est intact.
   */
  /**
   * `before` tourne **entre la preuve et l'effacement**, et c'est tout
   * l'intérêt de le passer ici.
   *
   * La page du compte y vide le seau de photos, parce que les lignes
   * disparaissent en cascade avec le compte mais pas les fichiers. L'appeler
   * elle-même avant `deleteAccount` l'aurait fait passer **avant la preuve** :
   * quelqu'un qui referme la feuille de son fournisseur aurait gardé son
   * compte et perdu ses photos.
   */
  deleteAccount: (
    password: string | null,
    before?: () => Promise<void>,
  ) => Promise<"deleted" | "cancelled">;
  /**
   * Replaces the password of the account already signed in.
   *
   * The current one is asked for and checked: a session on this phone is not
   * proof of who is holding it, and a password that can be changed without
   * knowing the old one is a password anybody who borrows the phone owns.
   */
  changePassword: (current: string, next: string) => Promise<void>;

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

      // Written now rather than trusted to the screen: the box is a fact
      // about a form, this is a fact about an account, and it is the one
      // that outlives a rewritten screen. Best effort — a sign-up must not
      // fail because a second write did.
      const id = data.user?.id;
      if (id) {
        await supabase()
          .from("profiles")
          .update({
            terms_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
          })
          .eq("user_id", id);
      }

      // No session means the project asks for the address to be confirmed
      // first. The screen says so rather than pretending to have signed in.
      return data.session ? "signed-in" : "confirm-email";
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase().auth.signOut();
    if (error) throw new Error(translate(error.message));
    /* Rien à oublier côté fournisseur : Google et Facebook passent par le
       navigateur du système, dont les cookies ne nous appartiennent pas et
       qu'il serait malvenu de vider — le lecteur y est connecté pour ses
       autres usages. Qui veut changer de compte le fait dans la feuille, qui
       propose toujours le choix. */
    // Leaving mid-recovery is a way out of it, not a way to skip it.
    setRecovering(false);
  }, []);

  const deleteAccount = useCallback(async (
    password: string | null,
    before?: () => Promise<void>,
  ) => {
    const client = supabase();
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user) throw new Error("Session expirée — reconnectez-vous.");

    /* Proof it is really them, and not a phone left on a table.
       ====================================================================
       Un compte ouvert par Apple, Google ou Facebook **n'a pas de mot de
       passe** à redemander. La preuve passe alors par la même porte que
       l'inscription : on rouvre la feuille du fournisseur, et c'est elle qui
       répond de l'identité. Refermer cette feuille annule la suppression
       plutôt que de la faire échouer — on ne perd pas son compte pour avoir
       hésité. */
    if (password === null) {
      const social = (user.identities ?? [])
        .map((one) => one.provider)
        .find(
          (one): one is SocialProvider =>
            one === "apple" || one === "google" || one === "facebook",
        );
      if (!social) {
        throw new Error("Impossible de vérifier votre identité.");
      }
      if ((await signInWith(social)) === "cancelled") return "cancelled";
    } else {
      const email = user.email;
      if (!email) throw new Error("Session expirée — reconnectez-vous.");
      const { error: refused } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (refused) throw new Error(translate(refused.message));
    }

    /* L'identité est prouvée : ce qui suit n'est plus annulable, et c'est
       maintenant seulement qu'on touche à quoi que ce soit. */
    await before?.();

    const { error } = await client.rpc("delete_own_account");
    if (error) throw new Error(translate(error.message));

    // Locally, and on purpose: the account no longer exists, so a server-side
    // sign-out would be answered by a session that is already void.
    await client.auth.signOut({ scope: "local" });
    return "deleted";
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    const client = supabase();
    const { data } = await client.auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new Error("Session expirée — reconnectez-vous.");

    // The same proof the deletion asks for, and for the same reason. It also
    // hands back a fresh session, which is what `updateUser` then writes to.
    const { error: refused } = await client.auth.signInWithPassword({
      email,
      password: current,
    });
    if (refused) {
      // `translate` would say "adresse ou mot de passe incorrect", and the
      // address is not in question here — the reader typed only one thing.
      throw new Error(
        refused.message.toLowerCase().includes("invalid login credentials")
          ? "Mot de passe actuel incorrect."
          : translate(refused.message),
      );
    }

    const { error } = await client.auth.updateUser({ password: next });
    if (error) throw new Error(translate(error.message));
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
      changePassword,
      sendReset,
      recovering,
      setPassword,
    }),
    [
      account,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      changePassword,
      sendReset,
      recovering,
      setPassword,
    ],
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
  const providers = (session.user.identities ?? []).map((one) => one.provider);
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    hasPassword: providers.includes("email"),
    providers,
  };
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
