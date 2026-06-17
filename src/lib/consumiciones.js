// Catálogo de "cosas que entran por el cuerpo".
// Añade, quita o cambia emojis a tu gusto: la app se adapta sola.
export const TIPOS = [
  { id: 'cubata',  label: 'Cubata',  emoji: '🥃', color: 'from-amber-500 to-orange-600' },
  { id: 'cerveza', label: 'Cerveza', emoji: '🍺', color: 'from-yellow-400 to-amber-500' },
  { id: 'fino',    label: 'Fino',    emoji: '🍷', color: 'from-rose-400 to-rose-600' },
  { id: 'chupito', label: 'Chupito', emoji: '🥂', color: 'from-fuchsia-500 to-purple-600' },
  { id: 'cigarro', label: 'Cigarro', emoji: '🚬', color: 'from-slate-400 to-slate-600' },
  { id: 'agua',    label: 'Agua',    emoji: '💧', color: 'from-sky-400 to-blue-600' },
]

export const TIPOS_POR_ID = Object.fromEntries(TIPOS.map((t) => [t.id, t]))

export function emojiDe(tipo) {
  return TIPOS_POR_ID[tipo]?.emoji ?? '❓'
}

export function labelDe(tipo) {
  return TIPOS_POR_ID[tipo]?.label ?? tipo
}
