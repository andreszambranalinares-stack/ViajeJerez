import { useEffect, useRef } from 'react'
import { WHEEL_ORDER, colorOf } from './roulette'

// Rueda europea que gira SIEMPRE a velocidad constante. Al cambiar `spinToken`
// se "lanza" la bola: orbita, decelera, cae con rebote y queda enganchada a la
// casilla ganadora girando junto con la rueda. Avisa con `onSettled()`.

const CX = 150
const CY = 150
const RIM_OUT = 148
const RIM_IN = 132
const POCKET_OUT = 128
const POCKET_IN = 84
const HUB_OUT = 84
const STEP = 360 / WHEEL_ORDER.length

const BALL_TRACK = 134
const BALL_REST = 106
const WHEEL_OMEGA = 360 / 9000 // grados/ms -> una vuelta cada 9 s
const SPIN_MS = 5600
const BALL_REVS = 6

const POCKET_FILL = {
  green: '#15803d',
  red: '#c81e1e',
  black: '#1f2937',
}

function pointFor(angleDeg, radius) {
  const t = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(t), y: CY + radius * Math.sin(t) }
}

function easeOutCubic(p) {
  return 1 - Math.pow(1 - p, 3)
}

function easeOutBounce(x) {
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75 }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375 }
  x -= 2.625 / d1
  return n1 * x * x + 0.984375
}

const ARCS = WHEEL_ORDER.map((num, i) => {
  const center = i * STEP
  const start = center - STEP / 2
  const end = center + STEP / 2
  const o1 = pointFor(start, POCKET_OUT)
  const o2 = pointFor(end, POCKET_OUT)
  const i2 = pointFor(end, POCKET_IN)
  const i1 = pointFor(start, POCKET_IN)
  const d =
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} ` +
    `A ${POCKET_OUT} ${POCKET_OUT} 0 0 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} ` +
    `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} ` +
    `A ${POCKET_IN} ${POCKET_IN} 0 0 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} Z`
  const label = pointFor(center, (POCKET_OUT + POCKET_IN) / 2)
  const fret = pointFor(start, POCKET_OUT)
  const fretIn = pointFor(start, POCKET_IN)
  return { num, center, d, label, fret, fretIn, color: colorOf(num) }
})

export default function RouletteWheel({ spinToken, targetNumber, onSettled }) {
  const svgRef = useRef(null)
  const ballWrapRef = useRef(null)
  const ballRadRef = useRef(null)

  const wheelAngle = useRef(0)
  const ballAngle = useRef(0)
  const phase = useRef('idle')
  const launchStart = useRef(0)
  const ballStart = useRef(0)
  const ballFinal = useRef(0)
  const pocketAngle = useRef(0)
  const settledNotified = useRef(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = now - last
      last = now
      wheelAngle.current += WHEEL_OMEGA * dt
      if (svgRef.current) svgRef.current.style.transform = `rotate(${wheelAngle.current}deg)`
      const wrap = ballWrapRef.current
      const rad = ballRadRef.current
      if (wrap && rad) {
        if (phase.current === 'idle') {
          wrap.style.opacity = '0'
        } else if (phase.current === 'spinning') {
          wrap.style.opacity = '1'
          const p = Math.min(1, (now - launchStart.current) / SPIN_MS)
          const e = easeOutCubic(p)
          ballAngle.current = ballStart.current + (ballFinal.current - ballStart.current) * e
          let r = BALL_TRACK
          if (p > 0.5) {
            const q = (p - 0.5) / 0.5
            r = BALL_TRACK + (BALL_REST - BALL_TRACK) * easeOutBounce(q)
          }
          wrap.style.transform = `rotate(${ballAngle.current}deg)`
          rad.style.transform = `translate(-50%, -50%) translateY(-${r}px)`
          if (p >= 1 && !settledNotified.current) {
            settledNotified.current = true
            phase.current = 'settled'
            onSettledRef.current()
          }
        } else {
          wrap.style.opacity = '1'
          ballAngle.current = wheelAngle.current + pocketAngle.current
          wrap.style.transform = `rotate(${ballAngle.current}deg)`
          rad.style.transform = `translate(-50%, -50%) translateY(-${BALL_REST}px)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (spinToken === 0 || targetNumber == null) return
    const idx = WHEEL_ORDER.indexOf(targetNumber)
    pocketAngle.current = idx * STEP
    const wheelAtSettle = wheelAngle.current + WHEEL_OMEGA * SPIN_MS
    const target = wheelAtSettle + pocketAngle.current
    ballStart.current = ballAngle.current
    let final = target - 360 * BALL_REVS
    while (final > ballStart.current - 360 * 2) final -= 360
    ballFinal.current = final
    launchStart.current = performance.now()
    settledNotified.current = false
    phase.current = 'spinning'
  }, [spinToken, targetNumber])

  return (
    <div
      className="relative mx-auto h-[300px] w-[300px] rounded-full"
      style={{
        background: 'radial-gradient(circle at 50% 35%, #1f2937 0%, #0b1220 70%)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.55), inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 6px #0b1220',
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 300 300"
        className="h-full w-full"
        style={{ transformBox: 'view-box', transformOrigin: 'center' }}
      >
        <defs>
          <radialGradient id="rouHub" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          <linearGradient id="rouRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="35%" stopColor="#d4a017" />
            <stop offset="60%" stopColor="#a16207" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <radialGradient id="rouShade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={RIM_OUT} fill="url(#rouRim)" />
        <circle cx={CX} cy={CY} r={RIM_IN} fill="#0b1220" />

        {ARCS.map((a, i) => (
          <path key={i} d={a.d} fill={POCKET_FILL[a.color]} stroke="#0b1220" strokeWidth={0.6} />
        ))}
        <circle cx={CX} cy={CY} r={POCKET_OUT} fill="url(#rouShade)" />

        {ARCS.map((a, i) => (
          <line key={`f${i}`} x1={a.fret.x} y1={a.fret.y} x2={a.fretIn.x} y2={a.fretIn.y}
            stroke="#cbd5e1" strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
        ))}

        {ARCS.map((a, i) => (
          <text key={`t${i}`} x={a.label.x} y={a.label.y} fill="#fff" fontSize={9} fontWeight={700}
            textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(${a.center} ${a.label.x} ${a.label.y})`}>
            {a.num}
          </text>
        ))}

        <circle cx={CX} cy={CY} r={HUB_OUT} fill="#0b1220" />
        <circle cx={CX} cy={CY} r={HUB_OUT - 6} fill="url(#rouHub)" />
        {[0, 45, 90, 135].map((deg) => {
          const p1 = pointFor(deg, HUB_OUT - 8)
          const p2 = pointFor(deg + 180, HUB_OUT - 8)
          return (
            <line key={`s${deg}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
          )
        })}
        <circle cx={CX} cy={CY} r={22} fill="url(#rouRim)" stroke="#0b1220" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={9} fill="#0b1220" />
      </svg>

      <div ref={ballWrapRef} className="pointer-events-none absolute inset-0" style={{ opacity: 0 }}>
        <div ref={ballRadRef} className="absolute left-1/2 top-1/2"
          style={{ transform: 'translate(-50%, -50%) translateY(-134px)' }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #e2e8f0 55%, #94a3b8 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
          }} />
        </div>
      </div>
    </div>
  )
}
