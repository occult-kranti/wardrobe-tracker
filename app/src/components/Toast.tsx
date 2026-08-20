/**
 * The house toast — ports src/components/Toast.tsx: the module-level
 * listener pattern, the timings (an offer gets 9s, plain news 4s), the
 * voice ("dry, two beats, verb first. 'Logged. Worn 14 times.'"), and the
 * 'seal' type reserved for wear logging.
 *
 * What did not travel, and why:
 *  - the windchime. src/lib/sound.ts is WebAudio, DOM-owned; playing it
 *    natively means expo-audio — a new dependency, which is an owner
 *    decision, not a porting detail.
 *  - the seal-press spring. Motion is Phase 3 design-pass work
 *    (docs/34 §6); the seal keeps its filled-eyelet mark so the moment
 *    already reads as itself, it just does not animate yet.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconCheck, IconEyeletFilled } from '../icons';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export type ToastType = 'success' | 'error' | 'info' | 'seal';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** An offer attached to the news, e.g. putting back what was just removed. */
  action?: { label: string; run: () => void };
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach(l => l([...toasts]));
}

/**
 * Voice: dry, two beats, verb first. "Logged. Worn 14 times."
 * The 'seal' type is reserved for wear logging — it presses like a wax seal.
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  action?: { label: string; run: () => void },
) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type, action }];
  notify();
  // An offer needs long enough to be read and reached for; plain news does not.
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, action ? 9000 : 4000);
}

/** Take a toast down early — used when its offer has been accepted. */
function dismiss(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export function useToasts() {
  const [state, setState] = useState<Toast[]>([]);
  useEffect(() => {
    toastListeners.push(setState);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setState);
    };
  }, []);
  return state;
}

export function ToastContainer() {
  const items = useToasts();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.stack} accessibilityLiveRegion="polite">
      {items.map(toast => (
        <View
          key={toast.id}
          style={[
            styles.plate,
            // Depth is a hairline in the room's ink — the web's plate-ink,
            // never a shadow (brand law 5).
            { backgroundColor: tokens.surface, borderColor: tokens.text },
          ]}
        >
          {toast.type === 'seal' ? (
            <IconEyeletFilled size={14} color={tokens.accent} />
          ) : (
            <IconCheck size={16} color={toast.type === 'error' ? tokens.danger : tokens.accent} />
          )}
          <Text style={[styles.message, { color: tokens.text, fontFamily: fonts.ui }]}>
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={8}
              onPress={() => {
                toast.action!.run();
                dismiss(toast.id);
              }}
              style={styles.action}
            >
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: TYPE.label,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: TYPE.labelSpacing,
                  color: tokens.accent,
                  textDecorationLine: 'underline',
                }}
              >
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 16,
    right: 16,
    // Above the tab rail, as the web floats above its own.
    bottom: 88,
    gap: 8,
    zIndex: 200,
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
