import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Dialog } from "./Dialog";
import { palette } from "../../theme/palette";
import { radius, space, type } from "../../theme/tokens";

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
 * Everything it says is a refusal — a title left blank, a save the server
 * turned down — so it is drawn as one: the reason sits in a panel washed in
 * red, behind a rule, under a mark. It read as a neutral note before, which
 * is a poor way to tell somebody their work has not been kept.
 *
 * There is nothing to answer, so there is no button. The cross in the corner
 * closes it, as it closes every other card in the app.
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
        dismissLabel={null}
      >
        <View style={styles.panel}>
          <View style={styles.mark}>
            <Text style={styles.bang}>!</Text>
          </View>
          <Text style={styles.reason}>
            {notice?.message ?? "L'opération n'a pas abouti."}
          </Text>
        </View>
      </Dialog>
    ),
  };
}

const MARK = 26;

const styles = StyleSheet.create({
  /**
   * A washed panel behind a rule, the way a printed page flags a caution.
   *
   * The rule runs the full height on the left rather than a border all round:
   * a boxed message reads as a field to fill in, a ruled one as something
   * being pointed at.
   */
  panel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.danger,
    backgroundColor: palette.dangerWash,
  },
  mark: {
    width: MARK,
    height: MARK,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.danger,
  },
  bang: {
    ...type.plate,
    fontSize: 17,
    lineHeight: 21,
    color: palette.paperLight,
  },
  reason: { ...type.body, flex: 1, color: palette.ink },
});
