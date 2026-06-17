// Banco de ideas para las misiones diarias. El admin puede generarlas
// automáticamente desde aquí (2 fáciles + 1 difícil) o escribir las suyas.
// Usa {X} cuando la misión tenga un "objetivo" (otra persona del grupo).

export const FACILES = [
  'Hazle una foto a {X} sin que se entere',
  'Consigue que {X} pague la siguiente ronda',
  'Cuela la palabra "pescaíto" en una conversación con {X}',
  'Brinda con {X} diciendo un piropo flamenco',
  'Haz que {X} se ría con un chiste malo',
  'Convence a {X} de probar un fino',
  'Saca una foto de grupo donde alguien salga fatal',
  'Que {X} te haga un cumplido (provócalo)',
  'Manda un audio cantando a {X}',
  'Imita el acento jerezano delante de {X}',
]

export const DIFICILES = [
  'Róbale una prenda a {X} sin que se dé cuenta (y devuélvela luego)',
  'Gástale una broma inofensiva a {X} y que pique',
  'Consigue el número de teléfono de un/a desconocido/a para {X}',
  'Haz que {X} se suba a bailar sevillanas',
  'Lidera un brindis para todo el grupo con discurso incluido',
  'Convence a un camarero de que te invite a algo',
  'Organiza un reto entre dos del grupo y que se cumpla',
  'Consigue una foto con alguien de fuera del grupo',
]

function rellena(plantilla, objetivoNombre) {
  return plantilla.replaceAll('{X}', objetivoNombre || 'alguien del grupo')
}

function aleatorio(lista, n) {
  const copia = [...lista]
  const out = []
  while (out.length < n && copia.length) {
    out.push(copia.splice(Math.floor(Math.random() * copia.length), 1)[0])
  }
  return out
}

// Genera 3 misiones (2 fáciles, 1 difícil). Si pasas una lista de usuarios,
// asigna objetivos aleatorios a las que llevan {X}.
export function generarMisionesDelDia(usuarios = []) {
  const conObjetivo = (plantilla, dificultad, puntos) => {
    let objetivo = null
    if (plantilla.includes('{X}') && usuarios.length) {
      objetivo = usuarios[Math.floor(Math.random() * usuarios.length)]
    }
    return {
      titulo: rellena(plantilla, objetivo?.nombre),
      dificultad,
      puntos,
      objetivo_id: objetivo?.id ?? null,
    }
  }

  const faciles = aleatorio(FACILES, 2).map((p) => conObjetivo(p, 'facil', 1))
  const dificil = aleatorio(DIFICILES, 1).map((p) => conObjetivo(p, 'dificil', 3))
  return [...faciles, ...dificil]
}
