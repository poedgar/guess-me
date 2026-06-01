import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { SoundProvider } from './contexts/SoundContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { HomePage } from './pages/HomePage';
import { ResultsPage } from './pages/ResultsPage';
import { RulesPage } from './pages/RulesPage';
import './App.css';

function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-around">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex-1 py-4 text-center border-t-4 transition-colors ${
            isActive
              ? 'border-game-blue text-game-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`
        }
      >
        Home
      </NavLink>
      <NavLink
        to="/results"
        className={({ isActive }) =>
          `flex-1 py-4 text-center border-t-4 transition-colors ${
            isActive
              ? 'border-game-blue text-game-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`
        }
      >
        Results
      </NavLink>
      <NavLink
        to="/rules"
        className={({ isActive }) =>
          `flex-1 py-4 text-center border-t-4 transition-colors ${
            isActive
              ? 'border-game-blue text-game-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`
        }
      >
        Rules
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <SoundProvider>
      <LanguageProvider>
        <AuthProvider>
          <GameProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-white dark:bg-gray-900 font-philosopher pb-24">
                <NavBar />
                <main className="max-w-2xl mx-auto px-4 py-8">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </BrowserRouter>
          </GameProvider>
        </AuthProvider>
      </LanguageProvider>
    </SoundProvider>
  );
}
