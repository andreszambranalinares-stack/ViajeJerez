import { useState } from 'react'
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

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar nombre={usuario.nombre} url={usuario.avatar_url} size={48} />
          <div>
            <p className="text-white font-bold text-lg">{usuario.nombre}</p>
            {usuario.es_admin && <p className="text-amber-400 text-sm">👑 Administrador</p>}
          </div>
        </div>

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
          <button
            onClick={quitarseAdmin}
            className="w-full rounded-lg bg-white/10 hover:bg-white/20 text-white py-2 text-sm"
          >
            Dejar de ser administrador
          </button>
        )}

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
