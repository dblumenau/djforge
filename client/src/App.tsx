import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import MainApp from './components/MainApp';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/landing" element={<LandingPage />} />
    </Routes>
  );
}

export default App;