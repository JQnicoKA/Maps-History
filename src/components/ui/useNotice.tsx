import { useCallback, useState, type ReactNode } from "react";

import { Dialog } from "./Dialog";

export type Notice = { title: string; message?: string };

export type NoticeHandle = {
  /** Says something and waits to be dismissed. */
  say: (title: string, message?: string) => void;
  /** Drop this inside the sheet or modal it belongs to — see below. */
  dialog: ReactNode;
};

/**
 * The app's own way of saying "that did not work".
 *
 * Every one of these used to be a system alert: a grey card in another
 * typeface, landing on a hand-coloured map. The message is unchanged — only who
 * draws it — and the call site barely moves: `Alert.alert(a, b)` becomes
 * `say(a, b)`.
 *
 * A hook rather than a component because the dialogue has to be **rendered
 * inside the sheet that raises it**. iOS will not present a second modal from a
 * controller already presenting one, so a notice mounted at the root of the app
 * would never appear over an open sheet. Holding the state here and handing
 * back the element keeps that one line in the caller honest.
 */
export function useNotice(): NoticeHandle {
  const [notice, setNotice] = useState<Notice | null>(null);

  const say = useCallback((title: string, message?: string) => {
    setNotice({ title, message });
  }, []);

  return {
    say,
    dialog: (
      <Dialog
        visible={notice !== null}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ""}
        hint={notice?.message}
        dismissLabel="Fermer"
      >
        {null}
      </Dialog>
    ),
  };
}
