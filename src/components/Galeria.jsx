import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import Avatar from './Avatar'

export default function Galeria() {
  const { usuario } = useUsuario()
  const [fotos, setFotos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [ampliada, setAmpliada] = useState(null)
  const inputFoto = useRef(null)

  const cargar = async () => {
    const { data } = await supabase
      .from('fotos')
      .select('*, autor:usuarios(nombre, avatar_url)')
      .order('created_at', { ascending: false })
    setFotos(data ?? [])
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('fotos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fotos' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  const subir = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      const ext = file.name.split('.').pop()
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos').upload(ruta, file)
      if (upErr) throw upErr
      const url = supabase.storage.from('fotos').getPublicUrl(ruta).data.publicUrl
      const caption = window.prompt('Ponle un pie de foto (opcional):') || null
      await supabase.from('fotos').insert({ usuario_id: usuario.id, url, caption })
    } catch (err) {
      console.error(err)
      alert('No se pudo subir la foto. ¿Creaste el bucket "fotos" como público?')
    } finally {
      setSubiendo(false)
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  const borrar = async (foto) => {
    if (!window.confirm('¿Borrar esta foto?')) return
    await supabase.from('fotos').delete().eq('id', foto.id)
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => inputFoto.current?.click()}
        disabled={subiendo}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 transition"
      >
        {subiendo ? 'Subiendo…' : '📸 Subir una foto'}
      </button>
      <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={subir} />

      {fotos.length === 0 ? (
        <p className="text-white/40 text-center py-8">
          Todavía no hay fotos. ¡Sube la primera (cuanto más horrible, mejor)!
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative group">
              <img
                src={f.url}
                alt={f.caption || ''}
                onClick={() => setAmpliada(f)}
                className="w-full aspect-square object-cover rounded-xl cursor-pointer"
              />
              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl">
                <div className="flex items-center gap-1">
                  <Avatar nombre={f.autor?.nombre} url={f.autor?.avatar_url} size={20} />
                  <span className="text-white text-xs truncate">{f.autor?.nombre}</span>
                </div>
                {f.caption && <p className="text-white/90 text-xs truncate mt-0.5">{f.caption}</p>}
              </div>
              {f.usuario_id === usuario.id && (
                <button
                  onClick={() => borrar(f)}
                  className="absolute top-1 right-1 bg-black/50 text-white text-xs rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {ampliada && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <img src={ampliada.url} alt="" className="max-h-[80vh] max-w-full rounded-xl" />
          {ampliada.caption && <p className="text-white mt-3 text-center">{ampliada.caption}</p>}
          <p className="text-white/50 text-sm mt-1">— {ampliada.autor?.nombre}</p>
        </div>
      )}
    </div>
  )
}
