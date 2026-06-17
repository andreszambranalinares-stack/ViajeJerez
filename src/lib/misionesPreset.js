// Banco de ideas para las misiones diarias. El admin puede generarlas
// automáticamente desde aquí (2 fáciles + 1 difícil) o escribir las suyas.
// Usa {X} cuando la misión tenga un "objetivo" (otra persona del grupo).

export const FACILES = [
  'Hazle una foto a {X} sin que se entere',
  'Consigue que {X} pague la siguiente ronda',
  'Haz que {X} se ría con un chiste malo',
  'Cámbiale el fondo de pantalla del móvil a {X}',
  'Despeina a {X} por sorpresa',
  'Llama a {X} por un nombre equivocado durante toda una hora',
  'Hazte un selfie con la cara más tonta posible y mándalo al grupo',
  'Habla solo con emojis en el grupo durante 10 minutos',
  'Ponte una prenda de {X} sin pedir permiso (gorra, gafas, chaqueta)',
  'Manda un audio cantando una canción cualquiera al grupo',
  'Consigue que {X} te dé el último trago de su copa',
  'Saca a {X} a bailar aunque sea media canción',
  'Ponle un mote nuevo a {X} y que se quede para el viaje',
  'Choca los cinco con tres desconocidos seguidos',
  'Aguanta 10 minutos sin decir la palabra "no" (si fallas, repites)',
  'Hazle cosquillas a {X} por sorpresa',
  'Cuéntale un secreto falso a {X} a ver si se lo traga',
  'Saca una foto de grupo donde alguien salga fatal',
  'Que {X} te haga un cumplido (provócalo)',
  'Mándale un mensaje cursi y por sorpresa a {X}',
  'Ponte a bailar 30 segundos donde estés aunque no haya música',
  'Hazle una foto fea a {X} y ponla de fondo de tu móvil un rato',
  'Imita a {X} hablando y que el grupo adivine quién es',
  'Imita la risa de {X}',
  'Imita a {X} andando 10 metros',
  'Imita a {X} pidiendo en la barra',
  'Imita la cara que pone {X} cuando bebe un chupito',
  'Imita a {X} bailando',
  'Imita una frase típica que siempre dice {X}',
]

export const DIFICILES = [
  'Intenta conseguir el Instagram de una minita (alguien que no conozcas)',
  'Consigue el número de teléfono de un/a desconocido/a para {X}',
  'Róbale una prenda a {X} sin que se dé cuenta (y devuélvela luego)',
  'Gástale una broma inofensiva a {X} (con ayuda de otro) y que pique',
  'Esconde el móvil de {X} 15 min sin que se entere y luego devuélvelo',
  'Baila con un/a desconocido/a una canción entera',
  'Consigue que un/a desconocido/a te invite a una copa',
  'Pídele salir de coña a un/a desconocido/a y que te siga el rollo',
  'Cámbiate una prenda con {X} y aguanta así media hora',
  'Reta a {X} a un pulso delante de gente y gánale',
  'Convence a otro grupo de hacerse una foto con vosotros',
  'Monta un karaoke improvisado y que se apunte {X}',
  'Haz que {X} confiese su mayor vergüenza del viaje',
  'Lidera un brindis para todo el grupo con discurso incluido',
  'Consigue que tres desconocidos te sigan en Instagram esta noche',
  'Haz que {X} pague una ronda entera',
  'Imita a {X} durante 5 minutos seguidos sin que se enfade',
  'Graba un vídeo imitando a {X} y que él/ella te dé el visto bueno',
  'Consigue que un/a desconocido/a se aprenda el nombre de {X}',
  'Convence a un camarero de que te invite a algo',
  'Organiza que todo el grupo cambie de bar en menos de 10 minutos',
  'Échate un pulso contra {X} y gánale',
  'Desafía a {X} a un duelo (dardos, futbolín, lo que sea) y gánale',
  'Reta a {X} a aguantar más sin beber agua y gánale',
]

// Misiones de dificultad media (2 puntos). El admin las puede usar al añadir
// a mano; el generador automático sigue dando 2 fáciles + 1 difícil.
export const MEDIAS = [
  'Consigue que {X} te invite a un chupito',
  'Haz una foto de grupo con un desconocido en medio',
  'Convence a {X} de cambiarse el peinado un rato',
  'Haz que {X} baile sin música durante 20 segundos',
  'Reúne al grupo para una foto saltando todos a la vez',
  'Consigue un piropo de un camarero/a',
  'Que {X} se aprenda y diga un trabalenguas sin fallar',
  'Intercambia una prenda con {X} durante 10 minutos',
  'Gana a {X} a piedra-papel-tijera al mejor de 5',
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

// Genera UNA misión difícil al azar (para el re-roll personal de cada uno).
export function generarUnaDificil(usuarios = []) {
  const plantilla = aleatorio(DIFICILES, 1)[0]
  let objetivo = null
  if (plantilla.includes('{X}') && usuarios.length) {
    objetivo = usuarios[Math.floor(Math.random() * usuarios.length)]
  }
  const titulo = rellena(plantilla, objetivo?.nombre)
  return { titulo, dificultad: 'dificil', puntos: 3, objetivo_id: objetivo?.id ?? null }
}
