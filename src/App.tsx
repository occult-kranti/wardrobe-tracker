import { Component, Suspense, lazy, useEffect, useReducer, type ComponentType, type ReactElement } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import { WardrobeProvider } from './context/WardrobeContext';
import Layout from './components/Layout';
import Door from './pages/Door';
import Dashboard from './pages/Dashboard';
import { Button, LinkButton, Masthead } from './components/ui';
import { ROUTES, LOOK_BOOK_PATHS, safeNext } from './lib/routes';
import { FEED_ENABLED } from '@almari/shared/flags';
import { PHOTOS_HYDRATED_EVENT, hydratePhotos } from './lib/photoStore';

/**
 * WHAT ARRIVES WITH THE DOOR, AND WHAT ARRIVES WHEN IT IS ASKED FOR.
 *
 * Every page used to be a static import, which made one 1.33MB script: the
 * arrival path parsed the admin portal, the Look Book (hidden behind a flag
 * that is off), the intake vision code and 234KB of generated garment plates
 * before it could paint the door. Measured under slow-4G emulation, first
 * paint was 3.4 seconds — several of them spent on code the tester will never
 * open, at the single most abandonment-prone moment the app has.
 *
 * So the two screens a cold arrival can land on — the door, and Today — stay
 * static imports, and every other address is fetched the first time somebody
 * asks for it. Nothing is deferred that a first paint needs.
 *
 * This is only safe because the service worker precaches the whole build
 * (public/sw.js, list written by vite.config.ts): a split app whose route
 * chunks were fetched on demand and nowhere else would be an app that opens
 * offline and then cannot open its own closet. If that precache is ever
 * removed, this splitting has to go with it.
 */

/**
 * A page that has not landed yet.
 *
 * Deliberately empty: a spinner on a 40KB fetch from a worker's cache is
 * chrome for a wait nobody has, and this house does not decorate waiting. The
 * rail and the masthead stay on screen throughout, because the fallback sits
 * inside Layout — only the page's own block is held.
 */
function Waiting() {
  return <div className="min-h-[50vh]" aria-busy="true" />;
}

type Load = () => Promise<{ default: ComponentType }>;

/**
 * One split page: the wait, the fetch, and the two ways it can fail.
 *
 * A split app fails in ways the single bundle could not — no signal and no
 * cached copy, or a deploy that rotated the filenames under an open tab — and
 * both surface as a throw during render. An unguarded throw is a white screen,
 * a worse answer than the one the network gave, so this catches it and says
 * what is true: nothing was lost, the wardrobe is on the device, the page can
 * be asked for again.
 *
 * TWO THINGS HERE ARE LOAD-BEARING AND LOOK LIKE STYLE.
 *
 *   Every element built below carries a `key`. React Router renders the matched
 *   route without one, so without a key of our own every split route is the
 *   same component type in the same position: React would REUSE this instance
 *   across navigations, and one failed chunk would hand its error screen to
 *   every other split page in the app. Measured, before the key: block the
 *   Wishlist chunk and the Ledger renders "This page did not open" too.
 *
 *   The one offer is a fresh copy of the app, and that is not laziness about
 *   an in-place retry — it is the only thing that works. A dynamic import that
 *   fails is memoised twice over: React.lazy sets its payload to REJECTED and
 *   never calls the loader again, and underneath that the browser's own module
 *   map records the failed fetch, so importing the same URL a second time
 *   fails without touching the network. A "Try it again" button was written
 *   here first and measured doing exactly nothing with the network restored.
 */
class Arrival extends Component<{ load: Load }, { failed: boolean }> {
  state = { failed: false };
  page = lazy(this.props.load);

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      const Page = this.page;
      return (
        <Suspense fallback={<Waiting />}>
          <Page />
        </Suspense>
      );
    }
    return (
      <div className="space-y-6">
        <Masthead title="This page did not open" meta="no signal, or a newer build" />
        <p className="type-editorial text-[20px] leading-snug text-balance">
          Nothing has been lost — the wardrobe is where it was, on this device. Only the page failed
          to arrive, and a fresh copy of the app fetches it again.
        </p>
        <Button tone="primary" onClick={() => window.location.reload()}>Fetch a fresh copy</Button>
      </div>
    );
  }
}

/**
 * One route's page, fetched the first time somebody asks for that address.
 *
 * `id` is the key, and it is the PAGE's name rather than the address: the two
 * pages that answer to two addresses each (Profile, Explore) keep one key
 * between them, so moving from /profile to /profile/:id reconciles instead of
 * remounting — which is exactly what happened when they were static imports.
 */
function arriving(id: string, load: Load): ReactElement {
  return <Arrival key={id} load={load} />;
}

/* The two pages that answer to more than one address, held as one element each
   so both addresses render the same instance. */
const PROFILE = arriving('profile', () => import('./pages/Profile'));
const EXPLORE = arriving('explore', () => import('./pages/Explore'));

/**
 * The one route table, paired to the list of addresses by path.
 *
 * The Look Book's four — /feed, /explore, /explore/:postId, /story/:accountId —
 * keep their entries here whatever FEED_ENABLED says. Nothing is deleted; while
 * the flag is off they are simply not the elements those addresses render (see
 * Session below). That is what makes the showcase branch a one-line diff — and
 * now that they are split, a hidden Look Book also costs a reader nothing: the
 * chunks exist in the build and are never fetched.
 */
const ELEMENTS: Record<string, ReactElement> = {
  '/': <Dashboard />,
  '/closet': arriving('closet', () => import('./pages/Closet')),
  '/outfits': arriving('outfits', () => import('./pages/Outfits')),
  '/furniture': arriving('furniture', () => import('./pages/Furniture')),
  '/furniture/:id': arriving('furniture-piece', () => import('./pages/Furniture').then(m => ({ default: m.FurniturePiece }))),
  '/calendar': arriving('calendar', () => import('./pages/Calendar')),
  '/events': arriving('events', () => import('./pages/Events')),
  '/ledger': arriving('ledger', () => import('./pages/Statistics')),
  '/wishlist': arriving('wishlist', () => import('./pages/Wishlist')),
  '/compare': arriving('compare', () => import('./pages/BeforeYouBuy')),
  '/feed': arriving('feed', () => import('./pages/Feed')),
  '/explore': EXPLORE,
  '/explore/:postId': EXPLORE,
  '/story/:accountId': arriving('story', () => import('./pages/Feed').then(m => ({ default: m.Story }))),
  '/chats': arriving('chats', () => import('./pages/Chats')),
  '/chats/:id': arriving('chat-thread', () => import('./pages/Chats').then(m => ({ default: m.ChatThread }))),
  '/profile': PROFILE,
  '/profile/:id': PROFILE,
  '/rail': arriving('rail', () => import('./pages/Rail')),
  '/rail/:id': arriving('rail-profile', () => import('./pages/Rail').then(m => ({ default: m.RailProfile }))),
  '/intake': arriving('intake', () => import('./pages/Intake')),
  '/settings': arriving('settings', () => import('./pages/Settings')),
  '/admin': arriving('admin', () => import('./pages/Admin')),
  '/open': arriving('wardrobes', () => import('./pages/SwitchWardrobe')),
  '/open/new': arriving('wardrobe-new', () => import('./pages/SwitchWardrobe').then(m => ({ default: m.StartWardrobe }))),
};

/** The door, plus the two addresses that reach it while nothing is open. */
function DoorRoutes() {
  return (
    <Routes>
      <Route path="/open" element={<Door />} />
      <Route path="/open/new" element={<Door starting />} />
      <Route path="*" element={<ToTheDoor />} />
    </Routes>
  );
}

/**
 * Any other address, while nothing is open, becomes the door — with `replace`,
 * so the address that could not be served overwrites its own history entry
 * instead of stacking a dead one behind it. That stacking is the whole of the
 * "I have to press back twice or three times" report.
 */
function ToTheDoor() {
  const location = useLocation();
  const meant = `${location.pathname}${location.search}`;
  // The root is not a destination worth remembering: opening a wardrobe lands
  // on Today regardless, so recording next=/ changes nothing except the copy —
  // and it changed that badly. Everyone arriving at the app the ordinary way
  // was told "Today is inside a wardrobe. Open one and you will land there",
  // which reads as an explanation for a journey they never took. The line is
  // for someone who reached for one particular page and was stopped.
  const remember = location.pathname !== '/' && safeNext(meant);
  return <Navigate to={remember ? `/open?next=${encodeURIComponent(meant)}` : '/open'} replace />;
}

function NotFound() {
  const location = useLocation();
  return (
    <div className="space-y-6">
      <Masthead title="No such page" meta={location.pathname} />
      <p className="type-editorial text-[20px] leading-snug text-balance">
        There is nothing at this address. Nothing has been lost — the wardrobe is where it was.
      </p>
      <LinkButton to="/" tone="primary">Back to today</LinkButton>
    </div>
  );
}

/** A paper screen while the one synchronous read finishes. Never a blank. */
function Holding() {
  return <div className="min-h-dvh bg-bg pattern-paper" aria-busy="true" />;
}

/**
 * Which wardrobe is open decides everything below it.
 *
 * WardrobeProvider is keyed by the active account, so switching wardrobes
 * remounts it and every page re-reads from the new store. That one `key` is the
 * whole safety story: useLocalStorage only reads storage in its useState
 * initializer, so without a remount the next write would carry one closet's
 * contents into another's key.
 */
function Session() {
  const { ready, activeId } = useSession();

  if (!ready) return <Holding />;
  if (!activeId) return <DoorRoutes />;

  return (
    <WardrobeProvider key={activeId} accountId={activeId}>
      <Routes>
        <Route element={<Layout />}>
          {ROUTES.map(r => (
            <Route key={r.path} path={r.path} element={ELEMENTS[r.path]} />
          ))}
          {/* THE LOOK BOOK, WHILE IT IS HIDDEN (docs/42 §2).

              ROUTES no longer carries these four, so without this block they
              would fall through to NotFound — and a 404 is a plaque: it tells
              a stranger's deep link that there is a room here, closed. The
              house answers with Today instead, silently, and `replace` keeps
              the dead address from stacking its own history entry behind you.

              Flag on, this renders nothing and the four come back through
              ROUTES above with their real pages. */}
          {FEED_ENABLED ? null : LOOK_BOOK_PATHS.map(path => (
            <Route key={path} path={path} element={<Navigate to="/" replace />} />
          ))}
          {/* The old /stats path stays reachable for anyone with a bookmark. */}
          <Route path="/stats" element={<Navigate to="/ledger" replace />} />
          {/* Rendered inside Layout, so a wrong address still has the rail. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </WardrobeProvider>
  );
}

/**
 * THE PHOTOGRAPHS, READ BACK OFF THE DISK.
 *
 * A record may hold `idb:<id>` where a picture used to sit, and `photoSrc` —
 * which every photo tile in this app now goes through — answers those out of a
 * warm cache, synchronously, because two thirds of those tiles are written
 * inside `.map()` callbacks where a hook is illegal. The cache starts every
 * page load EMPTY. Without this, the first paint after every reload draws the
 * garment flat where a photograph belongs, and then never corrects itself.
 *
 * So: read the room into the cache once, and redraw once when it is full. The
 * listener is attached BEFORE the read starts — on a small closet hydration can
 * finish in the very next microtask, and an announcement nobody was listening
 * for is a closet that stays drawn as flats until the next navigation.
 *
 * THE REDRAW IS AT THE TOP OF THE TREE, AND IT WAS MEASURED RATHER THAN
 * ASSUMED — because the split routes above are held in a module-level ELEMENTS
 * table, and a stable element is exactly the shape React is allowed to bail out
 * of. It does not: React Router rebuilds its own wrapper for the matched route
 * on every render, so the subtree re-renders and the grid is told to look
 * again. Measured on the production build at 390x844, sixty photographs seeded
 * into the store so hydration would lose the race: the closet painted 254 drawn
 * flats at 250ms and all sixty photographs at 325ms. If that ever stops being
 * true, the place to put the listener instead is WardrobeProvider, whose
 * context value is a fresh object on every render and whose consumers React
 * marks even through a parent that bailed out — every surface drawing a
 * wardrobe photograph reads it.
 */
function usePhotographs(): void {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener(PHOTOS_HYDRATED_EVENT, redraw);
    void hydratePhotos();
    return () => window.removeEventListener(PHOTOS_HYDRATED_EVENT, redraw);
  }, []);
}

export default function App() {
  usePhotographs();
  return (
    <SessionProvider>
      {/* The router sits ABOVE the session gate, so the signed-out screens are
          ordinary routes with real addresses instead of one screen rendered in
          place of the whole router. */}
      <HashRouter>
        <Session />
      </HashRouter>
    </SessionProvider>
  );
}
