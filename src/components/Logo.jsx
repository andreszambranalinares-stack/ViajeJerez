// Logotipo de la marca: "Vicio" + "JRZ" con degradado neón.
export default function Logo({ size = 'md', className = '' }) {
  const tam = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  }[size]
  return (
    <span className={`font-black tracking-tight ${tam} ${className}`}>
      <span className="text-white">Vicio</span>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500">
        JRZ
      </span>
    </span>
  )
}
