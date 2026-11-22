import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * MachineCare Shared Supabase Cloud Database Client
 * Shares the exact same PostgreSQL backend, RLS policies, tables,
 * and Auth instances as the MachineCare WebApp.
 */
export const SUPABASE_URL = "https://hvihfqlzwblsytdvkanz.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2aWhmcWx6d2Jsc3l0ZHZrYW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MDI3NDYsImV4cCI6MjA5ODI3ODc0Nn0.TCps84iRDDeHhHtFAuu_H2ggFGBWKxyJyWsM6oUibFo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
