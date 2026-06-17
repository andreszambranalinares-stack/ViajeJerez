import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { TIPOS, labelDe } from '../lib/consumiciones'
import Avatar from './Avatar'

export default function Wrapped({ onClose }) {
  const { usuario } = useUsuario()
  const [data, setData] = useState(null)

  useEffect(() => {
    const cargar = async () => {
      const [u, c, mc, f, r, v] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, avatar_url'),
        supabase.from('consumiciones').select('usuario_id, tipo'),
        supabase
          .from('misiones_completadas')
          .select('usuario_id, estado, mision:misiones(puntos)')
          .eq('estado', 'verificado'),
        supabase.from('fotos').select('id, url, caption, autor:usuarios(nombre, avatar_url)'),
        supabase.from('reacciones').select('foto_id'),
        supabase.from('viaje').select('cerrado_at').eq('id', 1).single(),
      ])
      setData({
        usuarios: u.data ?? [],
        consumiciones: c.data ?? [],
        completadas: mc.data ?? [],
        fotos: f.data ?? [],
        reacciones: r.data ?? [],
        cerradoAt: v.data?.cerrado_at ?? null,
      })
    }
    cargar()
  }, [])

  const reabrir = async () => {
    await supabase.from('viaje').update({ cerrado: false, cerrado_at: null }).eq('id', 1)
    onClose()
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950 flex items-center justify-center text-white">
        Calculando el Wrapped… 🎬
      </div>
    )
  }

  const { usuarios, consumiciones, completadas, fotos, reacciones, cerradoAt } = data
  const nombreDe = (id) => usuarios.find((u) => u.id === id)

  // Totales
  const totalConsumiciones = consumiciones.length
  const desglose = {}
  for (const c of consumiciones) desglose[c.tipo] = (desglose[c.tipo] ?? 0) + 1

  // Puntos y nº de misiones por usuario
  const puntos = {}
  const misionesPorUsuario = {}
  for (const m of completadas) {
    puntos[m.usuario_id] = (puntos[m.usuario_id] ?? 0) + (m.mision?.puntos ?? 0)
    misionesPorUsuario[m.usuario_id] = (misionesPorUsuario[m.usuario_id] ?? 0) + 1
  }

  const cuentaConsumiciones = (filtro) => {
    const acc = {}
    for (const c of consumiciones) {
      if (filtro && c.tipo !== filtro) continue
      acc[c.usuario_id] = (acc[c.usuario_id] ?? 0) + 1
    }
    return acc
  }

  const lider = (mapa) => {
    let id = null
    let val = 0
    for (const [k, n] of Object.entries(mapa)) if (n > val) { val = n; id = k }
    return id ? { usuario: nombreDe(id), valor: val } : null
  }

  const mvp = lider(puntos)
  const maquina = lider(cuentaConsumiciones())
  const reyPotadas = lider(cuentaConsumiciones('potada'))
  const misionero = lider(misionesPorUsuario)

  // Foto estrella (más reacciones)
  const reaccionesPorFoto = {}
  for (const r of reacciones) reaccionesPorFoto[r.foto_id] = (reaccionesPorFoto[r.foto_id] ?? 0) + 1
  let fotoEstrella = null
  let maxReacc = 0
  for (const foto of fotos) {
    const n = reaccionesPorFoto[foto.id] ?? 0
    if (n > maxReacc) { maxReacc = n; fotoEstrella = foto }
  }

  // Podio de puntos (top 3)
  const podio = usuarios
    .map((u) => ({ ...u, pts: puntos[u.id] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3)
    .filter((u) => u.pts > 0)

  const fecha = cerradoAt
    ? new Date(cerradoAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-purple-950 via-neutral-950 to-neutral-950 overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6">
        <div className="text-center">
          <p className="text-5xl">🍷✨</p>
          <h1 className="text-3xl font-black text-white mt-2">Wrapped del Viaje</h1>
          <p className="text-amber-400 font-bold">Viaje a Jerez</p>
          {fecha && <p className="text-white/40 text-sm mt-1">Cerrado el {fecha}</p>}
        </div>

        {/* Total grande */}
        <div className="rounded-3xl bg-white/5 p-6 text-center">
          <p className="text-white/60">Entre todos nos metimos</p>
          <p className="text-6xl font-black text-amber-400 my-1">{totalConsumiciones}</p>
          <p className="text-white/60">cosas por el cuerpo 🫦</p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {TIPOS.filter((t) => desglose[t.id]).map((t) => (
              <span key={t.id} className="rounded-full bg-white/10 text-white text-sm px-3 py-1">
                {t.emoji} {desglose[t.id]} {labelDe(t.id)}
              </span>
            ))}
          </div>
        </div>

        {/* Premios */}
        <div className="space-y-3">
          <Premio emoji="🏆" titulo="MVP del viaje" sub="Más puntos de misiones" g={mvp} unidad="pts" />
          <Premio emoji="🎯" titulo="El misionero" sub="Más misiones cumplidas" g={misionero} unidad="misiones" />
          <Premio emoji="🍺" titulo="Máquina del cuerpo" sub="Más consumiciones" g={maquina} unidad="" />
          {reyPotadas && (
            <Premio emoji="🤮" titulo="Rey de las potadas" sub="Más potadas del viaje" g={reyPotadas} unidad="" />
          )}
        </div>

        {/* Foto estrella */}
        {fotoEstrella && (
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-white font-bold mb-2">📸 Foto estrella · ❤️ {maxReacc}</p>
            <img src={fotoEstrella.url} alt="" className="w-full rounded-2xl object-cover max-h-72" />
            {fotoEstrella.caption && (
              <p className="text-white/80 text-sm mt-2">{fotoEstrella.caption}</p>
            )}
            <p className="text-white/40 text-xs mt-1">— {fotoEstrella.autor?.nombre}</p>
          </div>
        )}

        {/* Podio */}
        {podio.length > 0 && (
          <div className="rounded-3xl bg-white/5 p-4">
            <p className="text-white font-bold mb-3">🥇 Podio de puntos</p>
            <div className="space-y-2">
              {podio.map((u, i) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-xl w-6">{['🥇', '🥈', '🥉'][i]}</span>
                  <Avatar nombre={u.nombre} url={u.avatar_url} size={32} />
                  <span className="text-white flex-1">{u.nombre}</span>
                  <span className="text-amber-400 font-black">{u.pts} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-white/60 text-sm pt-2">
          ¡Hasta el próximo viaje, panda! 🥃
        </p>

        <div className="space-y-2 pt-2">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold py-3"
          >
            Volver a la app
          </button>
          {usuario.es_admin && (
            <button
              onClick={reabrir}
              className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white py-2.5 text-sm"
            >
              🔒 Cerrar Wrapped (admin)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Premio({ emoji, titulo, sub, g, unidad }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 flex items-center gap-3">
      <span className="text-3xl">{emoji}</span>
      <div className="flex-1">
        <p className="text-white font-bold">{titulo}</p>
        <p className="text-white/40 text-xs">{sub}</p>
        {g ? (
          <div className="flex items-center gap-2 mt-1">
            <Avatar nombre={g.usuario?.nombre} url={g.usuario?.avatar_url} size={24} />
            <span className="text-white font-semibold">{g.usuario?.nombre}</span>
          </div>
        ) : (
          <p className="text-white/40 text-sm mt-1">Sin datos 🤷</p>
        )}
      </div>
      {g && (
        <span className="text-amber-400 font-black text-lg">
          {g.valor} {unidad}
        </span>
      )}
    </div>
  )
}
