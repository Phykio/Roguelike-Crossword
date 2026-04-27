import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage      from './pages/HomePage.jsx';
import RoguelikePage from './pages/RoguelikePage.jsx';
import ClassicPage   from './pages/ClassicPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<HomePage />} />
        <Route path="/roguelike" element={<RoguelikePage />} />
        <Route path="/classic"   element={<ClassicPage />} />
        <Route path="*"          element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}