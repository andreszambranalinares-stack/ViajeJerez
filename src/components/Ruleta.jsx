import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUsuario } from '../context/UsuarioContext'
import {
  CHIP_VALUES,
  betWins,
  colorOf,
  gkey,
  payoutMultiplier,
  shortChip,
} from './roulette'
import RouletteWheel from './RouletteWheel'

const hoy = () => new Date().toLocaleDateString('sv')
function inicioDeHoyISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const fmt = (n) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n))

const TOP_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3)
const MID_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 1)
const BOT_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 2)

const NUM_BG = {
  green: 'bg-[#15803d]',
  red: 'bg-[#c81e1e]',
  black: 'bg-[#1f2937]',
}

const COLS = 12
const ROWS = 3
const val = (c, r) => 3 * c + (3 - r)
const colNums = (c) => [val(c, 0), val(c, 1), val(c, 2)]
const px = (u) => (u / COLS) * 100
const py = (u) => (u / ROWS) * 100

const SPOTS = (() => {
  const s = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS - 1; c++)
      s.push({ key: gkey([val(c, r), val(c + 1, r)]), x: px(c + 1), y: py(r + 0.5) })
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS - 1; r++)
      s.push({ key: gkey([val(c, r), val(c, r + 1)]), x: px(c + 0.5), y: py(r + 1) })
  for (let r = 0; r < ROWS - 1; r++)
    for (let c = 0; c < COLS - 1; c++)
      s.push({
        key: gkey([val(c, r), val(c + 1, r), val(c, r + 1), val(c + 1, r + 1)]),
        x: px(c + 1), y: py(r + 1),
      })
  for (let c = 0; c < COLS; c++) s.push({ key: gkey(colNums(c)), x: px(c + 0.5), y: 96 })
  for (let c = 0; c < COLS - 1; c++)
    s.push({ key: gkey([...colNums(c), ...colNums(c + 1)]), x: px(c + 1), y: 96 })
  s.push({ key: gkey([0, 3]), x: 1.5, y: py(0.5) })
  s.push({ key: gkey([0, 2]), x: 1.5, y: py(1.5) })
  s.push({ key: gkey([0, 1]), x: 1.5, y: py(2.5) })
  s.push({ key: gkey([0, 1, 2, 3]), x: 1.5, y: 4 })
  return s
})()

export default function Ruleta() {
  const { usuario } = useUsuario()
  const [consumiciones, setConsumiciones] = useState(0)
  const [neto, setNeto] = useState(0)
  const [historial, setHistorial] = useState([])

  const [bets, setBets] = useState({})
  const [chip, setChip] = useState(CHIP_VALUES[0])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const [spinToken, setSpinToken] = useState(0)
  const [targetNumber, setTargetNumber] = useState(null)
  const pendingResult = useRef(null)

  // La mesa se diseña a 460px y se escala para caber entera en el ancho
  // disponible (sin scroll horizontal en el móvil).
  const tableOuterRef = useRef(null)
  const tableInnerRef = useRef(null)
  const [tableScale, setTableScale] = useState(1)
  const [tableHeight, setTableHeight] = useState(undefined)

  const saldo = consumiciones + neto
  const total = useMemo(() => Object.values(bets).reduce((s, x) => s + x, 0), [bets])
  const winningNumber = result?.number ?? null

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  useEffect(() => {
    const outer = tableOuterRef.current
    const inner = tableInnerRef.current
    if (!outer || !inner) return
    const update = () => {
      const scale = Math.min(1, outer.clientWidth / 460)
      setTableScale(scale)
      setTableHeight(inner.offsetHeight * scale)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [])

  function place(key) {
    if (spinning) return
    if (total + chip > saldo) {
      setError('No tienes fichas suficientes para esa apuesta')
      return
    }
    setError(null)
    setResult(null)
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }))
  }

  function clearBets() {
    if (spinning) return
    setBets({})
    setResult(null)
    setError(null)
  }

  function spin() {
    if (spinning || total === 0) return
    setSpinning(true)
    setResult(null)
    setError(null)

    // El número lo decidimos aquí (app privada, fichas de cachondeo) y la rueda
    // anima hacia él. El neto se guarda en ruleta_jugadas y recalcula el saldo.
    const stake = total
    const number = Math.floor(Math.random() * 37)
    let payout = 0
    for (const [k, a] of Object.entries(bets)) {
      if (betWins(k, number)) payout += a * payoutMultiplier(k)
    }
    const net = Math.round(payout - stake)

    pendingResult.current = { number, net, stake }
    setTargetNumber(number)
    setSpinToken((t) => t + 1)
  }

  async function onSettled() {
    setSpinning(false)
    const r = pendingResult.current
    if (!r) return
    setResult({ number: r.number, net: r.net })
    setBets({})
    await supabase.from('ruleta_jugadas').insert({
      usuario_id: usuario.id,
      fecha: hoy(),
      apuesta: r.stake,
      color: 'mesa',
      resultado: r.number,
      gano: r.net > 0,
      ganancia: r.net,
    })
    cargar()
  }

  const cellProps = { bets, winningNumber, spinning, onPlace: place }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🎰 La Ruleta del Vicio</h2>
        <p className="text-white/50 text-sm">Cada consumición del día = 1 ficha. ¡Juégatelas!</p>
      </div>

      {/* Saldo */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-700/10 ring-1 ring-amber-400/40 p-4 text-center">
        <p className="text-white/60 text-sm">Tus fichas de hoy</p>
        <p className="text-5xl font-black text-amber-400">{fmt(saldo)}</p>
        <p className="text-white/40 text-xs">
          {consumiciones} de consumiciones {neto !== 0 && `· ${neto > 0 ? '+' : ''}${neto} en la ruleta`}
        </p>
      </div>

      <RouletteWheel spinToken={spinToken} targetNumber={targetNumber} onSettled={onSettled} />

      {result && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
          <span className="text-sm text-white/50">Salió el </span>
          <span className={`mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${NUM_BG[colorOf(result.number)]}`}>
            {result.number}
          </span>
          <span className="ml-1 text-sm font-semibold">
            {result.net > 0 ? (
              <span className="text-emerald-400">¡Ganaste +{fmt(result.net)}!</span>
            ) : result.net < 0 ? (
              <span className="text-rose-400">Perdiste {fmt(-result.net)}</span>
            ) : (
              <span className="text-white/50">Recuperaste tu apuesta</span>
            )}
          </span>
        </div>
      )}

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}

      {/* Números recientes (los últimos 10 que han salido) */}
      {historial.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/50">Números recientes</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {historial.slice(0, 10).map((j) => (
              <span
                key={j.id}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/10 ${NUM_BG[colorOf(j.resultado)]}`}
              >
                {j.resultado}
              </span>
            ))}
          </div>
        </div>
      )}

      <div ref={tableOuterRef} className="w-full overflow-hidden" style={{ height: tableHeight }}>
        <div
          ref={tableInnerRef}
          style={{ width: 460, transform: `scale(${tableScale})`, transformOrigin: 'top left' }}
        >
          <div className="space-y-1 rounded-xl bg-[#0e5a34] p-1.5">
          <div className="flex gap-px">
            <Cell {...cellProps} betKey="g:0" className={`w-8 shrink-0 self-stretch ${NUM_BG.green}`}>0</Cell>

            <div className="relative flex-1">
              <div className="grid grid-cols-12 gap-px">
                {TOP_ROW.map((n) => <NumberCell key={n} n={n} {...cellProps} />)}
                {MID_ROW.map((n) => <NumberCell key={n} n={n} {...cellProps} />)}
                {BOT_ROW.map((n) => <NumberCell key={n} n={n} {...cellProps} />)}
              </div>
              <div className="pointer-events-none absolute inset-0">
                {SPOTS.map((sp) => <Hotspot key={sp.key} sp={sp} {...cellProps} />)}
              </div>
            </div>

            <div className="flex w-11 shrink-0 flex-col gap-px">
              {[3, 2, 1].map((c) => (
                <Cell {...cellProps} key={c} betKey={`column:${c}`} className="h-10 bg-[#0b7a43] text-[9px] leading-tight">2 a 1</Cell>
              ))}
            </div>
          </div>

          <div className="flex gap-px">
            <div className="w-8 shrink-0" aria-hidden />
            <div className="grid flex-1 grid-cols-3 gap-px">
              <Cell {...cellProps} betKey="dozen:1" className="h-9 bg-[#0b7a43] text-[10px]">1-12</Cell>
              <Cell {...cellProps} betKey="dozen:2" className="h-9 bg-[#0b7a43] text-[10px]">13-24</Cell>
              <Cell {...cellProps} betKey="dozen:3" className="h-9 bg-[#0b7a43] text-[10px]">25-36</Cell>
            </div>
            <div className="w-11 shrink-0" aria-hidden />
          </div>

          <div className="flex gap-px">
            <div className="w-8 shrink-0" aria-hidden />
            <div className="grid flex-1 grid-cols-6 gap-px">
              <Cell {...cellProps} betKey="low" className="h-9 bg-[#0b7a43] text-[10px]">1-18</Cell>
              <Cell {...cellProps} betKey="even" className="h-9 bg-[#0b7a43] text-[10px]">PAR</Cell>
              <Cell {...cellProps} betKey="red" className="h-9 bg-[#c81e1e] text-base">◆</Cell>
              <Cell {...cellProps} betKey="black" className="h-9 bg-[#1f2937] text-base">◆</Cell>
              <Cell {...cellProps} betKey="odd" className="h-9 bg-[#0b7a43] text-[10px]">IMPAR</Cell>
              <Cell {...cellProps} betKey="high" className="h-9 bg-[#0b7a43] text-[10px]">19-36</Cell>
            </div>
            <div className="w-11 shrink-0" aria-hidden />
          </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-white/40">
        Toca un número (pleno) o los <span className="font-semibold">bordes y esquinas</span> para
        caballo, calle, cuadro y línea.
      </p>

      <div>
        <div className="mb-1.5 text-xs font-medium text-white/50">Ficha seleccionada</div>
        <div className="flex flex-wrap gap-2">
          {CHIP_VALUES.map((v) => (
            <button key={v} onClick={() => setChip(v)} disabled={spinning}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-xs font-bold transition disabled:opacity-50 ${
                chip === v ? 'scale-110 border-amber-300 bg-amber-400 text-slate-900 shadow'
                  : 'border-white/20 bg-white/10 text-white'
              }`}>
              {shortChip(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 text-sm">
        <span className="text-white/50">Total apostado</span>
        <span className="font-bold text-white">{fmt(total)} fichas</span>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <button onClick={clearBets} disabled={spinning || total === 0}
          className="rounded-xl bg-white/10 px-4 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40">
          Limpiar
        </button>
        <button onClick={spin} disabled={spinning || total === 0 || saldo < 1}
          className="rounded-xl bg-amber-500 px-4 py-2.5 font-black text-black transition active:scale-[0.98] disabled:opacity-40">
          {spinning ? '🎡 Girando…' : saldo < 1 ? 'Bebe algo para tener fichas 😏' : '🎯 ¡GIRAR!'}
        </button>
      </div>

      <p className="text-center text-[11px] text-white/30">
        Pleno 35:1 · Caballo 17:1 · Calle 11:1 · Cuadro 8:1 · Línea 5:1 · Docena y columna 2:1 ·
        Color, par/impar y mitades 1:1
      </p>

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <p className="text-white/50 text-sm mb-2">Últimas jugadas</p>
          <div className="flex flex-wrap gap-2">
            {historial.slice(0, 12).map((j) => (
              <span
                key={j.id}
                className={`text-white text-xs rounded-full px-2 py-1 ${NUM_BG[colorOf(j.resultado)]}`}
                title={`Apostaste ${j.apuesta} fichas`}
              >
                {j.resultado} {j.ganancia > 0 ? `+${j.ganancia}` : j.ganancia}
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

function NumberCell({ n, ...rest }) {
  return (
    <Cell {...rest} betKey={gkey([n])} className={`h-10 text-[11px] ${NUM_BG[colorOf(n)]}`}>
      {n}
    </Cell>
  )
}

function ChipBadge({ amount, win }) {
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 bg-amber-400 text-[8px] font-bold leading-none text-slate-900 shadow-md ${
      win ? 'border-yellow-200 ring-2 ring-yellow-300' : 'border-white'
    }`}>
      {shortChip(amount)}
    </span>
  )
}

function Cell({ betKey, bets, winningNumber, spinning, onPlace, className = '', children }) {
  const amount = bets[betKey]
  const win = winningNumber != null && betWins(betKey, winningNumber)
  return (
    <button type="button" onClick={() => onPlace(betKey)} disabled={spinning}
      className={`relative flex items-center justify-center rounded-[3px] font-bold text-white transition active:brightness-110 disabled:cursor-default ${
        win ? 'z-10 ring-2 ring-yellow-300' : ''
      } ${className}`}>
      {children}
      {amount != null && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <ChipBadge amount={amount} win={win} />
        </span>
      )}
    </button>
  )
}

function Hotspot({ sp, bets, winningNumber, spinning, onPlace }) {
  const amount = bets[sp.key]
  const win = winningNumber != null && betWins(sp.key, winningNumber)
  return (
    <button type="button" disabled={spinning} onClick={() => onPlace(sp.key)}
      style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
      className="pointer-events-auto absolute z-30 flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-default">
      {amount != null ? <ChipBadge amount={amount} win={win} />
        : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}
    </button>
  )
}
