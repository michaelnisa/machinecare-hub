import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser } from "@/lib/sentry";

interface Profile {
  id: string;
  organisation_id: string;
  full_name: string | null;
  department: string | null;
  phone: string | null;
}

export type IndustryProfile =
  "manufacturing" | "fleet_logistics" | "garage" | "mixed";

export interface BusinessHoursDay {
  open: string;
  close: string;
  closed: boolean;
}
export type BusinessHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", BusinessHoursDay>;

interface Organisation {
  id: string;
  name: string;
  industry_profile: IndustryProfile;
  logo_url: string | null;
  plan: "lite" | "standard";
  default_tax_rate_percent: number;
  phone: string | null;
  address: string | null;
  business_hours: BusinessHours;
  invoice_footer_note: string | null;
  accepted_payment_methods: string[];
  default_labour_rate_per_hour: number;
  default_message_channel: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organisation: Organisation | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(prof as Profile | null);
    if (prof?.organisation_id) {
      const { data: org } = await supabase
        .from("organisations")
        .select("*")
        .eq("id", prof.organisation_id)
        .maybeSingle();
      setOrganisation(org as Organisation | null);
    }
  };

  const refresh = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer to avoid deadlock
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setOrganisation(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        loadProfile(sess.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setSentryUser(user ? { id: user.id, email: user.email } : null, profile?.organisation_id);
  }, [user, profile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organisation,
        loading,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
