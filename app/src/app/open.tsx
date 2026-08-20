/**
 * The door — ports src/pages/Door.tsx (docs/34 §2.2: /open), now with the
 * account asked first, exactly as the web asks it:
 *
 *   THE ACCOUNT, first and optional. It does one thing: keeps a copy of a
 *   synced wardrobe's record so another device can open it. The app works
 *   fully without one, so the skip is the FIRST-CLASS primary button, not a
 *   footnote — the one thing this screen must never imply is that the
 *   clothes are going somewhere they were not asked to go. Sign in / create
 *   an account (email and password) stands second.
 *
 *   THE WARDROBE, below: the two honest starts on an empty device (an empty
 *   record, or a small sample labelled a sample everywhere — owner decision,
 *   docs/35), or the named open wardrobe and the step through.
 *
 * One screen rather than the web's two steps: on a phone the two plates
 * stack in one scroll, and the wardrobe below the account is the same
 * sentence in a different aspect ratio. Exactly one primary button per view
 * (brand law 3): the skip carries it until the account question is settled
 * (signed in, or skipped); then "Start empty" takes it back.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Masthead } from '../components/Masthead';
import { AccountPanel, useSession } from '../lib/session';
import { useWardrobe } from '../lib/wardrobe';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export default function OpenScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { status, wardrobeName, isSample, startEmpty, startSample } = useWardrobe();
  const { authUser, authReady } = useSession();

  // The account question, held as local state: skipped is a real answer, and
  // walking back up stays one press — a flow you cannot walk back up is a
  // gate by another name.
  const [skipped, setSkipped] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const settled = skipped || authUser !== null;

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  }

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
        <Masthead title="Wardrobes" meta="The door" />

        {/* STEP 1 · the account, asked first and honestly optional. */}
        <View style={plate}>
          <Text style={editorial}>
            {authReady && authUser ? 'The account' : 'An account, if you want one'}
          </Text>
          {!authReady ? (
            // The panel renders nothing until the stored session has been
            // checked once; a plate with nothing in it reads as broken, so
            // one calm line holds the space.
            <Text style={body}>One moment — checking the account.</Text>
          ) : authUser ? (
            <AccountPanel />
          ) : skipped ? (
            <>
              <Text style={ledger}>No account — everything stays on this device.</Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <Button tone="tertiary" onPress={() => setSkipped(false)}>
                  Back to the account
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text style={[body, { marginBottom: 16 }]}>
                Optional, and it does one thing: a wardrobe you choose can open on your phone
                and your laptop both. The app works fully without one.
              </Text>
              <View style={styles.choices}>
                {/* The skip is the first-class button, ahead of sign-in — the
                    app works fully without an account, and the order says so
                    rather than merely allowing it. */}
                <Button tone="primary" onPress={() => { setSkipped(true); setFormOpen(false); }}>
                  Continue without an account
                </Button>
                <Button tone="secondary" onPress={() => setFormOpen(!formOpen)}>
                  {formOpen ? 'Put the form away' : 'Sign in or create an account'}
                </Button>
              </View>
              {formOpen ? (
                <View style={{ marginTop: 16, alignSelf: 'stretch' }}>
                  <AccountPanel />
                </View>
              ) : (
                <Text style={[ledger, { marginTop: 12 }]}>
                  Everything stays on this device either way.
                </Text>
              )}
            </>
          )}
        </View>

        {/* STEP 2 · the wardrobe — the records on this device. */}
        <View style={[plate, { marginTop: 16 }]}>
          <Text style={editorial}>Every wardrobe is its own closet.</Text>

          {status === 'none' ? (
            <>
              <Text style={[body, { marginBottom: 20 }]}>
                Nothing is on record here yet. Start with an empty rail and add the first piece
                yourself, or walk through a small sample closet first — the sample is labelled a
                sample and is never your record.
              </Text>
              <View style={styles.choices}>
                <Button
                  tone={settled ? 'primary' : 'secondary'}
                  onPress={() => {
                    void startEmpty().then(() => router.replace('/'));
                  }}
                >
                  Start empty
                </Button>
                <Button
                  tone="secondary"
                  onPress={() => {
                    void startSample().then(() => router.replace('/'));
                  }}
                >
                  Walk through a sample
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text style={[body, { marginBottom: 16 }]}>
                {isSample
                  ? `"${wardrobeName ?? 'The sample wardrobe'}" is open — a sample, not your record.`
                  : `"${wardrobeName ?? 'Your wardrobe'}" is open on this device.`}
              </Text>
              <Button tone="tertiary" onPress={() => router.replace('/')}>
                Step through to Today
              </Button>
            </>
          )}
        </View>
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
    alignItems: 'flex-start',
  },
  choices: {
    alignSelf: 'stretch',
    gap: 12,
  },
});
