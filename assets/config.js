// Public runtime configuration for the browser. The build overwrites this file from the environment:
//   SUPABASE_URL=https://xxxx.supabase.co  SUPABASE_ANON_KEY=<anon public key>  npm run build
// Leave both empty to run the app in "this device only" mode. Never put the service-role key here.
export const CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };
