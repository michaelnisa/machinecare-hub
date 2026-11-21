import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { storageService, MobileRole, DriverVehicleBinding } from "../services/storageService";

interface AuthContextType {
  user: any | null;
  role: MobileRole;
  driverVehicle: DriverVehicleBinding | null;
  isLoading: boolean;
  switchRole: (newRole: MobileRole) => Promise<void>;
  pairDriverVehicle: (binding: DriverVehicleBinding) => Promise<void>;
  unpairDriverVehicle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "driver",
  driverVehicle: null,
  isLoading: true,
  switchRole: async () => {},
  pairDriverVehicle: async () => {},
  unpairDriverVehicle: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<MobileRole>("driver");
  const [driverVehicle, setDriverVehicle] = useState<DriverVehicleBinding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const savedRole = await storageService.getActiveRole();
        setRole(savedRole);

        const savedBinding = await storageService.getDriverVehicle();
        setDriverVehicle(savedBinding);

        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
      } catch (err) {
        console.warn("Failed to initialize mobile auth:", err);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const switchRole = async (newRole: MobileRole) => {
    setRole(newRole);
    await storageService.setActiveRole(newRole);
  };

  const pairDriverVehicle = async (binding: DriverVehicleBinding) => {
    setDriverVehicle(binding);
    await storageService.setDriverVehicle(binding);
  };

  const unpairDriverVehicle = async () => {
    setDriverVehicle(null);
    await storageService.setDriverVehicle(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await unpairDriverVehicle();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        driverVehicle,
        isLoading,
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
