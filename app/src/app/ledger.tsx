/**
 * THE LEDGER — /ledger. Ports src/pages/Statistics.tsx, which the web itself
 * titles "Ledger" and addresses at /ledger. The address does not move.
 *
 * THE CLOSET'S ACCOUNTS, STATED LIKE A BANK BALANCE. That sentence is the
 * whole specification and every refusal below follows from it:
 *
 *  - NO REPORT CARD. There is no percentage on this screen, no completion, no
 *    "93% in use" in 56px over a meter. Progress-as-achievement was rejected
 *    outright by the panel (focus-group §2.2, §2.6; brand §8.2) and it framed a
 *    wardrobe as something a person can be behind on. Counts stay; scores go.
 *  - NO ALARM COLOURS. Bars are ink. Nothing here is red, amber, or a warning
 *    state — brand law 2 keeps carmine for the four surfaces of the seal, and
 *    a ledger that turns colour when a number moves is a ledger with an
 *    opinion about its reader.
 *  - NO LEAGUE TABLE. Categories are ordered by the quantity actually drawn
 *    beside them, and that is the only ordering. A quiet category is quiet: it
 *    draws no bar, states its count in the same ink as every other line, and
 *    is never asked to explain itself.
 *  - RETIRED PIECES SIT OUTSIDE EVERY NUMBER, and are acknowledged in one line
 *    at the foot, because their history is kept. Retire, never delete.
 *
 * THE MATHS IS NOT HERE. Every figure comes from
 * `components/ledger/figures.ts`, which is itself only a chooser: money is
 * `@almari/shared/cost` and dates are `@almari/shared/dates`, formatters
 * included. The ₹ strings on this screen are the same characters the web
 * prints for the same wardrobe, because they come out of the same function.
 *
 * A HOUSE DOOR, NOT A BAR SLOT. The bar holds four rooms this season (docs/42
 * §1); the arithmetic is something you go and read. So the room carries its
 * own way back to the House — a pushed route under a header-less stack owes
 * the reader a door out that is not a system gesture.
 *
 * COLD-OPENED WITH NO WARDROBE, IT SENDS YOU TO THE DOOR (lead ruling R7,
 * matching the tabs and the other two pushed rooms). A deep link into the
 * accounts of a wardrobe that does not exist yet is the door's question, not
 * this room's.
 */
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, formatPerWear } from '@almari/shared/cost';

import { Button } from '../components/Button';
import { Basting } from '../components/furniture/Basting';
import { CategoryLine } from '../components/ledger/CategoryLine';
import { CLOSET, HOUSE } from '../components/ledger/addresses';
import { ledgerFigures } from '../components/ledger/figures';
import { Plate, SectionTitle, Stat, StatGrid } from '../components/ledger/Plate';
import { Masthead } from '../components/Masthead';
import { useWardrobe } from '../lib/wardrobe';
import { useFamilies } from '../tokens/FontsContext';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

const GUTTER = 20;

export default function LedgerScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { status, items, activeItems, outfits, wearLogs, settings } = useWardrobe();

  const figures = useMemo(
    () => ledgerFigures({ items, activeItems, outfits, wearLogs, settings }),
    [items, activeItems, outfits, wearLogs, settings],
  );

  const editorial = {
    fontFamily: fonts.displayItalic,
    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? ('normal' as const) : ('italic' as const),
    fontSize: TYPE.editorial,
    lineHeight: Math.round(TYPE.editorial * 1.35),
    color: tokens.text,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    lineHeight: Math.round(TYPE.body * 1.5),
    color: tokens.text2,
  };
  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  // The shelf answers before the room paints — a blank beat, never a flash of
  // an empty ledger that is about to be somebody's full one.
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  // R7: no wardrobe on this device yet, so there are no accounts to read.
  if (status === 'none') return <Redirect href="/open" />;

  const back = (
    <View style={styles.leave}>
      <Button
        tone="tertiary"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(HOUSE);
        }}
      >
        Back to the House
      </Button>
    </View>
  );

  /* ---------- nothing on the record yet ----------
     §8.4: an empty screen teaches one thing and offers one way on. The web's
     empty ledger opens its add-a-piece form in place; this room has no form of
     its own, so the way on is the room that does — named plainly, rather than
     a button that promises a sheet it cannot raise. */
  if (items.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <ScrollView contentContainerStyle={styles.page}>
          {back}
          <Masthead title="Ledger" />
          <Plate>
            <Text style={[editorial, { marginBottom: 8 }]}>The ledger is still empty.</Text>
            <Text style={[body, { marginBottom: 20 }]}>
              Pieces and wears land here. Every wear you log divides what a piece cost by one
              more, so the ledger can say what each thing has come down to per wear.
            </Text>
            <Button tone="primary" onPress={() => router.push(CLOSET)}>
              Open the closet
            </Button>
          </Plate>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { cost } = figures;
  const priced = cost.costedPieces;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {back}

        <Masthead
          title="Ledger"
          meta={`${figures.daysLogged.toLocaleString('en-IN')} ${figures.daysLogged === 1 ? 'day' : 'days'} logged`}
        />

        {/* THE TOTALS. Cumulative, factual, unloseable — stated like a bank
            balance. "Wears recorded" is the item-wear total; the days-logged
            count lives in the masthead's meta, where it cannot be mistaken for
            this one. The web once labelled both with the same two words, 24×
            apart. */}
        <Plate>
          <StatGrid>
            <Stat value={String(figures.pieces)} label="In the closet" />
            <Stat value={figures.wears.toLocaleString('en-IN')} label="Wears recorded" />
            <Stat value={String(figures.outfits)} label="Outfits" />
            <Stat value={String(figures.unworn)} label="Not worn yet" />
          </StatGrid>
        </Plate>

        {/* IN USE — a sentence, not a score. The aside is withheld when
            nothing has been worn yet: "0 of 12" beside a heading is a
            scoreboard, whatever the sentence under it says. */}
        <SectionTitle aside={figures.worn > 0 ? `${figures.worn} of ${figures.pieces}` : undefined}>
          In use
        </SectionTitle>
        <Plate>
          <Text style={editorial}>
            {figures.worn > 0
              ? `${figures.worn} of ${figures.pieces} ${figures.pieces === 1 ? 'piece has' : 'pieces have'} been worn at least once${
                  figures.unworn > 0
                    ? `. ${figures.unworn} ${figures.unworn === 1 ? 'is' : 'are'} still resting.`
                    : '.'
                }`
              : `${figures.pieces} ${figures.pieces === 1 ? 'piece has' : 'pieces have'} not had a first wear yet.${
                  figures.resting > 0 ? ` ${formatMoney(figures.resting)} is resting here.` : ''
                }`}
          </Text>
        </Plate>

        {/* BY CATEGORY. The bar and the numeral beside it are the same
            quantity — the web's own bug here was a bar drawn from piece counts
            under a label that read wears. */}
        {figures.categories.rows.length > 0 ? (
          <>
            <SectionTitle aside="wears · pieces">By category</SectionTitle>
            <Plate>
              {figures.categories.rows.map(row => (
                <CategoryLine
                  key={row.id}
                  label={row.label}
                  wears={row.wears}
                  pieces={row.pieces}
                  max={figures.categories.max}
                />
              ))}
            </Plate>
          </>
        ) : null}

        {/* COST — the plate the House carries, in the room the House carries
            it on behalf of: the same two labels, the same 32px numerals. Two
            plain numbers and one sentence saying what was divided by what. No
            commentary, and nothing congratulated.

            The HEADING is "Cost" and the LABEL is "What it cost", exactly as
            the web sets them. Repeating the label as the heading would put the
            same four words twice in 60px of paper. */}
        <SectionTitle
          aside={priced > 0 ? `${priced} priced ${priced === 1 ? 'piece' : 'pieces'}` : undefined}
        >
          Cost
        </SectionTitle>
        <Plate>
          <StatGrid>
            <Stat value={cost.basis > 0 ? formatMoney(cost.basis) : '—'} label="What it cost" />
            <Stat value={formatPerWear(cost.value)} label="Average per wear" />
          </StatGrid>
          <Basting width={windowWidth - GUTTER * 2 - 40} style={styles.rule} />
          {cost.basis > 0 && cost.wears > 0 ? (
            <Text style={body}>
              {formatMoney(cost.basis)} across {cost.wears.toLocaleString('en-IN')}{' '}
              {cost.wears === 1 ? 'wear' : 'wears'} of the pieces it bought. Every wear divides
              the same money one more way; every piece added starts the sum again.
            </Text>
          ) : cost.basis > 0 ? (
            /* Paid for, and not worn yet. "across 0 wears" is arithmetically
               true and reads as a reproach; ItemDetail's own words for this
               state are "paid, resting so far", and they travel. */
            <Text style={body}>
              {formatMoney(cost.basis)} on the record, resting so far. The average appears the
              first time one of these pieces goes on.
            </Text>
          ) : figures.recordedPrices > 0 ? (
            /* Every amount on the record is a zero. That is an answer — a
               closet that was inherited, gifted or swapped — and printing
               "₹0.00 per wear" against it would read as a rendering fault. */
            <Text style={body}>
              Every amount on the record is zero — nothing was paid, and a recorded zero is a
              real answer. There is nothing here for cost per wear to divide.
            </Text>
          ) : (
            /* THE EMPTY-COST CARD. Not silence: the money half of the ledger
               is one field away, and the field says so itself on the web —
               "Optional, and the one thing cost per wear needs." */
            <Text style={body}>
              No price is on the record yet, so there is nothing to divide. A price is optional —
              and it is the one thing cost per wear needs. Put one on a piece in the closet, and
              it starts dividing by that piece's wears.
            </Text>
          )}
        </Plate>

        {/* Retired pieces sit outside every number above — but they are not
            erased, and this line is the whole of what the room says about
            them. Retire, never delete. */}
        {figures.retired > 0 ? (
          <Text style={[ledger, styles.foot]}>
            {figures.retired} {figures.retired === 1 ? 'piece' : 'pieces'} retired, their history
            kept
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 48,
  },
  leave: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  rule: {
    marginTop: 16,
    marginBottom: 16,
  },
  foot: {
    marginTop: 28,
    textAlign: 'center',
  },
});
