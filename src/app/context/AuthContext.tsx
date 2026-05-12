import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/app/utils/supabaseClient';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { buildHeaders } from '@/app/utils/buildHeaders';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (email: string, password: string, name: string, phone?: string) => Promise<{ success: boolean; message?: string; requiresLogin?: boolean }>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  loading: boolean;
}

// Create context with a default value to prevent undefined errors during hot reload
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  accessToken: null,
  login: async () => ({ success: false, message: 'Auth not initialized' }),
  signup: async () => ({ success: false, message: 'Auth not initialized' }),
  loginWithGoogle: async () => ({ success: false, message: 'Auth not initialized' }),
  logout: () => {},
  loading: true
});

// Add display name for better debugging
AuthContext.displayName = 'AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Track if we're using mock authentication - check localStorage on init
  const [isMockAuth, setIsMockAuth] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Check both mock_user and explicit mock_auth flag
    return !!localStorage.getItem('mock_user') || localStorage.getItem('is_mock_auth') === 'true';
  });
  
  // Use lazy initialization to load from localStorage
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const mockUser = localStorage.getItem('mock_user');
      if (mockUser) {
        console.log('🔄 Initializing with mock user from localStorage');
        return JSON.parse(mockUser);
      }
    } catch (e) {
      console.error('Failed to parse mock user from localStorage:', e);
    }
    return null;
  });
  
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      // First check if we have a stored demo access token (real JWT)
      const storedDemoToken = localStorage.getItem('demo_access_token');
      if (storedDemoToken && storedDemoToken.includes('.')) {
        console.log('🔄 Restoring demo access token from localStorage');
        return storedDemoToken;
      }
      
      // Fallback to mock token
      const mockUser = localStorage.getItem('mock_user');
      if (mockUser) {
        const parsedUser = JSON.parse(mockUser);
        return 'mock-token-' + parsedUser.id;
      }
    } catch (e) {
      console.error('Failed to parse access token from localStorage:', e);
    }
    return null;
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    checkUser();

    // Always set up Supabase listener, but with strict guards to protect mock auth
    console.log('📡 Setting up Supabase auth listener with mock auth protection');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Supabase auth state changed:', event, 'Has session:', !!session);
      
      // If a real Supabase session exists, it must take precedence over mock auth state.
      const currentMockAuth = localStorage.getItem('is_mock_auth') === 'true' || !!localStorage.getItem('mock_user');
      if (currentMockAuth && !session?.user) {
        console.log('⚠️ In mock auth mode with no real session - ignoring Supabase auth change');
        return;
      }
      if (currentMockAuth && session?.user) {
        console.log('🔄 Real Supabase session detected - clearing mock auth state');
        localStorage.removeItem('mock_user');
        localStorage.removeItem('is_mock_auth');
        localStorage.removeItem('demo_access_token');
        setIsMockAuth(false);
      }
      
      if (session?.user) {
        console.log('✅ Supabase session found, fetching profile');
        setIsMockAuth(false);
        localStorage.removeItem('is_mock_auth'); // Clear mock auth flag
        
        // Handle Google OAuth sign-in (SIGNED_IN event after OAuth redirect)
        // Check for both SIGNED_IN and TOKEN_REFRESHED events to catch OAuth callback
        const isOAuthCallback = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
        const isOAuthProvider = session.user.app_metadata?.provider === 'google';
        
        if (isOAuthCallback && isOAuthProvider) {
          console.log('🔐 Google OAuth callback detected');
          handleGoogleOAuthCallback(session.user, session.access_token);
        } else {
          fetchUserProfile(session.user.id, session.access_token);
        }
      } else {
        // CRITICAL: Before clearing auth state, verify we're not in mock mode
        const stillMockAuth = localStorage.getItem('is_mock_auth') === 'true' || !!localStorage.getItem('mock_user');
        if (stillMockAuth) {
          console.log('⚠️ Mock auth detected - preserving session despite no Supabase session');
          return;
        }
        console.log('❌ No Supabase session, clearing auth state');
        setUser(null);
        setAccessToken(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount
  
  const handleGoogleOAuthCallback = async (supabaseUser: any, token: string) => {
    // Show logged-in state immediately from Supabase session data.
    const fallbackUser = {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.full_name ||
            supabaseUser.user_metadata?.name ||
            supabaseUser.email?.split('@')[0] ||
            'User',
      role: 'customer' as const
    };
    setUser(fallbackUser);
    setAccessToken(token);
    setIsMockAuth(false);

    try {
      console.log('🔐 [OAuth] Processing Google OAuth callback for user:', supabaseUser.email);
      
      // Check if user profile already exists in backend
      const functionsUrl = `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635`;
      
      // First, try to get existing profile
      const profileResponse = await fetch(`${functionsUrl}/auth/me`, {
        headers: buildHeaders(token)
      });
      
      let userProfile;
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ [OAuth] Existing user profile found');
        userProfile = profileData.user;
      } else {
        // Create new profile for Google OAuth user
        console.log('📝 [OAuth] Creating new profile for Google user');
        
        // Extract name from Google user metadata
        const name = supabaseUser.user_metadata?.full_name || 
                    supabaseUser.user_metadata?.name || 
                    supabaseUser.email?.split('@')[0] || 
                    'User';
        
        // Phone will be 'N/A' initially - user can update later
        const phone = supabaseUser.user_metadata?.phone || 'N/A';
        
        // Create user profile via backend
        const createResponse = await fetch(`${functionsUrl}/auth/google-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildHeaders(token)
          },
          body: JSON.stringify({
            userId: supabaseUser.id,
            email: supabaseUser.email,
            name: name,
            phone: phone,
            source: 'Google OAuth',
            avatar: supabaseUser.user_metadata?.avatar_url
          })
        });
        
        if (createResponse.ok) {
          const createData = await createResponse.json();
          console.log('✅ [OAuth] Profile created successfully');
          userProfile = createData.user;
        } else {
          // If backend creation fails, use local profile
          console.warn('⚠️ [OAuth] Could not create backend profile, using local');
          userProfile = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: name,
            role: 'customer' as const
          };
        }
      }
      
      // Upgrade user from backend profile when available.
      const userObj = {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        role: (userProfile.role || 'customer') as 'admin' | 'customer'
      };
      
      setUser(userObj);
      setAccessToken(token);
      setIsMockAuth(false);
      
      console.log('✅ [OAuth] Google sign-in complete');
    } catch (error) {
      console.error('❌ [OAuth] Error processing Google callback:', error);
      // Fallback: create local user object
      const userObj = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.full_name || 
              supabaseUser.user_metadata?.name || 
              supabaseUser.email?.split('@')[0] || 
              'User',
        role: 'customer' as const
      };
      setUser(userObj);
      setAccessToken(token);
      setIsMockAuth(false);
    }
  };

  const checkUser = async () => {
    try {
      // Real Supabase session should always win over any old mock localStorage.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        console.log('Real Supabase session detected during checkUser:', currentSession.user.email);
        localStorage.removeItem('mock_user');
        localStorage.removeItem('is_mock_auth');
        localStorage.removeItem('demo_access_token');
        setIsMockAuth(false);

        const isGoogleProvider = currentSession.user.app_metadata?.provider === 'google';
        if (isGoogleProvider) {
          await handleGoogleOAuthCallback(currentSession.user, currentSession.access_token);
        } else {
          await fetchUserProfile(currentSession.user.id, currentSession.access_token);
        }
        return;
      }
      console.log('🔍 Checking user authentication...');
      
      // First check for mock user in localStorage
      const mockUser = localStorage.getItem('mock_user');
      if (mockUser) {
        try {
          const parsedUser = JSON.parse(mockUser);
          console.log('✅ Mock user found in localStorage:', parsedUser.email);
          
          // IMPORTANT: Ensure mock auth flag is set for existing sessions
          if (localStorage.getItem('is_mock_auth') !== 'true') {
            console.log('🔧 Setting is_mock_auth flag for existing session');
            localStorage.setItem('is_mock_auth', 'true');
          }
          
          setIsMockAuth(true); // Set this BEFORE setting user
          setUser(parsedUser);
          
          // Check if we have a stored demo token (real JWT)
          const storedDemoToken = localStorage.getItem('demo_access_token');
          if (storedDemoToken && storedDemoToken.includes('.')) {
            console.log('✅ Restoring demo access token for admin');
            setAccessToken(storedDemoToken);
          } else {
            setAccessToken('mock-token-' + parsedUser.id);
          }
          
          setLoading(false);
          console.log('✅ Mock user session restored successfully');
          return; // Exit early - don't check Supabase
        } catch (e) {
          console.error('Failed to parse mock user from localStorage:', e);
          // Clear corrupted data
          localStorage.removeItem('mock_user');
          localStorage.removeItem('is_mock_auth');
          localStorage.removeItem('demo_access_token');
        }
      }

      console.log('🔍 No mock user found, checking Supabase session...');
      // Only check Supabase if no mock user exists
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('✅ Supabase session found:', session.user.email);
        // Clear mock auth flag for real Supabase sessions
        localStorage.removeItem('is_mock_auth');
        setIsMockAuth(false);
        
        // Handle restored Google OAuth sessions too (after redirect/page reload).
        const isGoogleProvider = session.user.app_metadata?.provider === 'google';
        if (isGoogleProvider) {
          console.log('🔐 Restored Google session detected, ensuring profile exists');
          await handleGoogleOAuthCallback(session.user, session.access_token);
        } else {
          await fetchUserProfile(session.user.id, session.access_token);
        }
      } else {
        console.log('ℹ️ No authentication found (neither mock nor Supabase)');
        setIsMockAuth(false);
      }
    } catch (error) {
      console.error('Check user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string, token: string) => {
    try {
      console.log('📡 Fetching user profile for userId:', userId);
      console.log('🔑 Token preview:', token.substring(0, 30) + '...');
      
      // First, always get the current session to ensure we have a fresh token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.error('❌ No valid session found');
        return;
      }
      
      // Use session data directly instead of calling backend
      // This avoids token validation issues
      console.log('✅ Using user data from Supabase session');
      const userObj = {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        role: 'customer' as const
      };
      
      setUser(userObj);
      setAccessToken(session.access_token);
      
      // Optionally try to sync with backend for persistence (non-blocking)
      try {
        const functionsUrl = `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635`;
        fetch(`${functionsUrl}/auth/me`, {
          headers: buildHeaders(session.access_token)
        }).then(response => {
          if (response.ok) {
            console.log('✅ Profile synced with backend');
          } else {
            console.log('⚠️ Could not sync with backend (non-critical)');
          }
        }).catch(e => {
          console.log('⚠️ Backend sync failed (non-critical)');
        });
      } catch (e) {
        // Ignore backend sync errors
      }
    } catch (error) {
      console.error('❌ Fetch user profile error:', error);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log('Login attempt started for:', email);
      
      // Try Supabase authentication first
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('Supabase auth response:', { error: error?.message, hasSession: !!data?.session });

      if (error) {
        // Fallback to mock authentication for demo/testing
        console.log('Supabase auth failed, using mock authentication');
        return mockLogin(email, password);
      }

      if (data.session) {
        console.log('Supabase session found, fetching profile');
        // Clear mock auth flags for real Supabase login
        localStorage.removeItem('mock_user');
        localStorage.removeItem('is_mock_auth');
        setIsMockAuth(false);
        await fetchUserProfile(data.user.id, data.session.access_token);
        return { success: true };
      }

      // No error but no session - fallback to mock
      console.log('No Supabase session, falling back to mock authentication');
      return mockLogin(email, password);
    } catch (error) {
      console.error('Login error:', error);
      // Fallback to mock authentication
      return mockLogin(email, password);
    }
  };

  // Mock authentication fallback (for testing before database setup)
  const mockLogin = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const mockUsers = [
      { id: '1', email: 'admin@honeytranslations.com', password: 'admin123', name: 'Admin User', role: 'admin' as const },
      { id: '2', email: 'customer@example.com', password: 'customer123', name: 'John Doe', role: 'customer' as const }
    ];

    console.log('Mock login attempt:', { email, passwordLength: password.length });
    
    // First check hardcoded demo users
    const mockUser = mockUsers.find(u => u.email === email && u.password === password);
    
    if (mockUser) {
      const userObj = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role
      };
      
      // CRITICAL: For demo admin, fetch a real JWT token from the backend
      let realToken: string | null = null;
      if (mockUser.role === 'admin') {
        try {
          console.log('🔐 Fetching real JWT token for demo admin...');
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/demo-token`,
            {
              headers: {
                'Content-Type': 'application/json',
                'apikey': publicAnonKey,
                'Authorization': `Bearer ${publicAnonKey}`
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.token && data.token.includes('.')) {
              realToken = data.token;
              console.log('✅ Real JWT token obtained for demo admin');
              console.log('   Token preview:', realToken.substring(0, 50) + '...');
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed to fetch demo token, using mock token:', e);
        }
      }
      
      setUser(userObj);
      setAccessToken(realToken || 'mock-token-' + mockUser.id);
      localStorage.setItem('mock_user', JSON.stringify(userObj));
      localStorage.setItem('is_mock_auth', 'true'); // Set mock auth flag
      
      // Store the real token if we got one
      if (realToken) {
        localStorage.setItem('demo_access_token', realToken);
      }
      
      setIsMockAuth(true); // Mark as mock authentication
      setLoading(false);
      return { success: true };
    }

    // Then check registered users from localStorage
    try {
      const registeredUsersStr = localStorage.getItem('registered_users');
      if (registeredUsersStr) {
        const registeredUsers = JSON.parse(registeredUsersStr);
        const registeredUser = registeredUsers.find((u: any) => u.email === email && u.password === password);
        
        if (registeredUser) {
          const userObj = {
            id: registeredUser.id,
            email: registeredUser.email,
            name: registeredUser.name,
            role: registeredUser.role
          };
          setUser(userObj);
          setAccessToken('mock-token-' + registeredUser.id);
          localStorage.setItem('mock_user', JSON.stringify(userObj));
          localStorage.setItem('is_mock_auth', 'true'); // Set mock auth flag
          setIsMockAuth(true); // Mark as mock authentication
          setLoading(false);
          console.log('✅ Login successful for registered user:', email);
          return { success: true };
        }
      }
    } catch (e) {
      console.error('Error checking registered users:', e);
    }

    console.log('Login failed - no matching user found');
    return { success: false, message: 'Invalid email or password' };
  };

  const signup = async (email: string, password: string, name: string, phone?: string): Promise<{ success: boolean; message?: string; requiresLogin?: boolean }> => {
    console.log('📝 [AuthContext] Signup attempt started for:', email);
    console.log('📝 [AuthContext] Name:', name, 'Phone:', phone);
    
    // Try backend signup first, fallback to local if it fails
    try {
      console.log('📡 [AuthContext] Sending signup request to backend...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/auth/signup`,
        {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({
            email,
            password,
            name,
            phone: phone || 'N/A',
            source: window.location.hostname || 'Direct'
          }),
        }
      );

      console.log('📡 [AuthContext] Backend response status:', response.status);
      console.log('📡 [AuthContext] Backend response ok:', response.ok);

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { raw: responseText };
      }
      console.log('📦 [AuthContext] Backend response data:', JSON.stringify(data, null, 2));
      const backendMessage =
        data?.error ||
        data?.message ||
        data?.details ||
        (typeof data?.raw === 'string' ? data.raw : '');

      if (response.ok && data.success) {
        console.log('✅ [AuthContext] Backend signup successful');
        console.log('✅ [AuthContext] User ID:', data.userId);
        
        // Check if user needs to manually login (auto-login failed)
        if (data.requiresLogin) {
          console.log('⚠️ [AuthContext] User created successfully but requires manual login');
          setLoading(false);
          return { success: true, message: 'Account created successfully! Please sign in with your credentials.', requiresLogin: true };
        }
        
        // Set user from backend response
        const userObj = {
          id: data.userId,
          email: email,
          name: name,
          role: 'customer' as const
        };
        
        console.log('👤 [AuthContext] Setting user in state:', userObj);
        setUser(userObj);
        
        // If we have a real session, use it and clear mock auth
        if (data.session?.access_token) {
          console.log('✅ [AuthContext] Using real Supabase session');
          setAccessToken(data.session.access_token);
          setIsMockAuth(false);
          localStorage.removeItem('mock_user');
          localStorage.removeItem('is_mock_auth');
        } else {
          // Fallback to mock token
          console.log('⚠️ [AuthContext] No session token, using mock auth');
          setAccessToken('mock-token-' + data.userId);
          setIsMockAuth(true);
          localStorage.setItem('mock_user', JSON.stringify(userObj));
          localStorage.setItem('is_mock_auth', 'true');
        }
        
        setLoading(false);
        
        
        console.log('✅ [AuthContext] Signup process completed successfully!');
        return { success: true, message: 'Account created successfully!' };
      } else {
        console.log('⚠️ [AuthContext] Backend signup failed, error:', backendMessage || data.error);
        setLoading(false);
        
        // Return a readable backend error (including code/message payloads)
        return { 
          success: false, 
          message: backendMessage || `Signup failed (HTTP ${response.status}). Please try again.` 
        };
      }
    } catch (error) {
      console.error('❌ [AuthContext] Backend signup error:', error);
      console.log('⚠️ [AuthContext] Using local fallback...');
      return mockSignup(email, password, name, phone);
    }
  };

  // Mock signup fallback (for testing before database setup)
  const mockSignup = (email: string, password: string, name: string, phone?: string): { success: boolean; message?: string } => {
    console.log('Mock signup:', { email, name, phone });
    
    // Check if email already exists
    const mockUsers = [
      { email: 'admin@honeytranslations.com' },
      { email: 'customer@example.com' }
    ];
    
    // Check hardcoded demo users
    if (mockUsers.some(u => u.email === email)) {
      console.log('❌ Email already exists (demo user)');
      return { success: false, message: 'An account with this email already exists. Please sign in.' };
    }
    
    // Check registered users
    try {
      const registeredUsersStr = localStorage.getItem('registered_users');
      if (registeredUsersStr) {
        const registeredUsers = JSON.parse(registeredUsersStr);
        if (registeredUsers.some((u: any) => u.email === email)) {
          console.log('❌ Email already exists (registered user)');
          return { success: false, message: 'An account with this email already exists. Please sign in.' };
        }
      }
    } catch (e) {
      console.error('Error checking existing users:', e);
    }
    
    // Create a new customer account with password and phone
    const newUser = {
      id: 'user-' + Date.now(),
      email: email,
      password: password, // Store password for authentication
      name: name,
      phone: phone || 'N/A',
      role: 'customer' as const
    };

    // Set user immediately (don't expose password in user state)
    const userObj = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role
    };
    
    setUser(userObj);
    setAccessToken('mock-token-' + newUser.id);
    setIsMockAuth(true); // Mark as mock authentication
    setLoading(false);

    // Store in localStorage for persistence
    try {
      const registeredUsersStr = localStorage.getItem('registered_users');
      let registeredUsers: any[] = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
      registeredUsers.push(newUser); // Store with password and phone for authentication and admin view
      localStorage.setItem('registered_users', JSON.stringify(registeredUsers));
      localStorage.setItem('mock_user', JSON.stringify(userObj)); // Store without password
      localStorage.setItem('is_mock_auth', 'true'); // Set mock auth flag
      console.log('✅ New user registered successfully:', email, 'with phone:', phone);
    } catch (e) {
      console.error('Failed to store user in localStorage:', e);
    }

    return { success: true, message: 'Account created successfully!' };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
      setIsMockAuth(false); // Clear mock auth flag
      
      // Also clear mock user from localStorage
      localStorage.removeItem('mock_user');
      localStorage.removeItem('is_mock_auth');
      localStorage.removeItem('demo_access_token');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if Supabase fails, clear local state
      setUser(null);
      setAccessToken(null);
      setIsMockAuth(false); // Clear mock auth flag
      localStorage.removeItem('mock_user');
      localStorage.removeItem('is_mock_auth');
      localStorage.removeItem('demo_access_token');
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log('🔐 [Google] Initiating Google Sign-In...');
      
      // Ensure mock auth does not block OAuth callback/session handling.
      localStorage.removeItem('mock_user');
      localStorage.removeItem('is_mock_auth');
      localStorage.removeItem('demo_access_token');
      setIsMockAuth(false);
      
      const { data, error } = await supabase.auth.signInWithOAuth(
        {
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account', // Force account selection
            },
          }
        }
      );

      if (error) {
        console.error('❌ [Google] OAuth error:', error);
        return { success: false, message: error.message || 'Google sign-in failed' };
      }

      console.log('✅ [Google] OAuth initiated successfully, redirecting to Google...');
      // OAuth redirect will happen automatically
      return { success: true };
    } catch (error) {
      console.error('❌ [Google] OAuth exception:', error);
      return { success: false, message: 'An error occurred during Google sign-in' };
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    accessToken,
    login,
    signup,
    loginWithGoogle,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Add display name for better debugging
AuthProvider.displayName = 'AuthProvider';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  // During hot reload, context might be undefined temporarily
  // Return the context even if it's the default value to prevent crashes
  if (!context) {
    console.warn('useAuth called outside AuthProvider - this might be a hot-reload issue');
    // Return a safe default instead of throwing
    return {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      accessToken: null,
      login: async () => ({ success: false, message: 'Auth not initialized' }),
      signup: async () => ({ success: false, message: 'Auth not initialized' }),
      loginWithGoogle: async () => ({ success: false, message: 'Auth not initialized' }),
      logout: () => {},
      loading: true
    };
  }
  return context;
}

