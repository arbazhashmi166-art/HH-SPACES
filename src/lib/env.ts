export const appName = process.env.NEXT_PUBLIC_APP_NAME || "SiteTracker Pro";
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
