import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from './supabaseClient'
import { UsuarioProvider, useUsuario } from './context/UsuarioContext'
import Login from './components/Login'
import Contador from './components/Contador'
import Ranking from './components/Ranking'
import Misiones from './components/Misiones'
import Galeria from './components/Galeria'
import Resumen from './components/Resumen'
import Predicciones from './components/Predicciones'
import Ruleta from './components/Ruleta'
import QuienSoy from './components/QuienSoy'
import Wrapped from './components/Wrapped'
import Ajustes from './components/Ajustes'
import Avatar from './components/Avatar'
import Logo from './components/Logo'

const TABS = [
  { id: 'contador', label: 'Contador', emoji: '🍻' },
  { id: 'misiones', label: 'Misiones', emoji: '🎯' },
  { id: 'predis', label: 'Predis', emoji: '🔮' },
  { id: 'ruleta', label: 'Ruleta', emoji: '🎰' },
  { id: 'quiensoy', label: 'Quién soy', emoji: '🤳' },
  { id: 'resumen', label: 'Resumen', emoji: '📊' },
  { id: 'fotos', label: 'Álbum', emoji: '📸' },
]

function Avisos() {
  if (supabaseConfigurado) return null
  return (
    <div className="bg-rose-600 text-white text-sm px-4 py-2 text-center">
      ⚠️ Falta configurar Supabase (variables <code>VITE_SUPABASE_URL</code> y{' '}
      <code>VITE_SUPABASE_ANON_KEY</code>). Mira el README.
    </div>
  )
}

function AppInterna() {
  const { usuario } = useUsuario()
  const [tab, setTab] = useState('contador')
  const [ajustes, setAjustes] = useState(false)
  const [viajeCerrado, setViajeCerrado] = useState(false)
  const [verWrapped, setVerWrapped] = useState(false)
  const [avisoPredis, setAvisoPredis] = useState(false)

  // Una vez al día, recordamos hacer las predicciones (se guarda por dispositivo).
  useEffect(() => {
    if (!usuario) return
    const clave = 'vicio.predis.' + new Date().toLocaleDateString('sv')
    if (!localStorage.getItem(clave)) setAvisoPredis(true)
  }, [usuario])

  const cerrarAvisoPredis = (irAPredis) => {
    localStorage.setItem('vicio.predis.' + new Date().toLocaleDateString('sv'), '1')
    setAvisoPredis(false)
    if (irAPredis) setTab('predis')
  }

  // Estado del viaje (abierto/cerrado) en vivo para todos.
  useEffect(() => {
    if (!supabaseConfigurado) return
    let activo = true
    supabase
      .from('viaje')
      .select('cerrado')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (!activo) return
        setViajeCerrado(!!data?.cerrado)
        setVerWrapped(!!data?.cerrado)
      })
    const canal = supabase
      .channel('viaje')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viaje' }, (payload) => {
        const c = !!payload.new?.cerrado
        setViajeCerrado(c)
        setVerWrapped(c)
      })
      .subscribe()
    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  if (!supabaseConfigurado) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <Avisos />
        <div className="text-white/70 p-6 text-center">
          Configura Supabase para empezar. Tienes los pasos en el README.
        </div>
      </div>
    )
  }

  if (!usuario) return <Login />

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Cabecera */}
      <header className="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">😈</span>
            <Logo size="md" />
          </div>
          <button onClick={() => setAjustes(true)} className="flex items-center gap-2">
            {usuario.es_admin && <span className="text-amber-400 text-sm">👑</span>}
            <Avatar nombre={usuario.nombre} url={usuario.avatar_url} size={32} />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-5 pb-24">
        {tab === 'contador' && <Contador />}
        {tab === 'misiones' && <Misiones />}
        {tab === 'predis' && <Predicciones />}
        {tab === 'ruleta' && <Ruleta />}
        {tab === 'quiensoy' && <QuienSoy />}
        {tab === 'resumen' && (
          <div className="space-y-10">
            <Resumen />
            <Ranking />
          </div>
        )}
        {tab === 'fotos' && <Galeria />}
      </main>

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-neutral-900/95 backdrop-blur border-t border-white/10">
        <div className="max-w-md mx-auto grid grid-cols-7">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2.5 flex flex-col items-center gap-0.5 text-[10px] transition ${
                tab === t.id ? 'text-amber-400' : 'text-white/50'
              }`}
            >
              <span className="text-lg">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {ajustes && <Ajustes onClose={() => setAjustes(false)} />}
      {viajeCerrado && verWrapped && <Wrapped onClose={() => setVerWrapped(false)} />}

      {avisoPredis && !viajeCerrado && (
        <div
          className="fixed inset-0 bg-black/70 z-40 flex items-end sm:items-center justify-center"
          onClick={() => cerrarAvisoPredis(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">🔮</div>
            <h2 className="text-white font-black text-xl">¡Nuevo día, nuevas movidas!</h2>
            <p className="text-white/60 text-sm">
              ¿Quién crees que la va a liar hoy? Escribe tus predicciones y al final del día se votan.
            </p>
            <button
              onClick={() => cerrarAvisoPredis(true)}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold py-3"
            >
              🔮 Hacer mis predicciones
            </button>
            <button
              onClick={() => cerrarAvisoPredis(false)}
              className="w-full text-white/40 text-sm py-1"
            >
              Luego
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <UsuarioProvider>
      <AppInterna />
    </UsuarioProvider>
  )
}
