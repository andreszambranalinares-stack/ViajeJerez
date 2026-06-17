import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Avisamos por consola si faltan las variables (típico despiste al desplegar).
export const supabaseConfigurado = Boolean(url && anonKey)

if (!supabaseConfigurado) {
  console.warn(
    '⚠️ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env (o configúralas en Cloudflare Pages).',
  )
}

// Si no hay config, creamos un cliente "de mentira" para no romper el render;
// la propia UI mostrará un aviso de configuración.
export const supabase = supabaseConfigurado
  ? createClient(url, anonKey)
  : null
