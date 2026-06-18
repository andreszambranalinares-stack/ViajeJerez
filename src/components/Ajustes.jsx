import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import Avatar from './Avatar'

// Código para hacerse administrador. Configúralo en .env / Cloudflare.
// Si no defines nada, por defecto es "jerez".
const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || 'jerez'

export default function Ajustes({ onClose }) {
  const { usuario, setUsuario, cerrarSesion } = useUsuario()
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState('')

  // ---- Edición de perfil ----
  const [nombre, setNombre] = useState(usuario.nombre)
  const [guardando, setGuardando] = useState(false)
  const [perfilMsg, setPerfilMsg] = useState('')
  const inputFoto = useRef(null)

  // ---- Gestión de personas (admin) ----
  const [personas, setPersonas] = useState([])

  const cargarPersonas = async () => {
    if (!usuario.es_admin) return
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, avatar_url, created_at')
      .order('created_at')
    setPersonas(data ?? [])
  }

  useEffect(() => {
    cargarPersonas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.es_admin])

  const guardarNombre = async () => {
    const limpio = nombre.trim()
    if (!limpio || limpio === usuario.nombre) return
    setGuardando(true)
    const { data } = await supabase
      .from('usuarios')
      .update({ nombre: limpio })
      .eq('id', usuario.id)
      .select()
      .single()
    setUsuario(data ?? { ...usuario, nombre: limpio })
    setPerfilMsg('Nombre actualizado ✅')
    setGuardando(false)
  }

  const cambiarFoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGuardando(true)
    setPerfilMsg('')
    try {
      const ext = file.name.split('.').pop()
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(ruta, file)
      if (upErr) throw upErr
      const url = supabase.storage.from('avatars').getPublicUrl(ruta).data.publicUrl
      const { data } = await supabase
        .from('usuarios')
        .update({ avatar_url: url })
        .eq('id', usuario.id)
        .select()
        .single()
      setUsuario(data ?? { ...usuario, avatar_url: url })
      setPerfilMsg('Foto actualizada ✅')
    } catch (err) {
      console.error(err)
      setPerfilMsg('No se pudo subir la foto 😕')
    } finally {
      setGuardando(false)
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  const hacerseAdmin = async () => {
    if (codigo.trim() !== ADMIN_CODE) {
      setMsg('Código incorrecto 🙈')
      return
    }
    const { data } = await supabase
      .from('usuarios')
      .update({ es_admin: true })
      .eq('id', usuario.id)
      .select()
      .single()
    setUsuario(data ?? { ...usuario, es_admin: true })
    setMsg('¡Ya eres administrador! 👑')
  }

  const quitarseAdmin = async () => {
    const { data } = await supabase
      .from('usuarios')
      .update({ es_admin: false })
      .eq('id', usuario.id)
      .select()
      .single()
    setUsuario(data ?? { ...usuario, es_admin: false })
  }

  const borrarPersona = async (p) => {
    if (p.id === usuario.id) {
      alert('No puedes borrarte a ti mismo desde aquí. Usa "Cerrar sesión".')
      return
    }
    if (!window.confirm(`¿Borrar a "${p.nombre}"? Se eliminan sus consumiciones y misiones.`)) {
      return
    }
    // Limpiamos primero todo lo que cuelga de esa persona (por si algún
    // FK no tiene cascade en tu base de datos) y luego borramos al usuario.
    await supabase.from('reacciones').delete().eq('usuario_id', p.id)
    await supabase.from('misiones_completadas').delete().eq('usuario_id', p.id)
    await supabase.from('misiones_completadas').update({ verificado_por: null }).eq('verificado_por', p.id)
    await supabase.from('consumiciones').delete().eq('usuario_id', p.id)
    await supabase.from('misiones').delete().eq('propietario_id', p.id)
    await supabase.from('misiones').update({ objetivo_id: null }).eq('objetivo_id', p.id)
    await supabase.from('fotos').update({ usuario_id: null }).eq('usuario_id', p.id)

    const { error } = await supabase.from('usuarios').delete().eq('id', p.id)
    if (error) {
      console.error(error)
      alert('No se pudo borrar: ' + error.message)
      return
    }
    cargarPersonas()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white font-black text-xl">Tu perfil</h2>

        {/* ---- Foto + nombre ---- */}
        <div className="flex items-center gap-4">
          <button onClick={() => inputFoto.current?.click()} className="relative shrink-0">
            <Avatar nombre={usuario.nombre} url={usuario.avatar_url} size={64} />
            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-xs rounded-full w-6 h-6 flex items-center justify-center">
              ✎
            </span>
          </button>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={cambiarFoto}
          />
          <div className="flex-1">
            <label className="text-white/50 text-xs">Tu nombre</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="flex-1 min-w-0 rounded-lg bg-white/10 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={guardarNombre}
                disabled={guardando || !nombre.trim() || nombre.trim() === usuario.nombre}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold px-3 text-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
        {perfilMsg && <p className="text-white/70 text-sm -mt-2">{perfilMsg}</p>}
        <p className="text-white/40 text-xs -mt-2">
          Toca tu foto para cambiarla. {usuario.es_admin && '👑 Eres administrador.'}
        </p>

        <hr className="border-white/10" />

        {/* ---- Admin ---- */}
        {!usuario.es_admin ? (
          <div className="space-y-2">
            <p className="text-white/60 text-sm">¿Eres el organizador? Mete el código de admin:</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código"
                className="flex-1 rounded-lg bg-white/10 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={hacerseAdmin}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4"
              >
                Entrar
              </button>
            </div>
            {msg && <p className="text-white/70 text-sm">{msg}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Gestión de personas */}
            <div>
              <p className="text-white/60 text-sm mb-2">
                👥 Personas del viaje ({personas.length})
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {personas.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
                    <Avatar nombre={p.nombre} url={p.avatar_url} size={28} />
                    <span className="text-white text-sm flex-1 truncate">
                      {p.nombre}
                      {p.id === usuario.id && <span className="text-white/40"> (tú)</span>}
                    </span>
                    <button
                      onClick={() => borrarPersona(p)}
                      disabled={p.id === usuario.id}
                      className="text-white/30 hover:text-rose-400 disabled:opacity-20 text-sm px-2"
                      title="Borrar persona"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-1">
                Útil para borrar registros duplicados.
              </p>
            </div>

            <button
              onClick={quitarseAdmin}
              className="w-full rounded-lg bg-white/10 hover:bg-white/20 text-white py-2 text-sm"
            >
              Dejar de ser administrador
            </button>
          </div>
        )}

        <hr className="border-white/10" />

        <button
          onClick={() => {
            cerrarSesion()
            onClose()
          }}
          className="w-full rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-semibold py-2.5"
        >
          Cerrar sesión
        </button>

        <button onClick={onClose} className="w-full text-white/40 text-sm py-1">
          Cerrar
        </button>
      </div>
    </div>
  )
}
