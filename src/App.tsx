import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WardrobeProvider } from './context/WardrobeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Closet from './pages/Closet';
import Outfits from './pages/Outfits';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';

function App() {
  return (
    <WardrobeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/closet" element={<Closet />} />
            <Route path="/outfits" element={<Outfits />} />
            <Route path="/stats" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WardrobeProvider>
  );
}

export default App;
