import { createContext, useContext, useEffect, useState } from 'react'

const UsuarioContext = createContext(null)
const STORAGE_KEY = 'viajejerez.usuario'

export function UsuarioProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (usuario) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [usuario])

  const cerrarSesion = () => setUsuario(null)

  return (
    <UsuarioContext.Provider value={{ usuario, setUsuario, cerrarSesion }}>
      {children}
    </UsuarioContext.Provider>
  )
}

export function useUsuario() {
  const ctx = useContext(UsuarioContext)
  if (!ctx) throw new Error('useUsuario debe usarse dentro de UsuarioProvider')
  return ctx
}
