import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { generarMisionesParaTodos, generarUnaDificil } from '../lib/misionesPreset'
import Avatar from './Avatar'

const hoy = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD local

export default function Misiones() {
  const { usuario } = useUsuario()
  const [misiones, setMisiones] = useState([]) // todas las de hoy (de todos)
  const [completadas, setCompletadas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [trabajando, setTrabajando] = useState(false)

  const cargar = async () => {
    const fecha = hoy()
    const [m, u] = await Promise.all([
      supabase.from('misiones').select('*').eq('fecha', fecha).order('created_at'),
      supabase.from('usuarios').select('id, nombre, avatar_url'),
    ])
    setMisiones(m.data ?? [])
    setUsuarios(u.data ?? [])

    const ids = (m.data ?? []).map((x) => x.id)
    if (ids.length) {
      const { data: c } = await supabase
        .from('misiones_completadas')
        .select('*, usuario:usuarios(nombre, avatar_url)')
        .in('mision_id', ids)
      setCompletadas(c ?? [])
    } else {
      setCompletadas([])
    }
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('misiones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'misiones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'misiones_completadas' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  // ---------- Mis misiones (cada uno las suyas) ----------
  const misMisiones = misiones.filter((m) => m.propietario_id === usuario.id)
  const misFaciles = misMisiones.filter((m) => m.dificultad === 'facil')
  const miDificil = misMisiones.find((m) => m.dificultad === 'dificil')
  const misOrdenadas = [...misFaciles, miDificil].filter(Boolean)
  const tengoMisiones = misMisiones.length > 0

  const miEstado = (misionId) =>
    completadas.find((c) => c.mision_id === misionId && c.usuario_id === usuario.id)

  const marcar = async (mision) => {
    const ya = miEstado(mision.id)
    if (ya) {
      if (ya.estado === 'pendiente') {
        await supabase.from('misiones_completadas').delete().eq('id', ya.id)
      }
      return
    }
    await supabase.from('misiones_completadas').insert({
      mision_id: mision.id,
      usuario_id: usuario.id,
      estado: 'pendiente',
    })
  }

  const reRoll = async () => {
    if (!miDificil || miDificil.es_reroll) return
    setTrabajando(true)
    // Quitamos mi marca en la difícil anterior (si la tenía) y la borramos.
    const previa = miEstado(miDificil.id)
    if (previa) await supabase.from('misiones_completadas').delete().eq('id', previa.id)
    await supabase.from('misiones').delete().eq('id', miDificil.id)
    // Creamos mi nueva difícil (marcada como re-roll).
    const nueva = generarUnaDificil(usuario, usuarios)
    await supabase.from('misiones').insert({
      ...nueva,
      fecha: hoy(),
      propietario_id: usuario.id,
      es_reroll: true,
    })
    setTrabajando(false)
  }

  // ---------- Admin ----------
  // Genera misiones para quien aún no tenga (cubre también a los que se unan tarde).
  const sinMisiones = usuarios.filter(
    (u) => !misiones.some((m) => m.propietario_id === u.id),
  )

  const generar = async () => {
    if (sinMisiones.length === 0) return
    setTrabajando(true)
    const nuevas = generarMisionesParaTodos(sinMisiones, usuarios).map((m) => ({
      ...m,
      fecha: hoy(),
    }))
    await supabase.from('misiones').insert(nuevas)
    setTrabajando(false)
  }

  const borrarTodasHoy = async () => {
    if (!window.confirm('¿Borrar TODAS las misiones de hoy (de todos)? Se podrá volver a generar.')) {
      return
    }
    await supabase.from('misiones').delete().eq('fecha', hoy())
  }

  const verificar = async (completada, estado) => {
    await supabase
      .from('misiones_completadas')
      .update({ estado, verificado_por: usuario.id })
      .eq('id', completada.id)
  }

  const verificadasMias = misOrdenadas.filter(
    (m) => miEstado(m.id)?.estado === 'verificado',
  ).length

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🎯 Tus misiones de hoy</h2>
        <p className="text-white/50 text-sm">
          {tengoMisiones
            ? `Llevas ${verificadasMias}/${misOrdenadas.length} verificadas`
            : 'Aún no tienes misiones para hoy'}
        </p>
      </div>

      {/* Controles de admin */}
      {usuario.es_admin && (
        <div className="flex gap-2">
          <button
            onClick={generar}
            disabled={trabajando || sinMisiones.length === 0}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-2 text-sm transition"
          >
            {sinMisiones.length === 0
              ? '✅ Todos tienen misiones'
              : `🎲 Generar misiones (${sinMisiones.length})`}
          </button>
          {misiones.length > 0 && (
            <button
              onClick={borrarTodasHoy}
              className="rounded-xl bg-rose-700/80 hover:bg-rose-600 text-white font-semibold py-2 px-3 text-sm transition"
              title="Borrar las de hoy para volver a generar"
            >
              🗑️
            </button>
          )}
        </div>
      )}

      {!tengoMisiones && (
        <p className="text-white/40 text-center py-8 text-sm">
          {usuario.es_admin
            ? 'Pulsa "Generar misiones" para repartir las de hoy.'
            : 'El administrador todavía no ha repartido las misiones. ¡Paciencia! 😉'}
        </p>
      )}

      {/* Mis misiones */}
      <div className="space-y-3">
        {misOrdenadas.map((m) => {
          const mia = miEstado(m.id)
          const esDificil = m.dificultad === 'dificil'
          return (
            <div key={m.id} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge dificil={esDificil} />
                <span className="text-amber-400 font-bold text-sm">+{m.puntos} pts</span>
                {m.es_reroll && <span className="text-sky-300 text-xs">🔁 re-roll</span>}
              </div>
              <p className="text-white font-medium">{m.titulo}</p>

              <button
                onClick={() => marcar(m)}
                disabled={mia?.estado === 'verificado' || mia?.estado === 'rechazado'}
                className={`mt-3 w-full rounded-lg py-2 font-semibold text-sm transition ${
                  mia?.estado === 'verificado'
                    ? 'bg-emerald-600 text-white'
                    : mia?.estado === 'rechazado'
                    ? 'bg-rose-900/50 text-rose-300'
                    : mia
                    ? 'bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/40'
                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                }`}
              >
                {mia?.estado === 'verificado'
                  ? '✅ ¡Conseguida y verificada!'
                  : mia?.estado === 'rechazado'
                  ? '❌ Rechazada por el admin'
                  : mia
                  ? '⏳ Pendiente de verificar (toca para cancelar)'
                  : '¡La he hecho!'}
              </button>

              {esDificil && (
                <button
                  onClick={reRoll}
                  disabled={miDificil?.es_reroll || trabajando || !!mia}
                  className="mt-2 w-full rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm py-1.5 transition"
                >
                  {miDificil?.es_reroll ? '🔁 Re-roll ya usado' : '🔁 Cambiar mi difícil (1 vez)'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Verificación (admin): agrupada por persona */}
      {usuario.es_admin && misiones.length > 0 && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <h3 className="text-white font-bold">👑 Verificación</h3>
          {usuarios.map((u) => {
            const sus = misiones.filter((m) => m.propietario_id === u.id)
            if (sus.length === 0) return null
            return (
              <div key={u.id} className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar nombre={u.nombre} url={u.avatar_url} size={28} />
                  <span className="text-white font-semibold">{u.nombre}</span>
                </div>
                <div className="space-y-2">
                  {sus.map((m) => {
                    const comp = completadas.find((c) => c.mision_id === m.id)
                    return (
                      <div key={m.id} className="flex items-start gap-2">
                        <Badge dificil={m.dificultad === 'dificil'} />
                        <p className="text-white/90 text-xs flex-1">{m.titulo}</p>
                        {comp ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <EstadoMini estado={comp.estado} />
                            <button
                              onClick={() => verificar(comp, 'verificado')}
                              className="rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs px-2 py-1"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => verificar(comp, 'rechazado')}
                              className="rounded bg-rose-700/80 hover:bg-rose-600 text-white text-xs px-2 py-1"
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <span className="text-white/30 text-xs shrink-0">sin marcar</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Badge({ dificil }) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
        dificil ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
      }`}
    >
      {dificil ? 'DIFÍCIL' : 'FÁCIL'}
    </span>
  )
}

function EstadoMini({ estado }) {
  const map = {
    pendiente: ['⏳', 'text-amber-300'],
    verificado: ['✅', 'text-emerald-300'],
    rechazado: ['❌', 'text-rose-300'],
  }
  const [icono, color] = map[estado] ?? ['', '']
  return <span className={`text-xs ${color}`}>{icono}</span>
}
