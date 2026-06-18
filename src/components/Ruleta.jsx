import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'

const hoy = () => new Date().toLocaleDateString('sv')
function inicioDeHoyISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Números rojos en la ruleta europea (el resto del 1-36 son negros; el 0 es verde).
const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const colorDe = (n) => (n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro')

const BG = {
  rojo: 'bg-red-600',
  negro: 'bg-neutral-800',
  verde: 'bg-green-600',
}
const APUESTAS = [
  { id: 'rojo', label: '🔴 Rojo', mult: 2 },
  { id: 'negro', label: '⚫ Negro', mult: 2 },
  { id: 'verde', label: '🟢 Verde (0)', mult: 36 },
]

export default function Ruleta() {
  const { usuario } = useUsuario()
  const [consumiciones, setConsumiciones] = useState(0)
  const [neto, setNeto] = useState(0) // ganancia/pérdida acumulada hoy
  const [historial, setHistorial] = useState([])
  const [color, setColor] = useState('rojo')
  const [apuesta, setApuesta] = useState(1)
  const [girando, setGirando] = useState(false)
  const [display, setDisplay] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const intervalRef = useRef(null)

  const saldo = consumiciones + neto

  const cargar = async () => {
    const desde = inicioDeHoyISO()
    const [c, j] = await Promise.all([
      supabase
        .from('consumiciones')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuario.id)
        .gte('created_at', desde),
      supabase
        .from('ruleta_jugadas')
        .select('*')
        .eq('usuario_id', usuario.id)
        .eq('fecha', hoy())
        .order('created_at', { ascending: false }),
    ])
    setConsumiciones(c.count ?? 0)
    const jugadas = j.data ?? []
    setHistorial(jugadas)
    setNeto(jugadas.reduce((a, b) => a + b.ganancia, 0))
  }

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('ruleta-' + usuario.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consumiciones', filter: `usuario_id=eq.${usuario.id}` },
        cargar,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ruleta_jugadas', filter: `usuario_id=eq.${usuario.id}` },
        cargar,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  // Mantener la apuesta dentro del saldo disponible.
  useEffect(() => {
    if (apuesta > saldo) setApuesta(Math.max(1, saldo))
  }, [saldo]) // eslint-disable-line react-hooks/exhaustive-deps

  const girar = async () => {
    if (girando) return
    const ap = Math.floor(Number(apuesta))
    if (!ap || ap < 1) return setMensaje('Apuesta al menos 1 ficha.')
    if (ap > saldo) return setMensaje('No tienes tantas fichas.')

    setMensaje('')
    setResultado(null)
    setGirando(true)

    const final = Math.floor(Math.random() * 37)
    let ticks = 0
    const total = 26
    intervalRef.current = setInterval(() => {
      ticks++
      setDisplay(Math.floor(Math.random() * 37))
      if (ticks >= total) {
        clearInterval(intervalRef.current)
        setDisplay(final)
        finalizar(final, ap)
      }
    }, 85)
  }

  const finalizar = async (num, ap) => {
    const colorRes = colorDe(num)
    const mult = color === 'verde' ? 36 : 2
    const gano = colorRes === color
    const ganancia = gano ? ap * (mult - 1) : -ap
    setResultado({ num, colorRes, gano, ganancia })
    await supabase.from('ruleta_jugadas').insert({
      usuario_id: usuario.id,
      fecha: hoy(),
      apuesta: ap,
      color,
      resultado: num,
      gano,
      ganancia,
    })
    setGirando(false)
    cargar()
  }

  const colorDisplay = colorDe(display)

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🎰 La Ruleta del Vicio</h2>
        <p className="text-white/50 text-sm">Cada consumición del día = 1 ficha. ¡Juégatelas!</p>
      </div>

      {/* Saldo */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-700/10 ring-1 ring-amber-400/40 p-4 text-center">
        <p className="text-white/60 text-sm">Tus fichas de hoy</p>
        <p className="text-5xl font-black text-amber-400">{saldo}</p>
        <p className="text-white/40 text-xs">
          {consumiciones} de consumiciones {neto !== 0 && `· ${neto > 0 ? '+' : ''}${neto} en la ruleta`}
        </p>
      </div>

      {/* Rueda / número */}
      <div className="flex justify-center">
        <div
          className={`w-36 h-36 rounded-full flex items-center justify-center text-6xl font-black text-white ring-4 ring-white/20 transition-colors ${BG[colorDisplay]} ${girando ? 'animate-pulse' : ''}`}
        >
          {display}
        </div>
      </div>

      {resultado && !girando && (
        <p
          className={`text-center font-bold text-lg ${resultado.gano ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {resultado.gano
            ? `🎉 ¡Salió ${resultado.num}! Ganas +${resultado.ganancia} fichas`
            : `💀 Salió ${resultado.num}. Pierdes ${Math.abs(resultado.ganancia)} fichas`}
        </p>
      )}

      {/* Elegir color */}
      <div className="grid grid-cols-3 gap-2">
        {APUESTAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setColor(a.id)}
            disabled={girando}
            className={`rounded-xl py-3 font-bold text-white transition ${BG[a.id]} ${
              color === a.id ? 'ring-4 ring-amber-400' : 'opacity-70'
            }`}
          >
            <div>{a.label}</div>
            <div className="text-xs font-normal opacity-80">paga x{a.mult}</div>
          </button>
        ))}
      </div>

      {/* Cantidad a apostar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">Apuesta</span>
          <span className="text-white font-bold">{apuesta} fichas</span>
        </div>
        <input
          type="range"
          min="1"
          max={Math.max(1, saldo)}
          value={apuesta}
          disabled={girando || saldo < 1}
          onChange={(e) => setApuesta(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex gap-2">
          {[1, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setApuesta(Math.min(saldo, n))}
              disabled={girando || saldo < 1}
              className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm py-1.5"
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setApuesta(Math.max(1, saldo))}
            disabled={girando || saldo < 1}
            className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm py-1.5"
          >
            Todo
          </button>
        </div>
      </div>

      {mensaje && <p className="text-rose-400 text-sm text-center">{mensaje}</p>}

      <button
        onClick={girar}
        disabled={girando || saldo < 1}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black py-4 text-lg transition"
      >
        {girando ? '🎡 Girando…' : saldo < 1 ? 'Bebe algo para tener fichas 😏' : '🎡 ¡GIRAR!'}
      </button>

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <p className="text-white/50 text-sm mb-2">Últimas jugadas</p>
          <div className="flex flex-wrap gap-2">
            {historial.slice(0, 12).map((j) => (
              <span
                key={j.id}
                className={`text-white text-xs rounded-full px-2 py-1 ${BG[colorDe(j.resultado)]}`}
                title={`Apostaste ${j.apuesta} a ${j.color}`}
              >
                {j.resultado} {j.gano ? `+${j.ganancia}` : j.ganancia}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-white/30 text-xs">
        Las fichas son de cachondeo, no se canjean por nada (bueno, por gloria).
      </p>
    </div>
  )
}
