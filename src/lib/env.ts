export const appName = process.env.NEXT_PUBLIC_APP_NAME || "H&H SPACES";
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yvocwptxawxmloacpdrt.supabase.co";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_L5569z24IpKtZwC-HkVI0g_C9ol2fmj";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
