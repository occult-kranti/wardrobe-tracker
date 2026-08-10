import { HashRouter, Routes, Route } from 'react-router-dom';
import { WardrobeProvider } from './context/WardrobeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Closet from './pages/Closet';
import Outfits from './pages/Outfits';
import Calendar from './pages/Calendar';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';

function App() {
  return (
    <WardrobeProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/closet" element={<Closet />} />
            <Route path="/outfits" element={<Outfits />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/stats" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </WardrobeProvider>
  );
}

export default App;
