import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { CATEGORIAS } from '../lib/personajes'

// Probabilidad de que, en vez de un famoso, te salga uno de los del viaje
// (incluido tú mismo 😈). Baja a propósito: "alguna vez que otra".
const PROB_GRUPO = 0.1

const DURACIONES = [60, 90, 120]

// Umbrales para el modo inclinación (móvil en la frente).
const UMBRAL = 38 // grados desde la posición neutra para contar el gesto
const NEUTRA = 15 // hay que volver a esta zona para volver a "armar" el gesto

function barajar(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuienSoy() {
  // Configuración de la partida
  const [catsSel, setCatsSel] = useState(() => new Set(CATEGORIAS.map((c) => c.id)))
  const [modo, setModo] = useState('rapido') // 'rapido' (contrarreloj) | 'turnos'
  const [duracion, setDuracion] = useState(90)
  const [modoInclinacion, setModoInclinacion] = useState(false)

  // Los del viaje se cuelan en secreto (incluido tú mismo). No se enseña en la
  // pantalla de ajustes: forma parte de la sorpresa.
  const grupoNombresRef = useRef([])

  // Estado del juego: 'config' | 'preparar' | 'cuenta' | 'jugando' | 'fin'
  const [fase, setFase] = useState('config')
  const [cuenta, setCuenta] = useState(3)
  const [tiempo, setTiempo] = useState(0)
  const [actual, setActual] = useState('')
  const [resultados, setResultados] = useState([])
  const [feedback, setFeedback] = useState(null) // null | 'acierto' | 'paso'
  const [error, setError] = useState(null)

  // Refs para el bucle del juego y los sensores
  const recientesRef = useRef([])
  const bloqueadoRef = useRef(false)
  const baselineRef = useRef(null)
  const armadoRef = useRef(true)
  const actualRef = useRef('')

  useEffect(() => {
    let activo = true
    supabase
      .from('usuarios')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => {
        if (!activo) return
        grupoNombresRef.current = (data ?? []).map((u) => u.nombre)
      })
    return () => {
      activo = false
    }
  }, [])

  // --- Construir el "mazo" de nombres según la configuración ---
  function poolFamosos() {
    const nombres = []
    for (const cat of CATEGORIAS) {
      if (catsSel.has(cat.id)) nombres.push(...cat.personajes)
    }
    return nombres
  }

  function poolGrupo() {
    return grupoNombresRef.current
  }

  function siguienteNombre() {
    const famosos = poolFamosos()
    const grupo = poolGrupo()
    const recientes = recientesRef.current

    let candidatos
    if (grupo.length && Math.random() < PROB_GRUPO) {
      candidatos = grupo
    } else if (famosos.length) {
      candidatos = famosos
    } else {
      candidatos = grupo
    }
    if (!candidatos.length) return '¡Sin nombres!'

    // Evita repetir los últimos para que no se haga cansino.
    const libres = candidatos.filter((n) => !recientes.includes(n))
    const elegidos = libres.length ? libres : candidatos
    const nombre = elegidos[Math.floor(Math.random() * elegidos.length)]

    recientes.push(nombre)
    if (recientes.length > 12) recientes.shift()
    return nombre
  }

  // --- Inicio de partida ---
  async function empezar() {
    setError(null)
    if (poolFamosos().length === 0 && poolGrupo().length === 0) {
      setError('Elige al menos una categoría para jugar.')
      return
    }

    if (modoInclinacion) {
      const ok = await pedirPermisoSensores()
      if (!ok) {
        setError('Tu móvil no deja usar el sensor de inclinación. Juega con los botones.')
        setModoInclinacion(false)
      }
    }

    recientesRef.current = []
    setResultados([])
    if (modo === 'turnos') {
      setFase('preparar')
    } else {
      setCuenta(3)
      setFase('cuenta')
    }
  }

  // En el modo por turnos, pasar el móvil a la siguiente persona y empezar su turno.
  function siguienteTurno() {
    setCuenta(3)
    setFase('cuenta')
  }

  async function pedirPermisoSensores() {
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const estado = await DeviceOrientationEvent.requestPermission()
        return estado === 'granted'
      }
      return typeof DeviceOrientationEvent !== 'undefined'
    } catch {
      return false
    }
  }

  // Cuenta atrás 3-2-1 antes de empezar
  useEffect(() => {
    if (fase !== 'cuenta') return
    if (cuenta <= 0) {
      // Arrancar la partida
      baselineRef.current = null
      armadoRef.current = true
      bloqueadoRef.current = false
      const primero = siguienteNombre()
      actualRef.current = primero
      setActual(primero)
      if (modo === 'rapido') setTiempo(duracion)
      setFase('jugando')
      return
    }
    const t = setTimeout(() => setCuenta((c) => c - 1), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, cuenta])

  // Cronómetro de la partida (solo en modo contrarreloj)
  useEffect(() => {
    if (fase !== 'jugando' || modo !== 'rapido') return
    if (tiempo <= 0) {
      setFase('fin')
      return
    }
    const t = setTimeout(() => setTiempo((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, tiempo, modo])

  // Sensor de inclinación durante la partida
  useEffect(() => {
    if (fase !== 'jugando' || !modoInclinacion) return
    function onOrient(e) {
      if (e.beta == null) return
      const beta = e.beta
      if (baselineRef.current == null) {
        baselineRef.current = beta
        return
      }
      const delta = beta - baselineRef.current
      if (!armadoRef.current) {
        if (Math.abs(delta) < NEUTRA) armadoRef.current = true
        return
      }
      if (bloqueadoRef.current) return
      if (delta < -UMBRAL) {
        armadoRef.current = false
        resolver(true) // inclinar hacia abajo = acerté
      } else if (delta > UMBRAL) {
        armadoRef.current = false
        resolver(false) // inclinar hacia arriba = paso
      }
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, modoInclinacion])

  // Resolver una carta (acierto o paso) y pasar a la siguiente
  function resolver(acerto) {
    if (bloqueadoRef.current || fase !== 'jugando') return
    bloqueadoRef.current = true
    if (navigator.vibrate) navigator.vibrate(acerto ? 60 : [30, 40, 30])
    setResultados((r) => [...r, { nombre: actualRef.current, acierto: acerto }])
    setFeedback(acerto ? 'acierto' : 'paso')
    setTimeout(() => {
      setFeedback(null)
      bloqueadoRef.current = false
      if (modo === 'turnos') {
        // Una carta por turno: se pasa el móvil al siguiente.
        setFase('preparar')
      } else {
        const sig = siguienteNombre()
        actualRef.current = sig
        setActual(sig)
      }
    }, 650)
  }

  function volverAConfig() {
    setFase('config')
    setFeedback(null)
  }

  // --- Render ---
  if (fase === 'preparar') {
    const turno = resultados.length + 1
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
        <div className="text-6xl">🤳</div>
        <h2 className="text-white font-black text-xl">Turno {turno}</h2>
        <p className="text-white/60 text-sm max-w-xs">
          Pásale el móvil a quien le toca. Cuando lo tenga{' '}
          <b>en la frente</b> (sin mirar la pantalla), que pulse para ver su personaje.
        </p>
        <button
          onClick={siguienteTurno}
          className="w-full max-w-xs rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black py-4 text-lg active:scale-[0.98] transition"
        >
          🙈 Ver mi personaje
        </button>
        {resultados.length > 0 && (
          <button
            onClick={() => setFase('fin')}
            className="text-white/40 underline text-xs"
          >
            Terminar partida
          </button>
        )}
      </div>
    )
  }

  if (fase === 'cuenta') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-white/50 text-sm mb-4">Ponte el móvil en la frente…</p>
        <div className="text-8xl font-black text-amber-400 animate-pulse">{cuenta}</div>
      </div>
    )
  }

  if (fase === 'jugando') {
    const fondo =
      feedback === 'acierto'
        ? 'bg-emerald-600'
        : feedback === 'paso'
        ? 'bg-orange-600'
        : 'bg-neutral-900'
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col ${fondo} transition-colors duration-150`}
      >
        {/* Cabecera: tiempo (contrarreloj) o turno (por turnos) */}
        <div className="pt-4 text-center">
          {modo === 'rapido' ? (
            <span
              className={`text-2xl font-black ${
                tiempo <= 10 ? 'text-rose-300 animate-pulse' : 'text-white/70'
              }`}
            >
              {tiempo}s
            </span>
          ) : (
            <span className="text-sm font-semibold text-white/50">
              Turno {resultados.length + 1} · pregunta a los demás
            </span>
          )}
        </div>

        {/* Nombre / feedback */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {feedback ? (
            <div className="text-6xl font-black text-white">
              {feedback === 'acierto' ? '✅ ¡SÍ!' : modo === 'turnos' ? '🏳️ FIN' : '⏭️ PASO'}
            </div>
          ) : (
            <div className="text-5xl sm:text-6xl font-black text-white leading-tight">
              {actual}
            </div>
          )}
        </div>

        {/* Controles */}
        {modoInclinacion ? (
          <div className="pb-8 text-center text-white/70 text-sm space-y-1">
            <p>⬇️ Inclina abajo = <b>{modo === 'turnos' ? '¡Lo adiviné!' : 'Acerté'}</b></p>
            <p>⬆️ Inclina arriba = <b>{modo === 'turnos' ? 'Me rindo' : 'Paso'}</b></p>
            <button
              onClick={() => setFase('fin')}
              className="mt-3 text-white/40 underline text-xs"
            >
              Terminar
            </button>
          </div>
        ) : (
          <div className="pb-6 px-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => resolver(false)}
                className="rounded-2xl bg-white/15 hover:bg-white/25 text-white font-black py-6 text-lg active:scale-95 transition"
              >
                {modo === 'turnos' ? '🏳️ Me rindo' : '⏭️ Paso'}
              </button>
              <button
                onClick={() => resolver(true)}
                className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black py-6 text-lg active:scale-95 transition"
              >
                {modo === 'turnos' ? '✅ ¡Lo adiviné!' : '✅ ¡Lo tiene!'}
              </button>
            </div>
            <button
              onClick={() => setFase('fin')}
              className="w-full text-white/40 underline text-xs py-1"
            >
              Terminar
            </button>
          </div>
        )}
      </div>
    )
  }

  if (fase === 'fin') {
    const aciertos = resultados.filter((r) => r.acierto).length
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-white font-black text-lg">
            {modo === 'rapido' ? '🏁 ¡Se acabó el tiempo!' : '🏁 Fin de la partida'}
          </h2>
          <p className="text-6xl font-black text-amber-400 my-2">{aciertos}</p>
          <p className="text-white/50 text-sm">
            {aciertos === 1 ? 'acierto' : 'aciertos'} de {resultados.length}{' '}
            {modo === 'turnos' ? 'turnos' : 'cartas'}
          </p>
        </div>

        {resultados.length > 0 && (
          <div className="rounded-2xl bg-white/5 p-4 space-y-1.5 max-h-80 overflow-y-auto">
            {resultados.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span>{r.acierto ? '✅' : '⏭️'}</span>
                <span className={r.acierto ? 'text-white' : 'text-white/40 line-through'}>
                  {r.nombre}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={volverAConfig}
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold py-3"
          >
            ⚙️ Ajustes
          </button>
          <button
            onClick={empezar}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black py-3"
          >
            🔁 Otra vez
          </button>
        </div>
      </div>
    )
  }

  // Pantalla de configuración
  const toggleCat = (id) => {
    setCatsSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-white font-black text-lg">🤳 ¿Quién soy?</h2>
        <p className="text-white/50 text-sm">
          Móvil en la frente. Los demás te dan pistas y tú adivinas quién eres.
        </p>
      </div>

      {/* Modo de juego */}
      <div>
        <p className="text-white/60 text-sm font-semibold mb-2">Modo de juego</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setModo('rapido')}
            className={`rounded-xl p-3 text-left transition ${
              modo === 'rapido'
                ? 'bg-amber-500 text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <span className="block font-bold text-sm">⚡ Contrarreloj</span>
            <span
              className={`block text-xs ${
                modo === 'rapido' ? 'text-black/70' : 'text-white/40'
              }`}
            >
              Cuantos más aciertes, mejor.
            </span>
          </button>
          <button
            onClick={() => setModo('turnos')}
            className={`rounded-xl p-3 text-left transition ${
              modo === 'turnos'
                ? 'bg-amber-500 text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <span className="block font-bold text-sm">🧠 Por turnos</span>
            <span
              className={`block text-xs ${
                modo === 'turnos' ? 'text-black/70' : 'text-white/40'
              }`}
            >
              Un personaje cada uno, sin prisa.
            </span>
          </button>
        </div>
      </div>

      {/* Categorías */}
      <div>
        <p className="text-white/60 text-sm font-semibold mb-2">Categorías</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => {
            const on = catsSel.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCat(c.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  on
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Duración (solo en contrarreloj) */}
      {modo === 'rapido' && (
        <div>
          <p className="text-white/60 text-sm font-semibold mb-2">Duración</p>
          <div className="flex gap-2">
            {DURACIONES.map((d) => (
              <button
                key={d}
                onClick={() => setDuracion(d)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                  duracion === d
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modo de control */}
      <label className="flex items-center justify-between gap-3 cursor-pointer rounded-2xl bg-white/5 p-4">
        <span className="text-white text-sm font-semibold">
          📐 Modo inclinación
          <span className="block text-white/40 text-xs font-normal">
            Inclina abajo para acertar y arriba para pasar (en vez de tocar botones).
          </span>
        </span>
        <input
          type="checkbox"
          checked={modoInclinacion}
          onChange={(e) => setModoInclinacion(e.target.checked)}
          className="h-5 w-5 accent-amber-500"
        />
      </label>

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}

      <button
        onClick={empezar}
        className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black py-4 text-lg active:scale-[0.98] transition"
      >
        🎬 ¡Empezar partida!
      </button>

      <p className="text-center text-white/30 text-xs">
        {modo === 'turnos'
          ? 'Por turnos: a cada uno le toca un personaje. Con el móvil en la frente, pregunta a los demás (¿soy deportista?, ¿español?…) hasta adivinar. Sin prisa.'
          : 'Contrarreloj: móvil en la frente (en horizontal), que el resto te vea la pantalla. Te dan pistas y vas acertando a contrarreloj.'}
      </p>
    </div>
  )
}
