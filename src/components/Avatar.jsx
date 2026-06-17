// Avatar reutilizable: muestra la foto o las iniciales con un color estable.
const COLORES = [
  'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500',
  'bg-fuchsia-500', 'bg-orange-500', 'bg-teal-500', 'bg-violet-500',
]

function colorDe(nombre = '') {
  let suma = 0
  for (const c of nombre) suma += c.charCodeAt(0)
  return COLORES[suma % COLORES.length]
}

export default function Avatar({ nombre = '?', url, size = 40, className = '' }) {
  const iniciales = nombre.trim().slice(0, 2).toUpperCase() || '?'
  const estilo = { width: size, height: size, fontSize: size * 0.4 }

  if (url) {
    return (
      <img
        src={url}
        alt={nombre}
        style={estilo}
        className={`rounded-full object-cover ring-2 ring-white/20 ${className}`}
      />
    )
  }

  return (
    <div
      style={estilo}
      className={`rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white/20 ${colorDe(nombre)} ${className}`}
    >
      {iniciales}
    </div>
  )
}
