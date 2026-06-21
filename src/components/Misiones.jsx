import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { repartirSinRepetir, generarPresetsDiarios } from '../lib/misionesPreset'
import Avatar from './Avatar'

const hoy = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD local
const PUNTOS_MISION = 3

export default function Misiones() {
  const { usuario } = useUsuario()
  const [misiones, setMisiones] = useState([])
  const [completadas, setCompletadas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [trabajando, setTrabajando] = useState(false)
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(false)

  const cargar = async () => {
    const fecha = hoy()
    const [m, u] = await Promise.all([
      supabase.from('misiones').select('*').eq('fecha', fecha).order('created_at'),
      supabase.from('usuarios').select('id, nombre, avatar_url'),
    ])

    let todas = m.data ?? []
    setUsuarios(u.data ?? [])

    // Si no hay misiones anónimas (preset) hoy, las generamos e insertamos
    const presetsExistentes = todas.filter((x) => x.autor_id === null)
    if (presetsExistentes.length === 0) {
      const nuevas = generarPresetsDiarios(fecha)
      const { data: insertadas } = await supabase.from('misiones').insert(nuevas).select()
      if (insertadas?.length) {
        todas = [...todas, ...insertadas]
      }
    }

    setMisiones(todas)

    const ids = todas.map((x) => x.id)
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

  // Separamos las misiones anónimas del día de las escritas por el grupo
  const presets = misiones.filter((m) => m.autor_id === null).slice(0, 3)
  const misionesUsuario = misiones.filter((m) => m.autor_id !== null)

  // ---------- Estado del día (amigo invisible) ----------
  const yaRepartido = misionesUsuario.some((m) => m.propietario_id != null)
  const miEscrita = misionesUsuario.find((m) => m.autor_id === usuario.id)
  const miMision = misionesUsuario.find((m) => m.propietario_id === usuario.id)
  const escritas = misionesUsuario.length
  const todasEscritas = usuarios.length >= 2 && escritas >= usuarios.length

  const miEstado = (misionId) =>
    completadas.find((c) => c.mision_id === misionId && c.usuario_id === usuario.id)

  // ---------- Escribir / editar mi misión ----------
  const guardarEscrita = async () => {
    const titulo = texto.trim()
    if (!titulo) return
    setTrabajando(true)
    if (miEscrita) {
      await supabase.from('misiones').update({ titulo }).eq('id', miEscrita.id)
    } else {
      await supabase.from('misiones').insert({
        fecha: hoy(),
        titulo,
        dificultad: 'facil',
        puntos: PUNTOS_MISION,
        autor_id: usuario.id,
        propietario_id: null,
      })
    }
    setTexto('')
    setEditando(false)
    setTrabajando(false)
  }

  const borrarEscrita = async () => {
    if (!miEscrita) return
    await supabase.from('misiones').delete().eq('id', miEscrita.id)
    setEditando(false)
    setTexto('')
  }

  // ---------- Repartir (amigo invisible) ----------
  const repartir = async () => {
    if (yaRepartido || !todasEscritas) return
    setTrabajando(true)
    const { data: actuales } = await supabase
      .from('misiones')
      .select('id, autor_id, propietario_id')
      .eq('fecha', hoy())
      .not('autor_id', 'is', null) // solo las escritas por el grupo
      .order('created_at')
    const lista = actuales ?? []
    if (lista.some((m) => m.propietario_id != null)) {
      setTrabajando(false)
      return
    }
    const autores = lista.map((m) => m.autor_id)
    const destinos = repartirSinRepetir(autores)
    if (!destinos) {
      setTrabajando(false)
      return
    }
    await Promise.all(
      lista.map((m, i) =>
        supabase.from('misiones').update({ propietario_id: destinos[i] }).eq('id', m.id),
      ),
    )
    setTrabajando(false)
  }

  // ---------- Marcar / verificar ----------
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

  const verificar = async (completada, estado) => {
    await supabase
      .from('misiones_completadas')
      .update({ estado, verificado_por: usuario.id })
      .eq('id', completada.id)
  }

  const borrarTodasHoy = async () => {
    if (!window.confirm('¿Borrar TODAS las misiones de hoy? Se podrá volver a escribir y repartir.')) {
      return
    }
    await supabase.from('misiones').delete().eq('fecha', hoy())
  }

  const mia = miMision ? miEstado(miMision.id) : null

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🎯 Misiones de hoy</h2>
        <p className="text-white/50 text-sm">
          {yaRepartido
            ? '¡Repartidas! Cada uno tiene la suya 🤫'
            : 'Escribe una misión: se le asignará en secreto a otra persona'}
        </p>
      </div>

      {/* ---------- Misiones anónimas del día (preset) ---------- */}
      {presets.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/50 text-xs uppercase tracking-wide font-semibold px-1">
            🎲 Retos del día · para todo el grupo
          </p>
          {presets.map((preset) => {
            const comp = completadas.filter((c) => c.mision_id === preset.id)
            const miComp = miEstado(preset.id)
            const esDificil = preset.dificultad === 'dificil'
            return (
              <div key={preset.id} className="rounded-2xl bg-white/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      esDificil
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {esDificil ? 'DIFÍCIL' : 'FÁCIL'}
                  </span>
                  <span className="text-amber-400 font-bold text-sm">+{preset.puntos} pts</span>
                </div>
                <p className="text-white font-medium">{preset.titulo}</p>

                {/* Quién la ha completado */}
                {comp.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {comp.map((c) => (
                      <div
                        key={c.id}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          c.estado === 'verificado'
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : c.estado === 'rechazado'
                            ? 'bg-rose-500/20 text-rose-200'
                            : 'bg-amber-500/20 text-amber-200'
                        }`}
                      >
                        <Avatar nombre={c.usuario?.nombre} url={c.usuario?.avatar_url} size={14} />
                        {c.usuario?.nombre}
                        {c.estado === 'verificado' ? ' ✅' : c.estado === 'rechazado' ? ' ❌' : ' ⏳'}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => marcar(preset)}
                  disabled={miComp?.estado === 'verificado' || miComp?.estado === 'rechazado'}
                  className={`w-full rounded-lg py-2 font-semibold text-sm transition ${
                    miComp?.estado === 'verificado'
                      ? 'bg-emerald-600 text-white'
                      : miComp?.estado === 'rechazado'
                      ? 'bg-rose-900/50 text-rose-300'
                      : miComp
                      ? 'bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-black'
                  }`}
                >
                  {miComp?.estado === 'verificado'
                    ? '✅ ¡Conseguida y verificada!'
                    : miComp?.estado === 'rechazado'
                    ? '❌ Rechazada por el admin'
                    : miComp
                    ? '⏳ Pendiente de verificar (toca para cancelar)'
                    : '¡La he hecho!'}
                </button>

                {/* Verificación inline para admin */}
                {usuario.es_admin && comp.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-white/10">
                    {comp
                      .filter((c) => c.estado === 'pendiente')
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between">
                          <span className="text-white/60 text-xs">{c.usuario?.nombre}</span>
                          <div className="flex gap-1">
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
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ---------- FASE 1: escribir (amigo invisible) ---------- */}
      {!yaRepartido && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 p-4 space-y-3">
            {miEscrita && !editando ? (
              <>
                <p className="text-white/50 text-xs">✍️ Tu misión (la recibirá otra persona):</p>
                <p className="text-white font-medium">{miEscrita.titulo}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTexto(miEscrita.titulo)
                      setEditando(true)
                    }}
                    className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm py-2 transition"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={borrarEscrita}
                    className="rounded-lg bg-rose-700/70 hover:bg-rose-600 text-white text-sm py-2 px-3 transition"
                  >
                    🗑️
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white/50 text-xs">
                  ✍️ {miEscrita ? 'Edita tu misión' : 'Escribe tu misión de hoy'}
                </p>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="Ej: Consigue que un desconocido te invite a una copa"
                  className="w-full rounded-lg bg-black/30 text-white placeholder-white/30 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-amber-400/50 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={guardarEscrita}
                    disabled={trabajando || !texto.trim()}
                    className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold py-2 text-sm transition"
                  >
                    {miEscrita ? 'Guardar cambios' : 'Guardar mi misión'}
                  </button>
                  {miEscrita && (
                    <button
                      onClick={() => {
                        setEditando(false)
                        setTexto('')
                      }}
                      className="rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-3 transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Quién ha escrito ya */}
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-white/60 text-sm mb-2">
              Han escrito: {escritas}/{usuarios.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {usuarios.map((u) => {
                const listo = misionesUsuario.some((m) => m.autor_id === u.id)
                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${
                      listo ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white/40'
                    }`}
                  >
                    <Avatar nombre={u.nombre} url={u.avatar_url} size={20} />
                    {u.nombre} {listo ? '✓' : '…'}
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={repartir}
            disabled={trabajando || !todasEscritas}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3 transition"
          >
            {usuarios.length < 2
              ? 'Hacen falta al menos 2 personas'
              : todasEscritas
              ? '🎲 Repartir misiones'
              : `Faltan ${usuarios.length - escritas} por escribir`}
          </button>
        </div>
      )}

      {/* ---------- FASE 2: ya repartido, tu misión ---------- */}
      {yaRepartido && (
        <div className="space-y-3">
          {miMision ? (
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  TU MISIÓN
                </span>
                <span className="text-amber-400 font-bold text-sm">+{miMision.puntos} pts</span>
                <span className="text-white/40 text-xs">🤫 anónima</span>
              </div>
              <p className="text-white font-medium">{miMision.titulo}</p>

              <button
                onClick={() => marcar(miMision)}
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
            </div>
          ) : (
            <p className="text-white/40 text-center py-6 text-sm">
              No te tocó misión hoy (no escribiste a tiempo). 😅
            </p>
          )}

          {miEscrita && (
            <p className="text-white/40 text-center text-xs">
              ✍️ La misión que escribiste ya está en manos de alguien…
            </p>
          )}
        </div>
      )}

      {/* ---------- Admin: verificación misiones grupo + reset ---------- */}
      {usuario.es_admin && misionesUsuario.length > 0 && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold">👑 Admin</h3>
            <button
              onClick={borrarTodasHoy}
              className="rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-xs px-3 py-1.5 transition"
              title="Borrar las de hoy para volver a empezar"
            >
              🗑️ Reiniciar hoy
            </button>
          </div>

          {yaRepartido &&
            usuarios.map((u) => {
              const suya = misionesUsuario.find((m) => m.propietario_id === u.id)
              if (!suya) return null
              const comp = completadas.find((c) => c.mision_id === suya.id)
              const autor = usuarios.find((x) => x.id === suya.autor_id)
              return (
                <div key={u.id} className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar nombre={u.nombre} url={u.avatar_url} size={28} />
                    <span className="text-white font-semibold">{u.nombre}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="text-white/90 text-xs flex-1">
                      {suya.titulo}
                      {autor && (
                        <span className="text-white/30"> · de {autor.nombre}</span>
                      )}
                    </p>
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
                </div>
              )
            })}
        </div>
      )}
    </div>
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
