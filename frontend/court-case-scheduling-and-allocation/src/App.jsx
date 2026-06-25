import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './viewpages/LoginPage';
import RegisterPage from './viewpages/RegisterPage';
import TwoFactorPage from './viewpages/TwoFactorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/2fa" element={<TwoFactorPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  );
}