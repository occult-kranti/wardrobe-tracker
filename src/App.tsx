import { HashRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import { WardrobeProvider } from './context/WardrobeContext';
import Layout from './components/Layout';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import Closet from './pages/Closet';
import Outfits from './pages/Outfits';
import Calendar from './pages/Calendar';
import Statistics from './pages/Statistics';
import Wishlist from './pages/Wishlist';
import BeforeYouBuy from './pages/BeforeYouBuy';
import Rail, { RailProfile } from './pages/Rail';
import Events from './pages/Events';
import Feed from './pages/Feed';
import Chats, { ChatThread } from './pages/Chats';
import Profile from './pages/Profile';
import SwitchWardrobe from './pages/SwitchWardrobe';
import Settings from './pages/Settings';

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

  if (!ready) return null;
  if (!activeId) return <SignIn />;

  return (
    <WardrobeProvider key={activeId} accountId={activeId}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/closet" element={<Closet />} />
            <Route path="/outfits" element={<Outfits />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/events" element={<Events />} />
            <Route path="/ledger" element={<Statistics />} />
            {/* The old /stats path stays reachable for anyone with a bookmark. */}
            <Route path="/stats" element={<Statistics />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/compare" element={<BeforeYouBuy />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/chats/:id" element={<ChatThread />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/rail" element={<Rail />} />
            <Route path="/rail/:id" element={<RailProfile />} />
            <Route path="/open" element={<SwitchWardrobe />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </WardrobeProvider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Session />
    </SessionProvider>
  );
}
