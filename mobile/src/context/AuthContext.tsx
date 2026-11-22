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
  signUpWithEmail: (params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    industryProfile: "manufacturing" | "fleet_logistics" | "garage" | "gps_tracking";
    roleTitle?: string;
  }) => Promise<{ error?: any; data?: any }>;
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
  signUpWithEmail: async () => ({}),
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

  const autoDetectAndSetRole = async (
    userEmail?: string,
    userRole?: string,
    department?: string,
    industryProfile?: string
  ) => {
    try {
      const dept = (department || "").toLowerCase();
      const uRole = (userRole || "").toLowerCase();
      const ind = (industryProfile || "").toLowerCase();

      // 1. Manufacturing Priority Detection
      if (
        ind === "manufacturing" ||
        dept.includes("manufacturing") ||
        dept.includes("production") ||
        dept.includes("plant") ||
        uRole.includes("operator") ||
        uRole.includes("manufacturing") ||
        uRole.includes("production")
      ) {
        setRole("manufacturing");
        await storageService.setActiveRole("manufacturing");
        return;
      }

      // 2. Commercial Driver Detection (drivers table match)
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

      // 3. Garage & Workshop Mechanic
      if (
        ind === "garage" ||
        dept.includes("garage") ||
        dept.includes("workshop") ||
        dept.includes("maintenance") ||
        uRole.includes("mechanic") ||
        uRole.includes("technician")
      ) {
        setRole("mechanic");
        await storageService.setActiveRole("mechanic");
        return;
      }

      // 4. GPS & Telematics Technician
      if (
        ind === "gps_tracking" ||
        dept.includes("telematics") ||
        dept.includes("gps") ||
        uRole.includes("telematics") ||
        uRole.includes("gps")
      ) {
        setRole("telematics");
        await storageService.setActiveRole("telematics");
        return;
      }

      // 5. Fleet & Logistics Dispatcher / Manager
      if (
        ind === "fleet_logistics" ||
        dept.includes("fleet") ||
        dept.includes("logistics") ||
        dept.includes("transport") ||
        uRole.includes("dispatcher") ||
        uRole.includes("fleet") ||
        uRole.includes("admin")
      ) {
        setRole("dispatcher");
        await storageService.setActiveRole("dispatcher");
        return;
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
          department,
          organisations:organisation_id (id, name, logo_url, industry_profile)
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

        // Query assigned user roles
        const { data: userRoleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const assignedRole = userRoleRows?.[0]?.role;

        await autoDetectAndSetRole(userEmail, assignedRole, data.department, org?.industry_profile);
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

  const signUpWithEmail = async (params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    industryProfile: "manufacturing" | "fleet_logistics" | "garage" | "gps_tracking";
    roleTitle?: string;
  }) => {
    try {
      const company = params.companyName.trim() || "My Company";
      const signupMetaData = {
        full_name: params.fullName.trim(),
        company_name: company,
        organisation_name: company,
        industry_profile: params.industryProfile,
        department:
          params.industryProfile === "manufacturing"
            ? "production"
            : params.industryProfile === "garage"
            ? "workshop"
            : "fleet",
        role: params.roleTitle || "operator",
      };

      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: signupMetaData,
        },
      });

      if (error) return { error };

      // Set immediate role based on selected module
      if (params.industryProfile === "manufacturing") {
        setRole("manufacturing");
        await storageService.setActiveRole("manufacturing");
      } else if (params.industryProfile === "garage") {
        setRole("mechanic");
        await storageService.setActiveRole("mechanic");
      } else if (params.industryProfile === "gps_tracking") {
        setRole("telematics");
        await storageService.setActiveRole("telematics");
      } else if (params.industryProfile === "fleet_logistics") {
        setRole("driver");
        await storageService.setActiveRole("driver");
      }

      if (data?.session && data.user) {
        setUser(data.user);
        setIsFieldMode(false);
        await storageService.setFieldMode(false);
        await fetchUserProfile(data.user.id, data.user.email);
      }

      return { data };
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
        hasCompletedOnboarding,
        isFieldMode,
        signInWithEmail,
        signUpWithEmail,
        switchRole,
        pairDriverVehicle,
        unpairDriverVehicle,
        completeOnboarding,
        enterFieldMode,
        exitFieldMode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
