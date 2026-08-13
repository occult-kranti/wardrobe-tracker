import { useEffect, useState } from 'react';

/**
 * PUTTING TOILE ON THE HOME SCREEN.
 *
 * Every rival in the category ships a native app; this one is a web page. The
 * gap that actually matters to a person is not the store listing — it is the
 * icon on the home screen, opening full-screen, working with no signal. A
 * manifest and a service worker close it, and neither requires a company, an
 * account, or a server.
 *
 * Nothing here nags. The prompt is captured and held; the app offers it once,
 * on the settings page, next to the sentence explaining what it does.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let held: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const announce = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    // Held rather than shown: the browser's own moment for this is rarely the
    // user's, and an unexpected modal on first paint is how installs get
    // declined forever.
    e.preventDefault();
    held = e as InstallPromptEvent;
    announce();
  });
  window.addEventListener('appinstalled', () => {
    held = null;
    announce();
  });
}

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Registered after load so it never competes with the first paint for
  // bandwidth on the one visit that has to come off the network.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {
      // No worker means no offline. Everything else still works, because
      // everything else was already on the device.
    });
  });
}

/** Is this already running as an installed app? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS says it its own way, and says it on navigator.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * The state of the offer: whether it can be made, and the way to make it.
 *
 * `unsupported` is not a failure — Safari has no prompt event at all, and the
 * honest answer there is the two-line instruction, not a dead button.
 */
export function useInstall() {
  const [ready, setReady] = useState(() => held !== null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const update = () => {
      setReady(held !== null);
      setInstalled(isStandalone());
    };
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  const install = async () => {
    if (!held) return 'unsupported' as const;
    await held.prompt();
    const { outcome } = await held.userChoice;
    held = null;
    announce();
    return outcome;
  };

  return { ready, installed, install };
}
