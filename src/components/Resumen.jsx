import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { TIPOS, emojiDe, labelDe } from '../lib/consumiciones'
import Avatar from './Avatar'

const hoy = () => new Date().toLocaleDateString('sv')

function inicioDeHoyISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Resumen() {
  const [usuarios, setUsuarios] = useState([])
  const [consumiciones, setConsumiciones] = useState([]) // solo de hoy
  const [puntos, setPuntos] = useState({}) // puntos de misiones de hoy por usuario

  const cargar = async () => {
    const desde = inicioDeHoyISO()
    const [u, c, mc] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, avatar_url'),
      supabase.from('consumiciones').select('usuario_id, tipo, created_at').gte('created_at', desde),
      supabase
        .from('misiones_completadas')
        .select('usuario_id, estado, mision:misiones(puntos, fecha)')
        .eq('estado', 'verificado'),
    ])
    setUsuarios(u.data ?? [])
    setConsumiciones(c.data ?? [])

    const pts = {}
    for (const row of mc.data ?? []) {
      if (row.mision?.fecha === hoy()) {
        pts[row.usuario_id] = (pts[row.usuario_id] ?? 0) + (row.mision?.puntos ?? 0)
      }
    }
    setPuntos(pts)
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('resumen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumiciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'misiones_completadas' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  // --- Cálculos del día ---
  const nombreDe = (id) => usuarios.find((u) => u.id === id)
  const total = consumiciones.length

  const desglose = {}
  for (const c of consumiciones) desglose[c.tipo] = (desglose[c.tipo] ?? 0) + 1

  const cuentaPorUsuario = (filtro) => {
    const acc = {}
    for (const c of consumiciones) {
      if (filtro && c.tipo !== filtro) continue
      acc[c.usuario_id] = (acc[c.usuario_id] ?? 0) + 1
    }
    return acc
  }

  const lider = (mapa) => {
    let mejorId = null
    let mejor = 0
    for (const [id, n] of Object.entries(mapa)) {
      if (n > mejor) {
        mejor = n
        mejorId = id
      }
    }
    return mejorId ? { usuario: nombreDe(mejorId), valor: mejor } : null
  }

  const mvp = lider(puntos)
  const maquina = lider(cuentaPorUsuario())
  const reyPotadas = lider(cuentaPorUsuario('potada'))

  const fechaBonita = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">📊 Resumen del día</h2>
        <p className="text-white/50 text-sm capitalize">{fechaBonita}</p>
      </div>

      {/* Destacados */}
      <div className="grid grid-cols-1 gap-3">
        <Destacado
          titulo="🏆 MVP del día"
          sub="Más puntos de misiones hoy"
          dato={mvp ? `${mvp.valor} pts` : '—'}
          usuario={mvp?.usuario}
          color="from-amber-500/20 to-amber-700/10 ring-amber-400/40"
        />
        <Destacado
          titulo="🍺 Máquina del cuerpo"
          sub="Más consumiciones hoy"
          dato={maquina ? `${maquina.valor}` : '—'}
          usuario={maquina?.usuario}
          color="from-sky-500/20 to-sky-700/10 ring-sky-400/40"
        />
        {reyPotadas && (
          <Destacado
            titulo="🤮 Rey de las potadas"
            sub="Quién ha potado más hoy"
            dato={`${reyPotadas.valor}`}
            usuario={reyPotadas.usuario}
            color="from-lime-500/20 to-green-700/10 ring-lime-400/40"
          />
        )}
      </div>

      {/* Totales del grupo */}
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="text-white/60 text-sm">Hoy entre todos llevamos</p>
        <p className="text-4xl font-black text-white">{total}</p>
        <p className="text-white/40 text-xs mb-3">cosas que han entrado (o salido 🤢) por el cuerpo</p>
        <div className="flex flex-wrap gap-2">
          {TIPOS.filter((t) => desglose[t.id]).map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-white/10 text-white text-sm px-3 py-1"
            >
              {t.emoji} {desglose[t.id]} {labelDe(t.id)}
            </span>
          ))}
          {total === 0 && <span className="text-white/40 text-sm">Aún nada hoy 😴</span>}
        </div>
      </div>

      <p className="text-center text-white/30 text-xs">
        El resumen se reinicia cada día a medianoche.
      </p>
    </div>
  )
}

function Destacado({ titulo, sub, dato, usuario, color }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ring-1 p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-bold">{titulo}</p>
          <p className="text-white/50 text-xs">{sub}</p>
        </div>
        <span className="text-2xl font-black text-white">{dato}</span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {usuario ? (
          <>
            <Avatar nombre={usuario.nombre} url={usuario.avatar_url} size={32} />
            <span className="text-white font-semibold">{usuario.nombre}</span>
          </>
        ) : (
          <span className="text-white/40 text-sm">Aún sin candidato 👀</span>
        )}
      </div>
    </div>
  )
}
