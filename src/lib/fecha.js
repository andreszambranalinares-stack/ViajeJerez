// El "día" empieza a las 06:00 para que la madrugada (2am, 3am...)
// siga perteneciendo al día anterior y nada desaparezca de golpe.
export const hoy = () => {
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000)
  return d.toLocaleDateString('sv') // YYYY-MM-DD
}

// Inicio del día lógico en formato ISO (UTC) para filtros por created_at.
// Devuelve las 06:00 hora local del día devuelto por hoy().
export const inicioDeHoyISO = () => new Date(hoy() + 'T06:00:00').toISOString()
