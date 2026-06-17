import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import Avatar from './Avatar'

export default function Login() {
  const { setUsuario } = useUsuario()
  const [nombre, setNombre] = useState('')
  const [fotoFile, setFotoFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const inputFoto = useRef(null)

  const elegirFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const entrar = async (e) => {
    e.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) {
      setError('Ponte un nombre, anda 😄')
      return
    }
    setCargando(true)
    setError('')

    try {
      // 1) ¿Ya existe alguien con ese nombre? Reutilizamos su ficha.
      const { data: existentes } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('nombre', limpio)
        .limit(1)

      let usuario = existentes?.[0]

      // 2) Subimos avatar si han elegido foto.
      let avatarUrl = usuario?.avatar_url ?? null
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const ruta = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(ruta, fotoFile, { upsert: true })
        if (upErr) throw upErr
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(ruta).data.publicUrl
      }

      // 3) Creamos o actualizamos la ficha.
      if (usuario) {
        if (avatarUrl && avatarUrl !== usuario.avatar_url) {
          const { data } = await supabase
            .from('usuarios')
            .update({ avatar_url: avatarUrl })
            .eq('id', usuario.id)
            .select()
            .single()
          usuario = data ?? usuario
        }
      } else {
        const { data, error: insErr } = await supabase
          .from('usuarios')
          .insert({ nombre: limpio, avatar_url: avatarUrl })
          .select()
          .single()
        if (insErr) throw insErr
        usuario = data
      }

      setUsuario(usuario)
    } catch (err) {
      console.error(err)
      setError('Algo ha fallado al entrar. ¿Está configurado Supabase? Mira la consola.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-2">🍷</div>
      <h1 className="text-3xl font-black text-white">Viaje a Jerez</h1>
      <p className="text-white/60 mb-8">Lo que pasa en Jerez... se queda apuntado.</p>

      <form onSubmit={entrar} className="w-full max-w-xs space-y-4">
        <button
          type="button"
          onClick={() => inputFoto.current?.click()}
          className="mx-auto block"
          title="Ponte una foto (opcional)"
        >
          {preview ? (
            <Avatar nombre={nombre} url={preview} size={88} />
          ) : (
            <div className="w-[88px] h-[88px] rounded-full bg-white/10 flex items-center justify-center text-3xl ring-2 ring-white/20">
              📷
            </div>
          )}
        </button>
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={elegirFoto}
        />

        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          autoFocus
          className="w-full rounded-xl bg-white/10 text-white placeholder-white/40 px-4 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-amber-400"
        />

        {error && <p className="text-rose-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 text-lg transition"
        >
          {cargando ? 'Entrando…' : '¡Entrar al viaje!'}
        </button>
      </form>

      <p className="text-white/30 text-xs mt-8 max-w-xs">
        Sin contraseñas. Solo tu nombre. La foto es opcional.
      </p>
    </div>
  )
}
