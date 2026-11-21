import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { storageService, MobileRole, DriverVehicleBinding } from "../services/storageService";

interface AuthContextType {
  user: any | null;
  profile: any | null;
  organisation: any | null;
  role: MobileRole;
  driverVehicle: DriverVehicleBinding | null;
  isLoading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<{ error?: any }>;
  switchRole: (newRole: MobileRole) => Promise<void>;
  pairDriverVehicle: (binding: DriverVehicleBinding) => Promise<void>;
  unpairDriverVehicle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organisation: null,
  role: "driver",
  driverVehicle: null,
  isLoading: true,
  signInWithEmail: async () => ({}),
  switchRole: async () => {},
  pairDriverVehicle: async () => {},
  unpairDriverVehicle: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [organisation, setOrganisation] = useState<any | null>(null);
  const [role, setRole] = useState<MobileRole>("driver");
  const [driverVehicle, setDriverVehicle] = useState<DriverVehicleBinding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          organisation_id,
          full_name,
          role,
          organisations:organisation_id (id, name, logo_url)
        `)
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        const org = (data as any).organisations;
        if (org) {
          setOrganisation(org);
        }
        await storageService.setSavedProfile({ profile: data, organisation: org });
      }
    } catch (e) {
      console.warn("Failed to fetch user profile:", e);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const savedRole = await storageService.getActiveRole();
        setRole(savedRole);

        const savedBinding = await storageService.getDriverVehicle();
        setDriverVehicle(savedBinding);

        const savedProf = await storageService.getSavedProfile();
        if (savedProf) {
          setProfile(savedProf.profile);
          setOrganisation(savedProf.organisation);
        }

        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchUserProfile(currentUser.id);
        }
      } catch (err) {
        console.warn("Failed to initialize mobile auth:", err);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await fetchUserProfile(u.id);
      } else {
        setProfile(null);
        setOrganisation(null);
        await storageService.setSavedProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) return { error };
      setUser(data.user);
      if (data.user) {
        await fetchUserProfile(data.user.id);
      }
      return {};
    } catch (err: any) {
      return { error: err };
    }
  };

  const switchRole = async (newRole: MobileRole) => {
    setRole(newRole);
    await storageService.setActiveRole(newRole);
  };

  const pairDriverVehicle = async (binding: DriverVehicleBinding) => {
    const enriched = {
      ...binding,
      organisationId: binding.organisationId || organisation?.id || null,
    };
    setDriverVehicle(enriched);
    await storageService.setDriverVehicle(enriched);
  };

  const unpairDriverVehicle = async () => {
    setDriverVehicle(null);
    await storageService.setDriverVehicle(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await unpairDriverVehicle();
    setUser(null);
    setProfile(null);
    setOrganisation(null);
    await storageService.setSavedProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        organisation,
        role,
        driverVehicle,
        isLoading,
        signInWithEmail,
        switchRole,
        pairDriverVehicle,
        unpairDriverVehicle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
