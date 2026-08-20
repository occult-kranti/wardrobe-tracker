/**
 * Settings — the account and the per-wardrobe sync choice, ported from the
 * web's Settings account section and SwitchWardrobe's "Where the record
 * lives" (docs/34 §2.2). Theme, storage, and export are still to come; the
 * screen says so rather than pretending the list is finished.
 *
 * The laws this screen carries:
 *   - sync is OPT-IN per wardrobe, off by default; a sample never gets the
 *     choice at all (a worked example belongs to the device);
 *   - the plain trust sentence ships wherever sync is offered (docs/35:
 *     until E2E encryption lands, the copy says who can read a synced copy);
 *   - signing out deletes nothing, and the copy says so where the button is.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Masthead } from '../../components/Masthead';
import { AccountPanel, Choice, TRUST_SENTENCE, useSession } from '../../lib/session';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function SettingsScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const { authUser, authReady } = useSession();
  const { wardrobeName, isSample, syncMode, setSyncMode } = useWardrobe();
  // Chose "Synced to my account" while signed out: the choice cannot hold, so
  // the sign-in is offered instead of silently starting a sync that cannot
  // happen — the web's own wantSync gesture.
  const [wantSync, setWantSync] = useState(false);

  const editorial = {
    fontFamily: fonts.displayItalic,
    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? ('normal' as const) : ('italic' as const),
    fontSize: TYPE.editorial,
    color: tokens.text,
    marginBottom: 8,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    lineHeight: Math.round(TYPE.body * 1.5),
    color: tokens.text2,
  };
  const small = {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text2,
  };
  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const plate = [
    styles.plate,
    { backgroundColor: tokens.surface, borderColor: tokens.border },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Masthead title="Settings" meta="The house choices" />

        {/* The account — wholly optional, and the copy says what it is for. */}
        <View style={plate}>
          <Text style={editorial}>The account</Text>
          {!authReady ? (
            <Text style={body}>One moment — checking the account.</Text>
          ) : (
            <AccountPanel />
          )}
        </View>

        {/* Where the open wardrobe's record lives. */}
        <View style={[plate, { marginTop: 16 }]}>
          <Text style={editorial}>Where the record lives</Text>
          <Text style={[ledger, { marginBottom: 12 }]}>
            {wardrobeName ? `This wardrobe · ${wardrobeName}` : 'This wardrobe'}
          </Text>

          {isSample ? (
            <Text style={body}>
              A sample never syncs — a worked example belongs to the device that installed it.
            </Text>
          ) : (
            <>
              <View style={styles.choices}>
                <Choice
                  active={syncMode === 'device'}
                  onPress={() => {
                    setWantSync(false);
                    void setSyncMode('device');
                  }}
                >
                  On this device
                </Choice>
                <Choice
                  active={syncMode === 'cloud'}
                  onPress={() => {
                    // Signed out, the choice cannot hold — offer the sign-in
                    // instead of silently promising a sync with nowhere to go.
                    if (!authUser) {
                      setWantSync(true);
                      return;
                    }
                    setWantSync(false);
                    void setSyncMode('cloud');
                  }}
                >
                  Synced to my account
                </Choice>
              </View>
              <Text style={[small, { marginTop: 12 }]}>
                {syncMode === 'device'
                  ? 'Kept on this device only. If a copy was ever synced, it is left on the account as it was, and is no longer updated.'
                  : 'A copy is kept on your account, updated as you work, so another device can open it.'}
              </Text>
              {/* The plain sentence — docs/35: wherever sync is offered. */}
              <Text style={[small, { marginTop: 8 }]}>{TRUST_SENTENCE}</Text>
              {wantSync && !authUser ? (
                <View
                  style={[
                    styles.inset,
                    { backgroundColor: tokens.sunken, borderColor: tokens.border },
                  ]}
                >
                  <Text style={[ledger, { marginBottom: 12 }]}>
                    Syncing needs the account it syncs to
                  </Text>
                  <AccountPanel />
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* What the placeholder promised still stands; the list is not done. */}
        <Text style={[ledger, { marginTop: 16 }]}>
          Theme, storage, and export will live here.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'stretch',
  },
  choices: {
    gap: 8,
    alignSelf: 'stretch',
  },
  inset: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 16,
    marginTop: 12,
  },
});
