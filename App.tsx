import React, { useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AppContexts';
import { ThemeProvider, useTheme } from './contexts/AppContexts';
import AuthPage from './components/Auth';
import Dashboard from './components/Dashboard';
import Practice from './components/Practice';
import VoiceTest from './components/VoiceTest';
import Leaderboard from './components/Leaderboard';
import AIMentor from './components/AIMentor';
import Profile from './components/Profile';
import Avatar from './components/Avatar';
import PasswordReset from './components/PasswordReset';
import { DatabaseSetup } from './components/DatabaseSetup';
import { SunIcon, MoonIcon, MenuIcon, ChevronLeftIcon, FireIcon, BrainCircuitIcon, TrophyIcon, MicVocalIcon, MessageSquareIcon, UserCircleIcon, LogOutIcon, CloudIcon, CloudRainIcon, CloudSunIcon } from './components/Icons';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <MainApp />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

// Helper component to render weather icons based on weather code from Open-Meteo API
const WeatherIcon = ({ code, ...props }: { code: number; [key: string]: any }) => {
    if (code === 0) return <SunIcon {...props} />;
    if (code >= 1 && code <= 3) return <CloudSunIcon {...props} />;
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return <CloudRainIcon {...props} />;
    return <CloudIcon {...props} />;
};


const MainApp: React.FC = () => {
  const { theme } = useTheme();
  const { isPasswordRecovery, databaseError } = useAuth();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  if (databaseError) {
    return <DatabaseSetup />;
  }

  if (isPasswordRecovery) {
    return <PasswordReset />;
  }

  return (
    <div className="min-h-screen font-sans text-gray-800 bg-gray-50 dark:bg-gray-900 dark:text-gray-200">
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
}

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-16 h-16 border-4 border-t-transparent border-fire-orange-start rounded-full animate-spin"></div>
        </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
                const data = await response.json();
                setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weather_code });
            } catch (error) {
                console.error("Failed to fetch weather data", error);
            }
        });
    }
  }, []);

  const handleResize = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const username = typeof profile?.username === 'string' ? profile.username : 'User';

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-xl transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Link to="/dashboard" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fire-orange-start to-fire-red-end">
            AptiPro
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <ChevronLeftIcon />
          </button>
        </div>
        <nav className="py-4 flex flex-col h-[calc(100%-5rem)]">
          <div className="flex-grow px-4 space-y-2">
            <NavLink to="/dashboard" icon={<FireIcon />}>Dashboard</NavLink>
            <NavLink to="/practice" icon={<BrainCircuitIcon />}>Practice</NavLink>
            <NavLink to="/leaderboard" icon={<TrophyIcon />}>Leaderboard</NavLink>
            <NavLink to="/voice-test" icon={<MicVocalIcon />}>Voice Test</NavLink>
            <NavLink to="/ai-mentor" icon={<MessageSquareIcon />}>AI Mentor</NavLink>
            <NavLink to={`/profile/${user?.id}`} icon={<UserCircleIcon />}>My Profile</NavLink>
          </div>
          <div className="px-4 mt-auto">
             <button onClick={signOut} className="w-full flex items-center px-4 py-2 mt-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <LogOutIcon />
                <span className="ml-3">Sign Out</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md md:shadow-none">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <MenuIcon />
          </button>
          <div className="flex items-center ml-auto">
             {weather && (
                 <div className="hidden sm:flex items-center mr-4 text-sm text-gray-600 dark:text-gray-400">
                    <WeatherIcon code={weather.code} className="mr-2" />
                    <span>{weather.temp}°C</span>
                </div>
             )}
            <button onClick={toggleTheme} className="mr-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <Link to={`/profile/${user?.id}`} className="flex items-center">
              <Avatar avatarUrl={profile?.avatar_url} name={profile?.username || user?.email} size={40} />
              <div className="ml-3 hidden sm:block">
                <p className="font-semibold text-sm">{username}</p>
                <p className="text-xs text-gray-500">{(profile?.score || 0).toLocaleString()} XP</p>
              </div>
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/practice/:topic" element={<Practice />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/voice-test" element={<VoiceTest />} />
            <Route path="/ai-mentor" element={<AIMentor />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const NavLink: React.FC<{ to: string, icon: React.ReactElement, children: React.ReactNode }> = ({ to, icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-gradient-to-r from-orange-100 to-red-100 text-fire-orange-start dark:bg-gray-700' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
    >
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
      <span className="ml-3">{children}</span>
    </Link>
  );
};

export default App;