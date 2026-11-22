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
  hasCompletedOnboarding: boolean;
  isFieldMode: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<{ error?: any }>;
  switchRole: (newRole: MobileRole) => Promise<void>;
  pairDriverVehicle: (binding: DriverVehicleBinding) => Promise<void>;
  unpairDriverVehicle: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  enterFieldMode: () => Promise<void>;
  exitFieldMode: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organisation: null,
  role: "driver",
  driverVehicle: null,
  isLoading: true,
  hasCompletedOnboarding: false,
  isFieldMode: false,
  signInWithEmail: async () => ({}),
  switchRole: async () => {},
  pairDriverVehicle: async () => {},
  unpairDriverVehicle: async () => {},
  completeOnboarding: async () => {},
  enterFieldMode: async () => {},
  exitFieldMode: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [organisation, setOrganisation] = useState<any | null>(null);
  const [role, setRole] = useState<MobileRole>("driver");
  const [driverVehicle, setDriverVehicle] = useState<DriverVehicleBinding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isFieldMode, setIsFieldMode] = useState(false);

  const autoDetectAndSetRole = async (userEmail?: string, userRole?: string) => {
    try {
      if (userEmail) {
        const { data: driverMatch } = await supabase
          .from("drivers")
          .select("id, name")
          .eq("email", userEmail)
          .limit(1)
          .maybeSingle();

        if (driverMatch) {
          setRole("driver");
          await storageService.setActiveRole("driver");
          return;
        }
      }

      if (userRole) {
        const r = userRole.toLowerCase();
        if (r.includes("mechanic") || r.includes("technician") || r.includes("workshop")) {
          setRole("mechanic");
          await storageService.setActiveRole("mechanic");
        } else if (r.includes("dispatcher") || r.includes("fleet") || r.includes("admin")) {
          setRole("dispatcher");
          await storageService.setActiveRole("dispatcher");
        } else if (r.includes("telematics") || r.includes("gps")) {
          setRole("telematics");
          await storageService.setActiveRole("telematics");
        }
      }
    } catch (e) {
      console.warn("Auto detect role error:", e);
    }
  };

  const fetchUserProfile = async (userId: string, userEmail?: string) => {
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
        await autoDetectAndSetRole(userEmail, data.role);
      }
    } catch (e) {
      console.warn("Failed to fetch user profile:", e);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const [savedOnboarding, savedFieldMode, savedRole, savedBinding, savedProf] = await Promise.all([
          storageService.hasCompletedOnboarding(),
          storageService.isFieldModeEnabled(),
          storageService.getActiveRole(),
          storageService.getDriverVehicle(),
          storageService.getSavedProfile(),
        ]);

        setHasCompletedOnboarding(savedOnboarding);
        setIsFieldMode(savedFieldMode);
        setRole(savedRole);
        setDriverVehicle(savedBinding);

        if (savedProf) {
          setProfile(savedProf.profile);
          setOrganisation(savedProf.organisation);
        }

        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchUserProfile(currentUser.id, currentUser.email);
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
        setIsFieldMode(false);
        await storageService.setFieldMode(false);
        await fetchUserProfile(u.id, u.email);
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
      setIsFieldMode(false);
      await storageService.setFieldMode(false);
      if (data.user) {
        await fetchUserProfile(data.user.id, data.user.email);
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

  const completeOnboarding = async () => {
    setHasCompletedOnboarding(true);
    await storageService.setCompletedOnboarding(true);
  };

  const enterFieldMode = async () => {
    setIsFieldMode(true);
    await storageService.setFieldMode(true);
  };

  const exitFieldMode = async () => {
    setIsFieldMode(false);
    await storageService.setFieldMode(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await unpairDriverVehicle();
    await storageService.clearAllAuth();
    setUser(null);
    setProfile(null);
    setOrganisation(null);
    setIsFieldMode(false);
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
