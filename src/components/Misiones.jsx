import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { generarMisionesDelDia } from '../lib/misionesPreset'
import Avatar from './Avatar'

const hoy = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD local

export default function Misiones() {
  const { usuario } = useUsuario()
  const [misiones, setMisiones] = useState([])
  const [completadas, setCompletadas] = useState([]) // todas las del día
  const [usuarios, setUsuarios] = useState([])
  const [trabajando, setTrabajando] = useState(false)

  const cargar = async () => {
    const fecha = hoy()
    const [m, u] = await Promise.all([
      supabase.from('misiones').select('*').eq('fecha', fecha).order('dificultad'),
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

  // ---------- Acciones de usuario ----------
  const miEstado = (misionId) =>
    completadas.find((c) => c.mision_id === misionId && c.usuario_id === usuario.id)

  const marcar = async (mision) => {
    const ya = miEstado(mision.id)
    if (ya) {
      // Si ya la marqué y sigue pendiente, la desmarco (me he equivocado).
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

  // ---------- Acciones de admin ----------
  const generarHoy = async () => {
    if (misiones.length && !window.confirm('Ya hay misiones hoy. ¿Añadir 3 más?')) return
    setTrabajando(true)
    const nuevas = generarMisionesDelDia(usuarios).map((m) => ({ ...m, fecha: hoy() }))
    await supabase.from('misiones').insert(nuevas)
    setTrabajando(false)
  }

  const añadirManual = async () => {
    const titulo = window.prompt('Texto de la misión:')
    if (!titulo) return
    const dificil = window.confirm('¿Es DIFÍCIL? (Aceptar = difícil 3pts · Cancelar = fácil 1pt)')
    await supabase.from('misiones').insert({
      fecha: hoy(),
      titulo,
      dificultad: dificil ? 'dificil' : 'facil',
      puntos: dificil ? 3 : 1,
    })
  }

  const borrarMision = async (mision) => {
    if (!window.confirm('¿Borrar esta misión?')) return
    await supabase.from('misiones').delete().eq('id', mision.id)
  }

  const verificar = async (completada, estado) => {
    await supabase
      .from('misiones_completadas')
      .update({ estado, verificado_por: usuario.id })
      .eq('id', completada.id)
  }

  const totalHoy = misiones.length
  const verificadasMias = misiones.filter(
    (m) => miEstado(m.id)?.estado === 'verificado',
  ).length

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🎯 Misiones de hoy</h2>
        <p className="text-white/50 text-sm">
          {totalHoy
            ? `Llevas ${verificadasMias}/${totalHoy} verificadas`
            : 'Aún no hay misiones para hoy'}
        </p>
      </div>

      {usuario.es_admin && (
        <div className="flex gap-2">
          <button
            onClick={generarHoy}
            disabled={trabajando}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2 text-sm transition"
          >
            🎲 Generar 3 misiones
          </button>
          <button
            onClick={añadirManual}
            className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold py-2 text-sm transition"
          >
            ✍️ Añadir a mano
          </button>
        </div>
      )}

      {misiones.length === 0 && !usuario.es_admin && (
        <p className="text-white/40 text-center py-8 text-sm">
          El administrador todavía no ha puesto las misiones de hoy. ¡Paciencia! 😉
        </p>
      )}

      <div className="space-y-3">
        {misiones.map((m) => {
          const mia = miEstado(m.id)
          const completadasDeEsta = completadas.filter((c) => c.mision_id === m.id)
          return (
            <div key={m.id} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge dificil={m.dificultad === 'dificil'} />
                    <span className="text-amber-400 font-bold text-sm">+{m.puntos} pts</span>
                  </div>
                  <p className="text-white font-medium">{m.titulo}</p>
                </div>
                {usuario.es_admin && (
                  <button
                    onClick={() => borrarMision(m)}
                    className="text-white/30 hover:text-rose-400 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botón del usuario para marcar */}
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

              {/* Panel admin: verificar a cada uno */}
              {usuario.es_admin && completadasDeEsta.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <p className="text-white/40 text-xs">Verificación:</p>
                  {completadasDeEsta.map((c) => (
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
