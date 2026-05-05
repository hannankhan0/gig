// src/context/AuthContext.jsx
// global auth state — wraps entire app
// handles: login state, token refresh, auto-register after email verification

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import API from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // flag to prevent AuthContext from interfering while a manual login/signup is in progress
  // set to true during handleGoogle / handleSignIn in AuthPage
  const manualLoginInProgressRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // if a manual login is in progress, let that handle navigation
      // AuthContext will pick up the state after it finishes
      if (manualLoginInProgressRef.current) {
        setLoading(false);
        return;
      }

      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          // force fresh token — fixes stale emailVerified after clicking link
          // and ensures Google token is valid
          await firebaseUser.getIdToken(true);

          const res = await API.post('/auth/login');
          setUser(res.data.user);
        } catch (err) {
          // 404 = firebase account exists but no DB profile yet
          // this happens for new Google users — CompleteProfilePage handles it
          setUser(null);
        }
      } else {
        const storedDevUser = localStorage.getItem('gg_user');
        const devToken = localStorage.getItem('gg_dev_token');
        if (devToken && storedDevUser) {
          setUser(JSON.parse(storedDevUser));
        } else {
          setUser(null);
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, manualLoginInProgressRef }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
