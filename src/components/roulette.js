// Constantes y utilidades compartidas de la ruleta europea (un solo cero).

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export function colorOf(n) {
  if (n === 0) return 'green'
  return RED.has(n) ? 'red' : 'black'
}

// Denominaciones de ficha disponibles en la mesa. Las fichas salen de las
// consumiciones del día (1 consumición = 1 ficha), así que son cantidades bajas.
export const CHIP_VALUES = [1, 5, 10, 25, 50]

// Claves de apuesta del cliente:
//   "g:17" pleno · "g:1-2" caballo · "g:1-2-3" calle · "g:1-2-4-5" cuadro ·
//   "g:1-2-3-4-5-6" línea · "g:0-1-2-3" basket  (apuestas a números) ·
//   "dozen:1" docena · "column:3" columna ·
//   "red"|"black"|"even"|"odd"|"low"|"high" exteriores.
export function gkey(nums) {
  return 'g:' + [...nums].sort((a, b) => a - b).join('-')
}

function keyNums(key) {
  return key.slice(2).split('-').map(Number)
}

export function betWins(key, n) {
  if (key.startsWith('g:')) return keyNums(key).includes(n)
  if (key.startsWith('dozen:')) {
    const v = Number(key.slice(6))
    return n >= (v - 1) * 12 + 1 && n <= v * 12
  }
  if (key.startsWith('column:')) {
    const v = Number(key.slice(7))
    return n !== 0 && (v === 3 ? n % 3 === 0 : n % 3 === v)
  }
  switch (key) {
    case 'red': return RED.has(n)
    case 'black': return n !== 0 && !RED.has(n)
    case 'even': return n !== 0 && n % 2 === 0
    case 'odd': return n % 2 === 1
    case 'low': return n >= 1 && n <= 18
    case 'high': return n >= 19 && n <= 36
    default: return false
  }
}

// Pago total (incluye la apuesta) si la clave gana: pleno/caballo/... = 36/nº de
// números cubiertos; docena y columna = 3; exteriores = 2.
export function payoutMultiplier(key) {
  if (key.startsWith('g:')) return 36 / keyNums(key).length
  if (key.startsWith('dozen:') || key.startsWith('column:')) return 3
  return 2
}

export const shortChip = (n) => (n >= 1000 ? `${n / 1000}k` : `${n}`)
