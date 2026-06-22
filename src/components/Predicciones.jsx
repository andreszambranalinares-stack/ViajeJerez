import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import Avatar from './Avatar'
import { hoy } from '../lib/fecha'

export default function Predicciones() {
  const { usuario } = useUsuario()
  const [usuarios, setUsuarios] = useState([])
  const [predis, setPredis] = useState([])
  const [votos, setVotos] = useState([])
  const [sujetoId, setSujetoId] = useState('')
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    const fecha = hoy()
    const [u, p] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, avatar_url').order('nombre'),
      supabase
        .from('predicciones')
        .select('*, autor:autor_id(nombre), sujeto:sujeto_id(nombre, avatar_url)')
        .eq('fecha', fecha)
        .order('created_at'),
    ])
    setUsuarios(u.data ?? [])
    setPredis(p.data ?? [])

    const ids = (p.data ?? []).map((x) => x.id)
    if (ids.length) {
      const { data: v } = await supabase
        .from('predicciones_votos')
        .select('*')
        .in('prediccion_id', ids)
      setVotos(v ?? [])
    } else {
      setVotos([])
    }
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('predicciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predicciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predicciones_votos' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  const añadir = async () => {
    if (!sujetoId || !texto.trim()) return
    setGuardando(true)
    await supabase.from('predicciones').insert({
      fecha: hoy(),
      autor_id: usuario.id,
      sujeto_id: sujetoId,
      texto: texto.trim(),
    })
    setTexto('')
    setSujetoId('')
    setGuardando(false)
  }

  const borrar = async (p) => {
    if (!window.confirm('¿Borrar esta predicción?')) return
    await supabase.from('predicciones').delete().eq('id', p.id)
  }

  const votar = async (prediccion, cumplio) => {
    const miVoto = votos.find(
      (v) => v.prediccion_id === prediccion.id && v.usuario_id === usuario.id,
    )
    if (miVoto && miVoto.cumplio === cumplio) {
      // Mismo voto otra vez -> lo quito
      await supabase.from('predicciones_votos').delete().eq('id', miVoto.id)
      return
    }
    await supabase
      .from('predicciones_votos')
      .upsert(
        { prediccion_id: prediccion.id, usuario_id: usuario.id, cumplio },
        { onConflict: 'prediccion_id,usuario_id' },
      )
  }

  const votosDe = (pid) => {
    let si = 0
    let no = 0
    let mio = null
    for (const v of votos) {
      if (v.prediccion_id !== pid) continue
      if (v.cumplio) si++
      else no++
      if (v.usuario_id === usuario.id) mio = v.cumplio
    }
    return { si, no, mio }
  }

  const miasHoy = predis.filter((p) => p.autor_id === usuario.id).length

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🔮 ¿Quién es más probable que…?</h2>
        <p className="text-white/50 text-sm">
          Escribe tus predicciones del día. Al final se votan. (Llevas {miasHoy})
        </p>
      </div>

      {/* Formulario para añadir */}
      <div className="rounded-2xl bg-white/5 p-4 space-y-3">
        <select
          value={sujetoId}
          onChange={(e) => setSujetoId(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">¿De quién va? Elige a alguien…</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="…se va a poner borracho hoy"
          maxLength={120}
          className="w-full rounded-lg bg-white/10 text-white placeholder-white/40 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={añadir}
          disabled={guardando || !sujetoId || !texto.trim()}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-2.5"
        >
          ➕ Añadir predicción
        </button>
      </div>

      {/* Lista de predicciones */}
      <div className="space-y-3">
        {predis.length === 0 && (
          <p className="text-white/40 text-center py-6 text-sm">
            Aún no hay predicciones. ¡Sé el primero en mojarte! 🔮
          </p>
        )}
        {predis.map((p) => {
          const { si, no, mio } = votosDe(p.id)
          const veredicto = si + no === 0 ? null : si > no ? 'cumplio' : si < no ? 'fallo' : 'empate'
          return (
            <div key={p.id} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-start gap-2">
                <Avatar nombre={p.sujeto?.nombre} url={p.sujeto?.avatar_url} size={36} />
                <div className="flex-1">
                  <p className="text-white">
                    <span className="font-bold">{p.sujeto?.nombre}</span> {p.texto}
                  </p>
                  <p className="text-white/40 text-xs">propuesta por {p.autor?.nombre ?? '—'}</p>
                </div>
                {veredicto && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      veredicto === 'cumplio'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : veredicto === 'fallo'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {veredicto === 'cumplio' ? '✅ Cumplió' : veredicto === 'fallo' ? '❌ No' : 'Empate'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => votar(p, true)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${
                    mio === true ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  ✅ Se cumplió {si > 0 && <span className="opacity-80">· {si}</span>}
                </button>
                <button
                  onClick={() => votar(p, false)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${
                    mio === false ? 'bg-rose-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  ❌ No {no > 0 && <span className="opacity-80">· {no}</span>}
                </button>
                {(p.autor_id === usuario.id || usuario.es_admin) && (
                  <button
                    onClick={() => borrar(p)}
                    className="text-white/30 hover:text-rose-400 px-1"
                    title="Borrar"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
