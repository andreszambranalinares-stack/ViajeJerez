import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { TIPOS, emojiDe } from '../lib/consumiciones'
import Avatar from './Avatar'

const MEDALLAS = ['🥇', '🥈', '🥉']

export default function Ranking() {
  const { usuario } = useUsuario()
  const [usuarios, setUsuarios] = useState([])
  const [consumiciones, setConsumiciones] = useState([])
  const [puntos, setPuntos] = useState({}) // { usuario_id: puntos }

  const cargar = async () => {
    const [u, c, mc] = await Promise.all([
      supabase.from('usuarios').select('*'),
      supabase.from('consumiciones').select('usuario_id, tipo'),
      supabase
        .from('misiones_completadas')
        .select('usuario_id, estado, mision:misiones(puntos)')
        .eq('estado', 'verificado'),
    ])
    setUsuarios(u.data ?? [])
    setConsumiciones(c.data ?? [])

    const pts = {}
    for (const row of mc.data ?? []) {
      pts[row.usuario_id] = (pts[row.usuario_id] ?? 0) + (row.mision?.puntos ?? 0)
    }
    setPuntos(pts)
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('ranking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumiciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'misiones_completadas' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  // Marcador del cuerpo: total de consumiciones por persona, con desglose.
  const porCuerpo = usuarios
    .map((u) => {
      const suyas = consumiciones.filter((c) => c.usuario_id === u.id)
      const desglose = {}
      for (const c of suyas) desglose[c.tipo] = (desglose[c.tipo] ?? 0) + 1
      return { ...u, total: suyas.length, desglose }
    })
    .sort((a, b) => b.total - a.total)

  const porPuntos = usuarios
    .map((u) => ({ ...u, pts: puntos[u.id] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)

  return (
    <div className="space-y-8">
      {/* ---- Puntos de misiones ---- */}
      <section>
        <h2 className="text-white font-black text-lg mb-3">🏆 Puntos de misiones</h2>
        <div className="space-y-2">
          {porPuntos.map((u, i) => (
            <Fila key={u.id} pos={i} u={u} destacar={u.id === usuario.id}>
              <span className="text-2xl font-black text-amber-400">{u.pts}</span>
            </Fila>
          ))}
          {porPuntos.length === 0 && <Vacio texto="Aún nadie tiene puntos." />}
        </div>
      </section>

      {/* ---- Marcador del cuerpo ---- */}
      <section>
        <h2 className="text-white font-black text-lg mb-3">🍻 Marcador del cuerpo</h2>
        <div className="space-y-2">
          {porCuerpo.map((u, i) => (
            <Fila key={u.id} pos={i} u={u} destacar={u.id === usuario.id}>
              <span className="text-2xl font-black text-white">{u.total}</span>
            </Fila>
          ))}
          {porCuerpo.length === 0 && <Vacio texto="Aún no hay consumiciones." />}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 justify-center text-white/40 text-xs">
          {TIPOS.map((t) => (
            <span key={t.id}>{t.emoji} {t.label}</span>
          ))}
        </div>
      </section>
    </div>
  )
}

function Fila({ pos, u, destacar, children }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        destacar ? 'bg-amber-500/15 ring-1 ring-amber-400/40' : 'bg-white/5'
      }`}
    >
      <span className="w-6 text-center text-lg">{MEDALLAS[pos] ?? pos + 1}</span>
      <Avatar nombre={u.nombre} url={u.avatar_url} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{u.nombre}</p>
        {u.desglose && (
          <p className="text-white/50 text-xs truncate">
            {Object.entries(u.desglose).map(([tipo, n]) => `${emojiDe(tipo)}${n}`).join('  ') || '—'}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function Vacio({ texto }) {
  return <p className="text-white/40 text-sm text-center py-4">{texto}</p>
}
