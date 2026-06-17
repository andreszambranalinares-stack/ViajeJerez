import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import Avatar from './Avatar'

function formatFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Galeria() {
  const { usuario } = useUsuario()
  const [fotos, setFotos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [ampliada, setAmpliada] = useState(null)
  // Foto elegida y a la espera de añadirle texto antes de publicar.
  const [pendiente, setPendiente] = useState(null) // { file, preview }
  const [caption, setCaption] = useState('')
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

  const elegir = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCaption('')
    setPendiente({ file, preview: URL.createObjectURL(file) })
    if (inputFoto.current) inputFoto.current.value = ''
  }

  const publicar = async () => {
    if (!pendiente) return
    setSubiendo(true)
    try {
      const ext = pendiente.file.name.split('.').pop()
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos').upload(ruta, pendiente.file)
      if (upErr) throw upErr
      const url = supabase.storage.from('fotos').getPublicUrl(ruta).data.publicUrl
      await supabase.from('fotos').insert({
        usuario_id: usuario.id,
        url,
        caption: caption.trim() || null,
      })
      setPendiente(null)
      setCaption('')
    } catch (err) {
      console.error(err)
      alert(
        'No se pudo subir la foto.\n\nLo más probable: el bucket "fotos" no existe o no es público.\n' +
          'En Supabase → Storage, créalo como PÚBLICO y vuelve a ejecutar las políticas del schema.sql.',
      )
    } finally {
      setSubiendo(false)
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
        📸 Subir una foto
      </button>
      <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={elegir} />

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
              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
                <div className="flex items-center gap-1">
                  <Avatar nombre={f.autor?.nombre} url={f.autor?.avatar_url} size={20} />
                  <span className="text-white text-xs truncate">{f.autor?.nombre}</span>
                </div>
                {f.caption && <p className="text-white/90 text-xs truncate mt-0.5">{f.caption}</p>}
                <p className="text-white/50 text-[10px] mt-0.5">{formatFecha(f.created_at)}</p>
              </div>
              {(f.usuario_id === usuario.id || usuario.es_admin) && (
                <button
                  onClick={() => borrar(f)}
                  className="absolute top-1 right-1 bg-black/50 text-white text-xs rounded-full w-6 h-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                  title={f.usuario_id === usuario.id ? 'Borrar tu foto' : 'Borrar (admin)'}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Composer: añadir texto antes de publicar */}
      {pendiente && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
          onClick={() => !subiendo && setPendiente(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={pendiente.preview} alt="" className="w-full max-h-72 object-contain rounded-xl" />
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="¿Qué ha pasado aquí? 😏 (ej: mira qué cabrón ha hecho...)"
              rows={2}
              maxLength={200}
              autoFocus
              className="w-full rounded-xl bg-white/10 text-white placeholder-white/40 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPendiente(null)}
                disabled={subiendo}
                className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 text-white py-2.5"
              >
                Cancelar
              </button>
              <button
                onClick={publicar}
                disabled={subiendo}
                className="flex-[2] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2.5"
              >
                {subiendo ? 'Subiendo…' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Foto ampliada */}
      {ampliada && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <img src={ampliada.url} alt="" className="max-h-[75vh] max-w-full rounded-xl" />
          {ampliada.caption && <p className="text-white mt-3 text-center px-4">{ampliada.caption}</p>}
          <p className="text-white/50 text-sm mt-1">
            {ampliada.autor?.nombre} · {formatFecha(ampliada.created_at)}
          </p>
        </div>
      )}
    </div>
  )
}
