import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from './supabaseClient'
import { UsuarioProvider, useUsuario } from './context/UsuarioContext'
import Login from './components/Login'
import Contador from './components/Contador'
import Ranking from './components/Ranking'
import Misiones from './components/Misiones'
import Galeria from './components/Galeria'
import Resumen from './components/Resumen'
import Wrapped from './components/Wrapped'
import Ajustes from './components/Ajustes'
import Avatar from './components/Avatar'
import Logo from './components/Logo'

const TABS = [
  { id: 'contador', label: 'Contador', emoji: '🍻' },
  { id: 'misiones', label: 'Misiones', emoji: '🎯' },
  { id: 'resumen', label: 'Resumen', emoji: '📊' },
  { id: 'ranking', label: 'Ranking', emoji: '🏆' },
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
        {tab === 'resumen' && <Resumen />}
        {tab === 'ranking' && <Ranking />}
        {tab === 'fotos' && <Galeria />}
      </main>

      {/* Barra de navegación inferior */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-neutral-900/95 backdrop-blur border-t border-white/10">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] transition ${
                tab === t.id ? 'text-amber-400' : 'text-white/50'
              }`}
            >
              <span className="text-xl">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {ajustes && <Ajustes onClose={() => setAjustes(false)} />}
      {viajeCerrado && verWrapped && <Wrapped onClose={() => setVerWrapped(false)} />}
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
