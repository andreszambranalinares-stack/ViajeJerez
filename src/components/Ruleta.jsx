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
const BG = { rojo: 'bg-red-600', negro: 'bg-neutral-800', verde: 'bg-green-600' }
const enRango = (n, a, b) => n >= a && n <= b

// ¿La apuesta (token) acierta con el número que sale?
function cumple(token, n) {
  if (token.startsWith('num:')) return n === Number(token.slice(4))
  switch (token) {
    case 'rojo': return ROJOS.has(n)
    case 'negro': return n !== 0 && !ROJOS.has(n)
    case 'par': return n !== 0 && n % 2 === 0
    case 'impar': return n % 2 === 1
    case 'bajo': return enRango(n, 1, 18)
    case 'alto': return enRango(n, 19, 36)
    case 'docena1': return enRango(n, 1, 12)
    case 'docena2': return enRango(n, 13, 24)
    case 'docena3': return enRango(n, 25, 36)
    default: return false
  }
}
const multDe = (token) =>
  token.startsWith('num:') ? 36 : token.startsWith('docena') ? 3 : 2

const labelDe = (token) => {
  if (token.startsWith('num:')) return `Pleno ${token.slice(4)}`
  return {
    rojo: 'Rojo', negro: 'Negro', par: 'Par', impar: 'Impar',
    bajo: '1-18', alto: '19-36',
    docena1: '1ª (1-12)', docena2: '2ª (13-24)', docena3: '3ª (25-36)',
  }[token] ?? token
}

export default function Ruleta() {
  const { usuario } = useUsuario()
  const [consumiciones, setConsumiciones] = useState(0)
  const [neto, setNeto] = useState(0)
  const [historial, setHistorial] = useState([])
  const [bet, setBet] = useState('rojo')
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumiciones', filter: `usuario_id=eq.${usuario.id}` }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ruleta_jugadas', filter: `usuario_id=eq.${usuario.id}` }, cargar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

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
    const mult = multDe(bet)
    const gano = cumple(bet, num)
    const ganancia = gano ? ap * (mult - 1) : -ap
    setResultado({ num, gano, ganancia })
    await supabase.from('ruleta_jugadas').insert({
      usuario_id: usuario.id,
      fecha: hoy(),
      apuesta: ap,
      color: bet,
      resultado: num,
      gano,
      ganancia,
    })
    setGirando(false)
    cargar()
  }

  const SelBtn = ({ token, children, className = '' }) => (
    <button
      onClick={() => setBet(token)}
      disabled={girando}
      className={`rounded-lg py-2 text-sm font-bold text-white transition ${className || 'bg-white/10'} ${
        bet === token ? 'ring-2 ring-amber-400' : 'opacity-75'
      }`}
    >
      {children}
    </button>
  )

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

      {/* Número girando */}
      <div className="flex justify-center">
        <div
          className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl font-black text-white ring-4 ring-white/20 transition-colors ${BG[colorDe(display)]} ${girando ? 'animate-pulse' : ''}`}
        >
          {display}
        </div>
      </div>

      {resultado && !girando && (
        <p className={`text-center font-bold text-lg ${resultado.gano ? 'text-emerald-400' : 'text-rose-400'}`}>
          {resultado.gano
            ? `🎉 ¡Salió ${resultado.num}! Ganas +${resultado.ganancia} fichas`
            : `💀 Salió ${resultado.num}. Pierdes ${Math.abs(resultado.ganancia)} fichas`}
        </p>
      )}

      {/* Elegir apuesta */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <SelBtn token="rojo" className={BG.rojo}>🔴 Rojo · x2</SelBtn>
          <SelBtn token="negro" className={BG.negro}>⚫ Negro · x2</SelBtn>
          <SelBtn token="par">Par · x2</SelBtn>
          <SelBtn token="impar">Impar · x2</SelBtn>
          <SelBtn token="bajo">1-18 · x2</SelBtn>
          <SelBtn token="alto">19-36 · x2</SelBtn>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SelBtn token="docena1">1ª · x3</SelBtn>
          <SelBtn token="docena2">2ª · x3</SelBtn>
          <SelBtn token="docena3">3ª · x3</SelBtn>
        </div>
        <p className="text-white/50 text-xs">Pleno (a un número) · paga x36</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 37 }, (_, n) => {
            const token = `num:${n}`
            return (
              <button
                key={n}
                onClick={() => setBet(token)}
                disabled={girando}
                className={`aspect-square rounded text-xs font-bold text-white transition ${BG[colorDe(n)]} ${
                  bet === token ? 'ring-2 ring-amber-400' : 'opacity-75'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cantidad */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-sm">
            Apuestas a <span className="text-amber-400 font-bold">{labelDe(bet)}</span>
          </span>
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
                title={`${j.apuesta} a ${labelDe(j.color)}`}
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
