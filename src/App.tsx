import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import { WardrobeProvider } from './context/WardrobeContext';
import Layout from './components/Layout';
import Door from './pages/Door';
import Dashboard from './pages/Dashboard';
import Closet from './pages/Closet';
import Outfits from './pages/Outfits';
import Calendar from './pages/Calendar';
import Statistics from './pages/Statistics';
import Wishlist from './pages/Wishlist';
import BeforeYouBuy from './pages/BeforeYouBuy';
import Rail, { RailProfile } from './pages/Rail';
import Events from './pages/Events';
import Feed, { Story } from './pages/Feed';
import Explore from './pages/Explore';
import Chats, { ChatThread } from './pages/Chats';
import Profile from './pages/Profile';
import SwitchWardrobe, { StartWardrobe } from './pages/SwitchWardrobe';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Intake from './pages/Intake';
import Furniture, { FurniturePiece } from './pages/Furniture';
import { LinkButton, Masthead } from './components/ui';
import { ROUTES, LOOK_BOOK_PATHS, safeNext } from './lib/routes';
import { FEED_ENABLED } from '@almari/shared/flags';

/**
 * The one route table, paired to the list of addresses by path.
 *
 * The Look Book's four — /feed, /explore, /explore/:postId, /story/:accountId —
 * keep their entries here whatever FEED_ENABLED says. Nothing is deleted; while
 * the flag is off they are simply not the elements those addresses render (see
 * Session below). That is what makes the showcase branch a one-line diff.
 */
const ELEMENTS: Record<string, React.ReactElement> = {
  '/': <Dashboard />,
  '/closet': <Closet />,
  '/outfits': <Outfits />,
  '/furniture': <Furniture />,
  '/furniture/:id': <FurniturePiece />,
  '/calendar': <Calendar />,
  '/events': <Events />,
  '/ledger': <Statistics />,
  '/wishlist': <Wishlist />,
  '/compare': <BeforeYouBuy />,
  '/feed': <Feed />,
  '/explore': <Explore />,
  '/explore/:postId': <Explore />,
  '/story/:accountId': <Story />,
  '/chats': <Chats />,
  '/chats/:id': <ChatThread />,
  '/profile': <Profile />,
  '/profile/:id': <Profile />,
  '/rail': <Rail />,
  '/rail/:id': <RailProfile />,
  '/intake': <Intake />,
  '/settings': <Settings />,
  '/admin': <Admin />,
  '/open': <SwitchWardrobe />,
  '/open/new': <StartWardrobe />,
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

export default function App() {
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
