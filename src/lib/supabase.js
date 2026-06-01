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
      // Mock client — simulasi user sudah login untuk testing UI
      auth: {
        getSession: async () => ({
          data: {
            session: {
              user: {
                id: 'dummy-user-id',
                email: 'nuranantoadhien@gmail.com',
                user_metadata: {
                  full_name: 'Nurananto',
                  avatar_url: null,
                  trakteer_email: 'nuranantoadhien@gmail.com',
                },
              },
            },
          },
          error: null,
        }),
        onAuthStateChange: (cb) => {
          // Tidak fire SIGNED_IN sehingga modal Trakteer tidak muncul saat dummy
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithOtp: async () => ({ error: { message: 'Supabase belum dikonfigurasi.' } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase belum dikonfigurasi.' } }),
        signOut: async () => {},
        updateUser: async (updates) => {
          console.log('[Mock] updateUser:', updates);
          return { error: null };
        },
      },
    };
