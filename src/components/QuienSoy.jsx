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
  const [usuarios, setUsuarios] = useState([])

  // Configuración de la partida
  const [catsSel, setCatsSel] = useState(() => new Set(CATEGORIAS.map((c) => c.id)))
  const [presentes, setPresentes] = useState(() => new Set())
  const [incluirGrupo, setIncluirGrupo] = useState(true)
  const [duracion, setDuracion] = useState(90)
  const [modoInclinacion, setModoInclinacion] = useState(false)

  // Estado del juego: 'config' | 'cuenta' | 'jugando' | 'fin'
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
        const lista = data ?? []
        setUsuarios(lista)
        setPresentes(new Set(lista.map((u) => u.id)))
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
    if (!incluirGrupo) return []
    return usuarios.filter((u) => presentes.has(u.id)).map((u) => u.nombre)
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
      setTiempo(duracion)
      setFase('jugando')
      return
    }
    const t = setTimeout(() => setCuenta((c) => c - 1), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, cuenta])

  // Cronómetro de la partida
  useEffect(() => {
    if (fase !== 'jugando') return
    if (tiempo <= 0) {
      setFase('fin')
      return
    }
    const t = setTimeout(() => setTiempo((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, tiempo])

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
      const sig = siguienteNombre()
      actualRef.current = sig
      setActual(sig)
      setFeedback(null)
      bloqueadoRef.current = false
    }, 650)
  }

  function volverAConfig() {
    setFase('config')
    setFeedback(null)
  }

  // --- Render ---
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
        {/* Tiempo */}
        <div className="pt-4 text-center">
          <span
            className={`text-2xl font-black ${
              tiempo <= 10 ? 'text-rose-300 animate-pulse' : 'text-white/70'
            }`}
          >
            {tiempo}s
          </span>
        </div>

        {/* Nombre / feedback */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {feedback ? (
            <div className="text-6xl font-black text-white">
              {feedback === 'acierto' ? '✅ ¡SÍ!' : '⏭️ PASO'}
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
            <p>⬇️ Inclina abajo = <b>Acerté</b></p>
            <p>⬆️ Inclina arriba = <b>Paso</b></p>
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
                ⏭️ Paso
              </button>
              <button
                onClick={() => resolver(true)}
                className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black py-6 text-lg active:scale-95 transition"
              >
                ✅ ¡Lo tiene!
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
          <h2 className="text-white font-black text-lg">🏁 ¡Se acabó el tiempo!</h2>
          <p className="text-6xl font-black text-amber-400 my-2">{aciertos}</p>
          <p className="text-white/50 text-sm">
            {aciertos === 1 ? 'acierto' : 'aciertos'} de {resultados.length} cartas
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
  const togglePresente = (id) => {
    setPresentes((prev) => {
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
          Si lo pillas, ¡siguiente! ¿Te atreves?
        </p>
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

      {/* Los del viaje */}
      <div className="rounded-2xl bg-white/5 p-4 space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-white text-sm font-semibold">
            😈 Colar a los del viaje
            <span className="block text-white/40 text-xs font-normal">
              De vez en cuando saldrá uno del grupo… ¡hasta tú mismo!
            </span>
          </span>
          <input
            type="checkbox"
            checked={incluirGrupo}
            onChange={(e) => setIncluirGrupo(e.target.checked)}
            className="h-5 w-5 accent-amber-500"
          />
        </label>

        {incluirGrupo && usuarios.length > 0 && (
          <div>
            <p className="text-white/40 text-xs mb-2">¿Quiénes estáis en la partida?</p>
            <div className="flex flex-wrap gap-2">
              {usuarios.map((u) => {
                const on = presentes.has(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => togglePresente(u.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      on
                        ? 'bg-emerald-500/80 text-black'
                        : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    {u.nombre}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Duración */}
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
        Pon el móvil en la frente (en horizontal), que el resto te vea la pantalla.
        Te dan pistas sin decir el nombre y tú adivinas.
      </p>
    </div>
  )
}
