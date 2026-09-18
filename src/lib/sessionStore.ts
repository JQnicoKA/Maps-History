import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Where the session lives between launches.
 *
 * Supabase writes the access and refresh tokens through this; without it the
 * reader is signed out every time the app is closed. `AsyncStorage` is the
 * store its own React Native guide uses.
 *
 * **Every call is guarded, and a failure is not an error.** The store is a
 * native module: until the app is rebuilt with it, or in a preview that never
 * had it, the calls throw. Falling back to memory means the app still runs and
 * still signs in — it simply forgets when it is closed, which is the old
 * behaviour rather than a crash.
 */
const memory = new Map<string, string>();

let native: typeof AsyncStorage | null = AsyncStorage;

function giveUp(cause: unknown): void {
  if (native === null) return;
  native = null;
  console.warn(
    "Session persistence is off: AsyncStorage is unavailable in this build " +
      "(rebuild the app to enable it).",
    cause,
  );
}

export const sessionStore = {
  async getItem(key: string): Promise<string | null> {
    if (native) {
      try {
        return await native.getItem(key);
      } catch (cause) {
        giveUp(cause);
      }
    }
    return memory.get(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
    if (!native) return;
    try {
      await native.setItem(key, value);
    } catch (cause) {
      giveUp(cause);
    }
  },

  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    if (!native) return;
    try {
      await native.removeItem(key);
    } catch (cause) {
      giveUp(cause);
    }
  },
};
