import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { generarMisionesDelDia, generarUnaDificil } from '../lib/misionesPreset'
import Avatar from './Avatar'

const hoy = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD local

export default function Misiones() {
  const { usuario } = useUsuario()
  const [misiones, setMisiones] = useState([]) // todas las de hoy (grupo + personales)
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

  // ---------- Reparto de misiones ----------
  const grupo = misiones.filter((m) => !m.propietario_id)
  const grupoExiste = grupo.length > 0
  const faciles = grupo.filter((m) => m.dificultad === 'facil')
  const dificilGrupo = grupo.find((m) => m.dificultad === 'dificil')
  const miDificil = misiones.find(
    (m) => m.propietario_id === usuario.id && m.dificultad === 'dificil',
  )
  // Lo que ve el jugador actual: 2 fáciles + su difícil (personal si la re-roleó).
  const misMisiones = [...faciles, miDificil ?? dificilGrupo].filter(Boolean)

  // ---------- Acciones de usuario ----------
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
    if (miDificil || !dificilGrupo) return // ya usó su re-roll o no hay difícil aún
    setTrabajando(true)
    // 1) Quitamos mi posible marca en la difícil de grupo (ya no es la mía).
    const previa = miEstado(dificilGrupo.id)
    if (previa) await supabase.from('misiones_completadas').delete().eq('id', previa.id)
    // 2) Creamos mi difícil personal.
    const nueva = generarUnaDificil(usuarios)
    await supabase.from('misiones').insert({
      ...nueva,
      fecha: hoy(),
      propietario_id: usuario.id,
    })
    setTrabajando(false)
  }

  // ---------- Acciones de admin ----------
  const generarHoy = async () => {
    if (grupoExiste) return // solo una vez al día
    setTrabajando(true)
    const nuevas = generarMisionesDelDia(usuarios).map((m) => ({ ...m, fecha: hoy() }))
    await supabase.from('misiones').insert(nuevas)
    setTrabajando(false)
  }

  const borrarTodasHoy = async () => {
    if (!window.confirm('¿Borrar TODAS las misiones de hoy (incluidos los re-rolls)? Se podrá volver a generar.')) {
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

  const totalHoy = misMisiones.length
  const verificadasMias = misMisiones.filter(
    (m) => miEstado(m.id)?.estado === 'verificado',
  ).length

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🎯 Misiones de hoy</h2>
        <p className="text-white/50 text-sm">
          {grupoExiste
            ? `Llevas ${verificadasMias}/${totalHoy} verificadas`
            : 'Aún no hay misiones para hoy'}
        </p>
      </div>

      {/* Controles de admin */}
      {usuario.es_admin && (
        <div className="flex gap-2">
          <button
            onClick={generarHoy}
            disabled={trabajando || grupoExiste}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-2 text-sm transition"
          >
            {grupoExiste ? '✅ Generadas hoy' : '🎲 Generar misiones del día'}
          </button>
          {grupoExiste && (
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

      {!grupoExiste && (
        <p className="text-white/40 text-center py-8 text-sm">
          {usuario.es_admin
            ? 'Pulsa "Generar misiones del día" para empezar.'
            : 'El administrador todavía no ha puesto las misiones de hoy. ¡Paciencia! 😉'}
        </p>
      )}

      {/* Mis misiones (jugador) */}
      <div className="space-y-3">
        {misMisiones.map((m) => {
          const mia = miEstado(m.id)
          const esDificil = m.dificultad === 'dificil'
          const esPersonal = m.propietario_id === usuario.id
          return (
            <div key={m.id} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge dificil={esDificil} />
                <span className="text-amber-400 font-bold text-sm">+{m.puntos} pts</span>
                {esPersonal && (
                  <span className="text-sky-300 text-xs">🔁 tu re-roll</span>
                )}
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

              {/* Re-roll: solo en la difícil, una vez al día por persona */}
              {esDificil && (
                <button
                  onClick={reRoll}
                  disabled={!!miDificil || trabajando || !!mia}
                  className="mt-2 w-full rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm py-1.5 transition"
                >
                  {miDificil ? '🔁 Re-roll ya usado' : '🔁 Cambiar mi difícil (1 vez)'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Panel de verificación (admin): cubre grupo + re-rolls de todos */}
      {usuario.es_admin && grupoExiste && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <h3 className="text-white font-bold">👑 Verificación</h3>
          {misiones.map((m) => {
            const comps = completadas.filter((c) => c.mision_id === m.id)
            const dueno = m.propietario_id
              ? usuarios.find((u) => u.id === m.propietario_id)
              : null
            return (
              <div key={m.id} className="rounded-xl bg-white/5 p-3">
                <div className="flex items-start gap-2">
                  <Badge dificil={m.dificultad === 'dificil'} />
                  <p className="text-white text-sm flex-1">{m.titulo}</p>
                </div>
                {dueno && (
                  <p className="text-sky-300 text-xs mt-1">🔁 re-roll de {dueno.nombre}</p>
                )}
                {comps.length === 0 ? (
                  <p className="text-white/30 text-xs mt-2">Nadie la ha marcado aún.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {comps.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <Avatar nombre={c.usuario?.nombre} url={c.usuario?.avatar_url} size={24} />
                        <span className="text-white text-sm flex-1 truncate">
                          {c.usuario?.nombre}
                        </span>
                        <EstadoMini estado={c.estado} />
                        <button
                          onClick={() => verificar(c, 'verificado')}
                          className="rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs px-2 py-1"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => verificar(c, 'rechazado')}
                          className="rounded bg-rose-700/80 hover:bg-rose-600 text-white text-xs px-2 py-1"
                        >
                          ✗
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
