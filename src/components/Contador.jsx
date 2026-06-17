import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import { TIPOS } from '../lib/consumiciones'

export default function Contador() {
  const { usuario } = useUsuario()
  const [conteo, setConteo] = useState({}) // { tipo: cantidad } del usuario actual
  const [animando, setAnimando] = useState(null)

  const cargar = async () => {
    const { data } = await supabase
      .from('consumiciones')
      .select('tipo')
      .eq('usuario_id', usuario.id)
    const acc = {}
    for (const row of data ?? []) acc[row.tipo] = (acc[row.tipo] ?? 0) + 1
    setConteo(acc)
  }

  useEffect(() => {
    cargar()
    // Realtime: si sumo desde otro dispositivo, se actualiza aquí.
    const canal = supabase
      .channel('consumiciones-' + usuario.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consumiciones', filter: `usuario_id=eq.${usuario.id}` },
        cargar,
      )
      .subscribe()
    return () => supabase.removeChannel(canal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  const sumar = async (tipo) => {
    setAnimando(tipo)
    setTimeout(() => setAnimando(null), 260)
    setConteo((c) => ({ ...c, [tipo]: (c[tipo] ?? 0) + 1 })) // optimista
    if (navigator.vibrate) navigator.vibrate(15)
    await supabase.from('consumiciones').insert({ usuario_id: usuario.id, tipo })
  }

  const restar = async (tipo) => {
    if (!conteo[tipo]) return
    setConteo((c) => ({ ...c, [tipo]: Math.max(0, (c[tipo] ?? 0) - 1) })) // optimista
    // Borramos la consumición más reciente de ese tipo.
    const { data } = await supabase
      .from('consumiciones')
      .select('id')
      .eq('usuario_id', usuario.id)
      .eq('tipo', tipo)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.[0]) await supabase.from('consumiciones').delete().eq('id', data[0].id)
  }

  const total = Object.values(conteo).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-white/60">Tu marcador total</p>
        <p className="text-5xl font-black text-amber-400">{total}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TIPOS.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl bg-gradient-to-br ${t.color} p-4 shadow-lg`}
          >
            <button onClick={() => sumar(t.id)} className="w-full text-left">
              <div className={`text-4xl ${animando === t.id ? 'animate-pop' : ''}`}>
                {t.emoji}
              </div>
              <div className="flex items-end justify-between mt-1">
                <span className="font-bold text-white/95">{t.label}</span>
                <span className="text-3xl font-black text-white drop-shadow">
                  {conteo[t.id] ?? 0}
                </span>
              </div>
            </button>
            <button
              onClick={() => restar(t.id)}
              disabled={!conteo[t.id]}
              className="mt-2 w-full rounded-lg bg-black/20 hover:bg-black/30 disabled:opacity-30 text-white text-sm py-1 transition"
            >
              − Quitar uno
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-white/40 text-xs">
        Toca la tarjeta para sumar. Pulsa “Quitar uno” si te has colado.
      </p>
    </div>
  )
}
