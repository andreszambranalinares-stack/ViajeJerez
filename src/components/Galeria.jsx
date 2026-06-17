import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { EMOJIS_REACCION } from '../lib/reacciones'
import Avatar from './Avatar'

const MAX_SEG_VIDEO = 16 // toleramos 1s de margen sobre los 15

function formatFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Lee la duración de un vídeo (en segundos) antes de subirlo.
function duracionVideo(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src)
      resolve(v.duration)
    }
    v.onerror = () => reject(new Error('No se pudo leer el vídeo'))
    v.src = URL.createObjectURL(file)
  })
}

export default function Galeria() {
  const { usuario } = useUsuario()
  const [fotos, setFotos] = useState([])
  const [reacciones, setReacciones] = useState([]) // todas las reacciones
  const [subiendo, setSubiendo] = useState(false)
  const [ampliada, setAmpliada] = useState(null)
  const [aviso, setAviso] = useState('')
  // Foto elegida y a la espera de añadirle texto antes de publicar.
  const [pendiente, setPendiente] = useState(null) // { file, preview }
  const [caption, setCaption] = useState('')
  const inputFoto = useRef(null)

  const cargar = async () => {
    const [f, r] = await Promise.all([
      supabase
        .from('fotos')
        .select('*, autor:usuarios(nombre, avatar_url)')
        .order('created_at', { ascending: false }),
      supabase.from('reacciones').select('foto_id, usuario_id, emoji'),
    ])
    setFotos(f.data ?? [])
    setReacciones(r.data ?? [])
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('fotos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fotos' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reacciones' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  // Total de reacciones de una foto.
  const totalReacciones = (fotoId) => reacciones.filter((r) => r.foto_id === fotoId).length

  // Cuántas de cada emoji + si yo he reaccionado con ese emoji.
  const reaccionesDe = (fotoId) => {
    const conteo = {}
    let mias = new Set()
    for (const r of reacciones) {
      if (r.foto_id !== fotoId) continue
      conteo[r.emoji] = (conteo[r.emoji] ?? 0) + 1
      if (r.usuario_id === usuario.id) mias.add(r.emoji)
    }
    return { conteo, mias }
  }

  const toggleReaccion = async (fotoId, emoji) => {
    const yaReaccione = reacciones.some(
      (r) => r.foto_id === fotoId && r.usuario_id === usuario.id && r.emoji === emoji,
    )
    if (yaReaccione) {
      await supabase
        .from('reacciones')
        .delete()
        .eq('foto_id', fotoId)
        .eq('usuario_id', usuario.id)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('reacciones')
        .insert({ foto_id: fotoId, usuario_id: usuario.id, emoji })
    }
  }

  const elegir = async (e) => {
    const file = e.target.files?.[0]
    if (inputFoto.current) inputFoto.current.value = ''
    if (!file) return
    const esVideo = file.type.startsWith('video')
    if (esVideo) {
      const dur = await duracionVideo(file).catch(() => null)
      if (dur != null && dur > MAX_SEG_VIDEO) {
        setAviso(`⛔ El vídeo dura ${Math.round(dur)}s. El máximo son 15 segundos.`)
        return
      }
    }
    setAviso('')
    setCaption('')
    setPendiente({ file, preview: URL.createObjectURL(file), esVideo })
  }

  const publicar = async () => {
    if (!pendiente) return
    setSubiendo(true)
    try {
      const ext = pendiente.file.name.split('.').pop()
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('fotos')
        .upload(ruta, pendiente.file, { contentType: pendiente.file.type || undefined })
      if (upErr) throw upErr
      const url = supabase.storage.from('fotos').getPublicUrl(ruta).data.publicUrl
      await supabase.from('fotos').insert({
        usuario_id: usuario.id,
        url,
        caption: caption.trim() || null,
        tipo: pendiente.esVideo ? 'video' : 'foto',
      })
      setPendiente(null)
      setCaption('')
    } catch (err) {
      console.error(err)
      setAviso(
        '⛔ No se pudo subir. Puede que el archivo supere el límite de tamaño del bucket en Supabase.',
      )
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => inputFoto.current?.click()}
        disabled={subiendo}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 transition"
      >
        📸 Subir foto o vídeo
      </button>
      <input
        ref={inputFoto}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={elegir}
      />
      <p className="text-white/30 text-xs text-center -mt-2">Vídeos de máximo 15 segundos 🎬</p>

      {aviso && (
        <div className="rounded-xl bg-rose-600/90 text-white text-sm px-4 py-2 flex items-start justify-between gap-3">
          <span>{aviso}</span>
          <button onClick={() => setAviso('')} className="font-bold shrink-0">✕</button>
        </div>
      )}

      {fotos.length === 0 ? (
        <p className="text-white/40 text-center py-8">
          El álbum está vacío. ¡Sube la primera foto o vídeo (cuanto más horrible, mejor)!
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative group">
              {f.tipo === 'video' ? (
                <div onClick={() => setAmpliada(f)} className="relative cursor-pointer">
                  <video
                    src={f.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-4xl drop-shadow-lg pointer-events-none">
                    ▶️
                  </span>
                </div>
              ) : (
                <img
                  src={f.url}
                  alt={f.caption || ''}
                  onClick={() => setAmpliada(f)}
                  className="w-full aspect-square object-cover rounded-xl cursor-pointer"
                />
              )}
              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
                <div className="flex items-center gap-1">
                  <Avatar nombre={f.autor?.nombre} url={f.autor?.avatar_url} size={20} />
                  <span className="text-white text-xs truncate">{f.autor?.nombre}</span>
                </div>
                {f.caption && <p className="text-white/90 text-xs truncate mt-0.5">{f.caption}</p>}
                <p className="text-white/50 text-[10px] mt-0.5">{formatFecha(f.created_at)}</p>
              </div>
              {totalReacciones(f.id) > 0 && (
                <span className="absolute top-1 left-1 bg-black/50 text-white text-xs rounded-full px-2 py-0.5">
                  ❤️ {totalReacciones(f.id)}
                </span>
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
            {pendiente.esVideo ? (
              <video
                src={pendiente.preview}
                controls
                playsInline
                className="w-full max-h-72 rounded-xl bg-black"
              />
            ) : (
              <img src={pendiente.preview} alt="" className="w-full max-h-72 object-contain rounded-xl" />
            )}
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
          {ampliada.tipo === 'video' ? (
            <video
              src={ampliada.url}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="max-h-[65vh] max-w-full rounded-xl bg-black"
            />
          ) : (
            <img src={ampliada.url} alt="" className="max-h-[65vh] max-w-full rounded-xl" />
          )}
          {ampliada.caption && <p className="text-white mt-3 text-center px-4">{ampliada.caption}</p>}
          <p className="text-white/50 text-sm mt-1">
            {ampliada.autor?.nombre} · {formatFecha(ampliada.created_at)}
          </p>
          {/* Barra de reacciones */}
          <div
            className="flex gap-2 mt-4 flex-wrap justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {EMOJIS_REACCION.map((emoji) => {
              const { conteo, mias } = reaccionesDe(ampliada.id)
              const n = conteo[emoji] ?? 0
              const yo = mias.has(emoji)
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaccion(ampliada.id, emoji)}
                  className={`rounded-full px-3 py-1.5 text-lg transition ${
                    yo ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {emoji} {n > 0 && <span className="text-sm font-bold">{n}</span>}
                </button>
              )
            })}
          </div>

          {/* Borrar (dueño o admin) */}
          {(ampliada.usuario_id === usuario.id || usuario.es_admin) && (
            <button
              onClick={async (e) => {
                e.stopPropagation()
                const borrada = ampliada
                if (!window.confirm('¿Borrar esto del álbum?')) return
                setAmpliada(null)
                await supabase.from('fotos').delete().eq('id', borrada.id)
              }}
              className="mt-5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-semibold px-5 py-2.5"
            >
              🗑️ Borrar {ampliada.usuario_id === usuario.id ? '' : '(admin)'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
