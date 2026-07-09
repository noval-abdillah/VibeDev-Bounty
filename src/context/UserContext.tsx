"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { UserProfile, UserRole } from "@/types";
import { supabase } from "@/lib/supabase/client";

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, name")
        .eq("id", userId)
        .single();

      if (data && !error) {
        setUser({
          email,
          role: data.role as UserRole,
          name: data.name,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || "");
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || "");
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, role: UserRole): Promise<boolean> => {
    try {
      // Sign in using Supabase Auth with standard password.
      // For testing/mocking, we can use a standard password like "password123" for test accounts.
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: "password123",
      });

      if (error || !data.user) {
        return false;
      }

      await fetchProfile(data.user.id, email);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
