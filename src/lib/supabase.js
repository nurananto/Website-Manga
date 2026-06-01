import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Jika belum dikonfigurasi, gunakan mock client agar tidak crash
const isConfigured = url && key && url !== 'https://your-project.supabase.co';

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithOtp: async () => ({ error: { message: 'Supabase belum dikonfigurasi.' } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase belum dikonfigurasi.' } }),
        signOut: async () => {},
        updateUser: async () => ({ error: null }),
      },
    };
