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
  'Consigue un selfie con {X} poniendo los dos morritos',
  'Haz que {X} diga "ozú" sin darse cuenta',
  'Pídele a {X} que te lleve a caballito 5 segundos',
  'Choca los cinco con tres desconocidos seguidos',
  'Aprende el nombre de un camarero y salúdalo por su nombre',
  'Haz un brindis dedicado a {X} delante de todos',
  'Consigue que {X} te dé el último trago de su copa',
  'Saca a {X} a la pista de baile aunque sea una canción',
  'Cuenta un secreto inofensivo a {X} y que te jure guardarlo',
  'Haz que todo el grupo grite "¡VIVA JEREZ!" a la vez',
  'Ponle un mote nuevo a {X} y que se quede para el viaje',
  'Pídele una receta de tapa típica a alguien del bar',
  'Haz una foto imitando una estatua o cartel de la calle',
  'Consigue que {X} se ponga tus gafas/gorra para una foto',
  'Imita a {X} hablando y que el grupo adivine que es él/ella',
  'Imita la risa de {X}',
  'Imita a {X} andando por la calle 10 metros',
  'Imita a {X} pidiendo en la barra',
  'Imita la cara que pone {X} cuando bebe un chupito',
  'Imita a {X} bailando',
  'Imita una frase típica que siempre dice {X}',
  'Imita a {X} haciéndose un selfie',
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
  'Consigue que un desconocido se sepa el nombre de {X}',
  'Haz que {X} pague TODAS las consumiciones de una ronda',
  'Baila con alguien que no sea del grupo una canción entera',
  'Consigue que te dejen entrar a la cocina o barra de un bar',
  'Monta un karaoke improvisado y que se apunte {X}',
  'Cámbiate una prenda con {X} y aguanta así media hora',
  'Consigue que tres desconocidos brinden con vosotros',
  'Haz que {X} confiese su mayor vergüenza del viaje',
  'Convence a otro grupo de hacerse una foto con vosotros',
  'Consigue una servilleta firmada por el camarero como "trofeo"',
  'Haz que {X} cante el estribillo de una canción a pleno pulmón',
  'Organiza que todo el grupo cambie de sitio/bar en menos de 10 min',
  'Imita a {X} durante 5 minutos seguidos sin que se enfade',
  'Haz una imitación de {X} delante de un desconocido y que se ría',
  'Graba un vídeo imitando a {X} y que él/ella le dé el visto bueno',
]

// Misiones de dificultad media (2 puntos). El admin las puede usar al añadir
// a mano; el generador automático sigue dando 2 fáciles + 1 difícil.
export const MEDIAS = [
  'Consigue que {X} te invite a un chupito',
  'Haz una foto de grupo con un desconocido en medio',
  'Que {X} se aprenda y diga un trabalenguas',
  'Convence a {X} de cambiarse el peinado un rato',
  'Consigue propina... digo, un piropo de un camarero',
  'Haz que {X} baile sin música durante 20 segundos',
  'Reúne al grupo para una foto saltando todos a la vez',
  'Que {X} pida algo en el bar con acento andaluz cerrado',
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
