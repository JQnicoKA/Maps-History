import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { useHidden } from "./HiddenProvider";
import {
  ConfirmDialog,
  GlyphButton,
  InkButton,
  Roster,
  RosterEmpty,
  RosterRow,
  Sheet,
  useNotice,
} from "../../components/ui";
import { formatYear } from "../events/historicalDate";
import { palette } from "../../theme/palette";
import { space, type } from "../../theme/tokens";

const PENCIL = require("../../../assets/icons/pencil-draw.png");
const TRASH = require("../../../assets/icons/trash.png");
/** Putting a territory back is exactly "show it on the map again". */
const BACK_ON_MAP = require("../../../assets/icons/view-map.png");

export type DrawTerritoryButtonProps = {
  /** Hands the map over to the brush. */
  onDraw: () => void;
};

/**
 * The plate's own panel: what the reader has added to the map, and removed
 * from it.
 *
 * The same sheet as the events and the people, down to the full height and the
 * dashed slot at the top of the list — because it is the same kind of panel. A
 * count, a way to make one more, then the rows. It was a small centred card
 * while it held two buttons; it holds two lists.
 *
 * The button is under the `+` and deliberately apart from it: one adds an
 * event to the collection, the other changes the map the collection is read
 * on. Two different kinds of making.
 */
export function DrawTerritoryButton({ onDraw }: DrawTerritoryButtonProps) {
  const { hidden, show, drawn, erase } = useHidden();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** The drawn territory awaiting a "yes" before it is rubbed out. */
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(
    null,
  );
  const { say, dialog } = useNotice();

  const work = (key: string, deed: Promise<void>, failed: string) => {
    setBusy(key);
    void deed
      .catch((cause: unknown) =>
        say(failed, cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setBusy(null));
  };

  return (
    <>
      <GlyphButton
        accessibilityLabel="Territoires"
        onPress={() => setOpen(true)}
      >
        <Image source={PENCIL} style={styles.glyph} resizeMode="contain" />
      </GlyphButton>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Territoires"
        // Two lists that grow as the reader works; a panel resizing itself
        // around them would never be still.
        tall
        footer={
          <InkButton
            label="Fermer"
            variant="tonal"
            grow
            onPress={() => setOpen(false)}
          />
        }
      >
        {dialog}

        <ConfirmDialog
          visible={asking !== null}
          title={`Effacer « ${asking?.name ?? ""} » ?`}
          message="Il n'existe que sur votre carte : l'effacer est définitif."
          confirmLabel="Effacer"
          onConfirm={() => {
            const target = asking;
            setAsking(null);
            if (target) {
              work(target.id, erase(target.id), "Suppression impossible");
            }
          }}
          onClose={() => setAsking(null)}
        />

        <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
          <Text style={styles.lead}>
            Ce que vous avez ajouté à la carte, et ce que vous en avez retiré.
          </Text>

          <Roster
            count={
              drawn.length === 0
                ? "Aucun territoire dessiné"
                : `${drawn.length} territoire${drawn.length > 1 ? "s" : ""} dessiné${drawn.length > 1 ? "s" : ""}`
            }
            addLabel="Dessiner un territoire"
            onAdd={() => {
              setOpen(false);
              onDraw();
            }}
          >
            {drawn.length === 0 ? (
              <RosterEmpty>
                Un territoire dessiné est à vous seul : il apparaît sur votre
                carte aux années que vous lui donnez, et nulle part ailleurs.
              </RosterEmpty>
            ) : (
              drawn.map((one, rank) => (
                <RosterRow
                  key={one.id}
                  thumb={
                    <Text style={styles.initial}>
                      {one.name.charAt(0).toUpperCase()}
                    </Text>
                  }
                  title={one.name}
                  detail={
                    busy === one.id
                      ? "Suppression…"
                      : `${formatYear(one.from)} – ${formatYear(one.to)}`
                  }
                  index={rank}
                  onEdit={() => setAsking({ id: one.id, name: one.name })}
                  editLabel={`Effacer ${one.name}`}
                  editIcon={TRASH}
                />
              ))
            )}
          </Roster>

          {/* Only when there is something to say. An empty half-panel headed
              "retirés de votre carte" would be a promise of a feature the
              reader has not used. */}
          {hidden.length === 0 ? null : (
            <View style={styles.section}>
              <Text style={styles.legend}>
                {hidden.length === 1
                  ? "1 territoire retiré de votre carte"
                  : `${hidden.length} territoires retirés de votre carte`}
              </Text>
              {hidden.map((name, rank) => (
                <RosterRow
                  key={name}
                  thumb={
                    <Text style={styles.initialFaded}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  }
                  title={name}
                  detail={busy === name ? "…" : "masqué à toutes les époques"}
                  index={rank}
                  onEdit={() =>
                    work(name, show(name), "Impossible de le rétablir")
                  }
                  editLabel={`Rétablir ${name}`}
                  editIcon={BACK_ON_MAP}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 22, height: 22 },
  fill: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  lead: { ...type.caption, color: palette.inkSoft, textAlign: "center" },
  section: { gap: space.md },
  legend: { ...type.legend, color: palette.inkSoft, alignSelf: "center" },
  initial: { fontSize: 18, fontWeight: "700", color: palette.inkFaint },
  initialFaded: { fontSize: 18, fontWeight: "700", color: palette.line },
});
