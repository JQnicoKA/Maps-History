import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "./AuthProvider";
import {
  ConfirmDialog,
  GlyphButton,
  InkButton,
  Sheet,
  useNotice,
} from "../../components/ui";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

/**
 * The account, on the map: an initial in a disc, and what can be done with it.
 *
 * Signing out is confirmed, not because it destroys anything, but because it is
 * one tap away from the buttons that shape the map and the way back costs a
 * password.
 */
export function AccountButton() {
  const { account, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { say, dialog } = useNotice();

  if (!account) return null;
  const initial = (account.email.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <GlyphButton accessibilityLabel="Votre compte" onPress={() => setOpen(true)}>
        <Text style={styles.initial}>{initial}</Text>
      </GlyphButton>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Votre compte"
        footer={
          <InkButton
            label="Fermer"
            variant="solid"
            grow
            onPress={() => setOpen(false)}
          />
        }
      >
        {dialog}

        <ConfirmDialog
          visible={leaving}
          title="Se déconnecter ?"
          message="Votre collection reste sur le serveur ; il faudra ce mot de passe pour la retrouver."
          confirmLabel="Se déconnecter"
          onConfirm={() => {
            setLeaving(false);
            setOpen(false);
            void signOut().catch((cause: unknown) =>
              say(
                "Déconnexion impossible",
                cause instanceof Error ? cause.message : String(cause),
              ),
            );
          }}
          onClose={() => setLeaving(false)}
        />

        <View style={styles.body}>
          <View style={styles.identity}>
            <View style={styles.disc}>
              <Text style={styles.discInitial}>{initial}</Text>
            </View>
            <View style={styles.who}>
              <Text style={styles.email} numberOfLines={1}>
                {account.email}
              </Text>
              <Text style={styles.note}>
                Événements, classeurs, personnages et arbres sont attachés à ce
                compte.
              </Text>
            </View>
          </View>

          <InkButton
            label="Se déconnecter"
            variant="solid"
            tone="danger"
            onPress={() => setLeaving(true)}
          />
        </View>
      </Sheet>
    </>
  );
}

const DISC = 48;

const styles = StyleSheet.create({
  initial: { fontSize: 17, fontWeight: "700", color: palette.ink },
  body: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xl },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.sunken,
  },
  discInitial: { fontSize: 20, fontWeight: "700", color: palette.inkSoft },
  who: { flex: 1, gap: 2 },
  email: { ...type.body, fontWeight: "700", color: palette.ink },
  note: { ...type.caption, color: palette.inkFaint },
});
