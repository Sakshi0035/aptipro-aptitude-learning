import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

// --- Auth Context ---
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  signOut: () => void;
  loading: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: React.Dispatch<React.SetStateAction<boolean>>;
  databaseError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthChange = async (_event: string, session: Session | null) => {
        // This handles the password reset flow. When the user clicks the reset link,
        // Supabase sends a 'PASSWORD_RECOVERY' event. We set a state to show the PasswordReset component.
        if (_event === 'PASSWORD_RECOVERY') {
            setIsPasswordRecovery(true);
            // We clear the hash from the URL to prevent this from re-triggering on a page refresh.
            window.history.replaceState(null, '', window.location.pathname);
        }
        
        // For new user sign-ups, the event will be 'SIGNED_IN' after they click the
        // confirmation link. They will be treated as a normal logged-in user and 
        // redirected to the dashboard by the ProtectedRoute component.
        
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
            // Fetch profile
            let { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            if (error && error.message.includes('relation "public.profiles" does not exist')) {
                setDatabaseError(error.message);
                setLoading(false);
                return; // Stop further processing if db is not set up
            }
            
            if (error && error.code === 'PGRST116') { // "PGRST116": row not found
                // Create profile if it doesn't exist for a new user
                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .insert({ id: currentUser.id, username: currentUser.email?.split('@')[0], score: 0 })
                    .select()
                    .single();
                
                if (insertError) {
                    const errorMessage = `Database Error: ${insertError.message}. Details: ${insertError.details || 'N/A'}. Hint: ${insertError.hint || 'N/A'}`;
                    console.error("Error creating profile:", errorMessage);
                    setDatabaseError(errorMessage);
                } else {
                    setProfile(newProfile);
                }
            } else if (profileData) {
                setProfile(profileData);
            } else if (error) {
                const errorMessage = `Database Error: ${error.message}. Details: ${error.details || 'N/A'}. Hint: ${error.hint || 'N/A'}`;
                console.error("Error fetching profile:", errorMessage);
                setDatabaseError(errorMessage);
            }
        } else {
            setProfile(null); // Clear profile on logout
        }
        setLoading(false);
    }
    
    // Initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleAuthChange('INITIAL_SESSION', session);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthChange(_event, session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    profile,
    setProfile,
    signOut: () => {
        setIsPasswordRecovery(false);
        supabase.auth.signOut();
    },
    loading,
    isPasswordRecovery,
    setIsPasswordRecovery,
    databaseError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- Theme Context ---
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) {
            return savedTheme;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    setTheme(prevTheme => {
        const newTheme = prevTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        return newTheme;
    });
  };
  
  const value = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
