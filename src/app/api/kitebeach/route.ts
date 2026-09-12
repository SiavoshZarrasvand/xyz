import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { broadcastCrmEvent } from '@/lib/events'

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/
export const MAX_BATCH_SIZE = 500

function corsFor ( request: NextRequest ): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' }
  const origin = request.headers.get( 'origin' )

  if ( origin && ( EXTENSION_ORIGIN.test( origin ) || origin.startsWith( 'http://localhost' ) ) ) {
    headers[ 'Access-Control-Allow-Origin' ] = origin
    headers[ 'Access-Control-Allow-Methods' ] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers[ 'Access-Control-Allow-Headers' ] = 'Content-Type, Authorization'
    headers[ 'Access-Control-Max-Age' ] = '600'
  } else {
    headers[ 'Access-Control-Allow-Origin' ] = '*'
    headers[ 'Access-Control-Allow-Methods' ] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers[ 'Access-Control-Allow-Headers' ] = 'Content-Type, Authorization'
  }

  return headers
}

function text ( ...candidates: unknown[] ): string {
  for ( const candidate of candidates ) {
    if ( candidate === null || candidate === undefined ) continue
    const value = String( candidate ).trim()
    if ( value ) return value
  }
  return ''
}

function numeric ( value: unknown, parse: ( raw: string ) => number ): number | null {
  if ( value === null || value === undefined || value === '' ) return null
  const parsed = parse( String( value ).replace( /[^0-9.]/g, '' ) )
  return Number.isFinite( parsed ) ? parsed : null
}

export interface SpotDef {
  pattern: RegExp
  name: string // Exact spot name
  destination: string // Travel destination / island / region
  defaultCity?: string
  defaultState?: string
  defaultCountry?: string
}

export const KNOWN_SPOTS: SpotDef[] = [
  // ==========================================
  // Brazil — Ceará, Piauí, Maranhão, and RN
  // ==========================================
  // Ceará — Northwest Corridor
  { pattern: /\bcau[ií]pe\b/i, name: 'Cauípe Lagoon', destination: 'Cumbuco', defaultCity: 'Caucaia', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bcumbuco\b/i, name: 'Cumbuco Beach', destination: 'Cumbuco', defaultCity: 'Caucaia', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bta[ií]ba\b/i, name: 'Taíba', destination: 'Taíba', defaultCity: 'São Gonçalo do Amarante', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\b(?:paracuru|quebramar)\b/i, name: 'Quebramar', destination: 'Paracuru', defaultCity: 'Paracuru', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\blagoinha\b/i, name: 'Lagoinha', destination: 'Lagoinha', defaultCity: 'Paraipaba', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bguajir[uú]\b/i, name: 'Guajirú', destination: 'Guajirú', defaultCity: 'Trairi', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bflecheiras\b/i, name: 'Flecheiras', destination: 'Flecheiras', defaultCity: 'Trairi', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bbaleia\b/i, name: 'Baleia', destination: 'Baleia', defaultCity: 'Itapipoca', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\b(?:icara[ií]zinho|icara[ií]\s+de\s+amontada)\b/i, name: 'Icaraizinho', destination: 'Icaraizinho', defaultCity: 'Amontada', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\b(?:ilha\s+do\s+guajir[uú]|ilhadoguajiru)\b/i, name: 'Ilha do Guajirú', destination: 'Ilha do Guajirú', defaultCity: 'Itarema', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bpre[aá]\b/i, name: 'Preá Beach', destination: 'Jericoacoara & Preá', defaultCity: 'Cruz', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bbarrinha(?:\s+de\s+baixo)?\b/i, name: 'Barrinha', destination: 'Jericoacoara & Preá', defaultCity: 'Acaraú', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bacara[uú]\b/i, name: 'Acaraú', destination: 'Acaraú', defaultCity: 'Acaraú', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\b(?:jericoacoara|jeri)\b/i, name: 'Jericoacoara', destination: 'Jericoacoara & Preá', defaultCity: 'Jijoca de Jericoacoara', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bguri[uú]\b/i, name: 'Guriú Lagoon', destination: 'Jericoacoara & Preá', defaultCity: 'Camocim', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\btatajuba\b/i, name: 'Tatajuba', destination: 'Tatajuba', defaultCity: 'Camocim', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bcamocim\b/i, name: 'Camocim', destination: 'Camocim', defaultCity: 'Camocim', defaultState: 'CE', defaultCountry: 'Brazil' },

  // Ceará — Southeast Corridor
  { pattern: /\bporto\s+das\s+dunas\b/i, name: 'Porto das Dunas', destination: 'Fortaleza & Aquiraz', defaultCity: 'Aquiraz', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\b(?:aquiraz|lagoa\s+do\s+catu)\b/i, name: 'Aquiraz', destination: 'Fortaleza & Aquiraz', defaultCity: 'Aquiraz', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\biguape\b/i, name: 'Iguape', destination: 'Fortaleza & Aquiraz', defaultCity: 'Aquiraz', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bbarra\s+nova\b/i, name: 'Barra Nova', destination: 'Barra Nova', defaultCity: 'Cascavel', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\burua[uú]\b/i, name: 'Uruaú Lagoon', destination: 'Uruaú', defaultCity: 'Beberibe', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bparajuru\b/i, name: 'Parajuru', destination: 'Parajuru', defaultCity: 'Beberibe', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bpontal\s+de\s+macei[oó]\b/i, name: 'Pontal de Maceió', destination: 'Fortim', defaultCity: 'Fortim', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bfortim\b/i, name: 'Fortim', destination: 'Fortim', defaultCity: 'Fortim', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bcanoa\s+quebrada\b/i, name: 'Canoa Quebrada', destination: 'Canoa Quebrada', defaultCity: 'Aracati', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bmajorl[aâ]ndia\b/i, name: 'Majorlândia', destination: 'Canoa Quebrada', defaultCity: 'Aracati', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bquixaba\b/i, name: 'Quixaba', destination: 'Canoa Quebrada', defaultCity: 'Aracati', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\b(?:icapu[ií]|redonda|peroba|ponta\s+grossa)\b/i, name: 'Icapuí', destination: 'Icapuí', defaultCity: 'Icapuí', defaultState: 'CE', defaultCountry: 'Brazil' },
  { pattern: /\bfortaleza\b/i, name: 'Fortaleza', destination: 'Fortaleza & Aquiraz', defaultCity: 'Fortaleza', defaultState: 'CE', defaultCountry: 'Brazil' },

  // Piauí (PI)
  { pattern: /\bbarra\s+grande\b/i, name: 'Barra Grande', destination: 'Barra Grande (PI)', defaultCity: 'Cajueiro da Praia', defaultState: 'PI', defaultCountry: 'Brazil' },
  { pattern: /\bmacap[aá]\b/i, name: 'Macapá', destination: 'Barra Grande (PI)', defaultCity: 'Luís Correia', defaultState: 'PI', defaultCountry: 'Brazil' },

  // Maranhão (MA)
  { pattern: /\batins\b/i, name: 'Atins', destination: 'Lençóis Maranhenses', defaultCity: 'Barreirinhas', defaultState: 'MA', defaultCountry: 'Brazil' },
  { pattern: /\bbarreirinhas\b/i, name: 'Barreirinhas', destination: 'Lençóis Maranhenses', defaultCity: 'Barreirinhas', defaultState: 'MA', defaultCountry: 'Brazil' },

  // Rio Grande do Norte (RN)
  { pattern: /\b(?:s[aã]o\s+miguel\s+do\s+gostoso|gostoso)\b/i, name: 'São Miguel do Gostoso', destination: 'São Miguel do Gostoso', defaultCity: 'São Miguel do Gostoso', defaultState: 'RN', defaultCountry: 'Brazil' },
  { pattern: /\b(?:galinhos|galos)\b/i, name: 'Galinhos', destination: 'Galinhos', defaultCity: 'Galinhos', defaultState: 'RN', defaultCountry: 'Brazil' },
  { pattern: /\btibau\b/i, name: 'Tibau', destination: 'Tibau', defaultCity: 'Tibau', defaultState: 'RN', defaultCountry: 'Brazil' },
  { pattern: /\btouros\b/i, name: 'Touros', destination: 'Touros', defaultCity: 'Touros', defaultState: 'RN', defaultCountry: 'Brazil' },
  { pattern: /\b(?:pipa|tibau\s+do\s+sul|madeiro|amor)\b/i, name: 'Pipa & Tibau do Sul', destination: 'Pipa & RN South', defaultCity: 'Tibau do Sul', defaultState: 'RN', defaultCountry: 'Brazil' },
  { pattern: /\b(?:barra\s+do\s+cunha[uú]|cunha[uú])\b/i, name: 'Barra do Cunhaú', destination: 'Pipa & RN South', defaultCity: 'Canguaretama', defaultState: 'RN', defaultCountry: 'Brazil' },
  { pattern: /\bmaracaja[uú]\b/i, name: 'Maracajaú', destination: 'Maracajaú', defaultCity: 'Maxaranguape', defaultState: 'RN', defaultCountry: 'Brazil' },

  // ==========================================
  // Morocco — Dakhla & Essaouira (🇲🇦)
  // ==========================================
  { pattern: /\b(?:white\s+dune|dune\s+blanche)\b/i, name: 'White Dune', destination: 'Dakhla', defaultCity: 'Dakhla', defaultState: 'Dakhla-Oued Ed-Dahab', defaultCountry: 'Morocco' },
  { pattern: /\bspeed\s+spot\b/i, name: 'Speed Spot', destination: 'Dakhla', defaultCity: 'Dakhla', defaultState: 'Dakhla-Oued Ed-Dahab', defaultCountry: 'Morocco' },
  { pattern: /\b(?:lassarga|la\s+sarga)\b/i, name: 'Lassarga Point', destination: 'Dakhla', defaultCity: 'Dakhla', defaultState: 'Dakhla-Oued Ed-Dahab', defaultCountry: 'Morocco' },
  { pattern: /\bwestpoint\b/i, name: 'Westpoint', destination: 'Dakhla', defaultCity: 'Dakhla', defaultState: 'Dakhla-Oued Ed-Dahab', defaultCountry: 'Morocco' },
  { pattern: /\bpk25\b/i, name: 'PK25', destination: 'Dakhla', defaultCity: 'Dakhla', defaultState: 'Dakhla-Oued Ed-Dahab', defaultCountry: 'Morocco' },
  { pattern: /\bdakhla\b/i, name: 'Dakhla Lagoon', destination: 'Dakhla', defaultCity: 'Dakhla', defaultState: 'Dakhla-Oued Ed-Dahab', defaultCountry: 'Morocco' },
  { pattern: /\bsidi\s+kaouki\b/i, name: 'Sidi Kaouki', destination: 'Essaouira', defaultCity: 'Sidi Kaouki', defaultState: 'Marrakech-Safi', defaultCountry: 'Morocco' },
  { pattern: /\b(?:moulay|moulay\s+bouzerktoun)\b/i, name: 'Moulay Bouzerktoun', destination: 'Essaouira', defaultCity: 'Moulay Bouzerktoun', defaultState: 'Marrakech-Safi', defaultCountry: 'Morocco' },
  { pattern: /\bessaouira\b/i, name: 'Essaouira Bay', destination: 'Essaouira', defaultCity: 'Essaouira', defaultState: 'Marrakech-Safi', defaultCountry: 'Morocco' },
  { pattern: /\b(?:taghazout|tamraght|agadir)\b/i, name: 'Taghazout Bay', destination: 'Agadir & Taghazout', defaultCity: 'Taghazout', defaultState: 'Souss-Massa', defaultCountry: 'Morocco' },

  // ==========================================
  // Cape Verde — Sal & Boa Vista (🇨🇻)
  // ==========================================
  { pattern: /\b(?:kite\s+beach\s+sal|shark\s+bay)\b/i, name: 'Kite Beach (Shark Bay)', destination: 'Sal', defaultCity: 'Santa Maria', defaultState: 'Sal', defaultCountry: 'Cape Verde' },
  { pattern: /\bponta\s+preta\b/i, name: 'Ponta Preta', destination: 'Sal', defaultCity: 'Santa Maria', defaultState: 'Sal', defaultCountry: 'Cape Verde' },
  { pattern: /\b(?:santa\s+maria\s+sal|santa\s+maria)\b/i, name: 'Santa Maria', destination: 'Sal', defaultCity: 'Santa Maria', defaultState: 'Sal', defaultCountry: 'Cape Verde' },
  { pattern: /\bsal\b/i, name: 'Sal Island', destination: 'Sal', defaultCity: 'Espargos', defaultState: 'Sal', defaultCountry: 'Cape Verde' },
  { pattern: /\b(?:sal\s+rei|boa\s+vista)\b/i, name: 'Sal Rei Bay', destination: 'Boa Vista', defaultCity: 'Sal Rei', defaultState: 'Boa Vista', defaultCountry: 'Cape Verde' },
  { pattern: /\b(?:praia\s+carlota|carlota)\b/i, name: 'Praia Carlota', destination: 'Boa Vista', defaultCity: 'Sal Rei', defaultState: 'Boa Vista', defaultCountry: 'Cape Verde' },
  { pattern: /\bervat[aã]o\b/i, name: 'Ervatão Beach', destination: 'Boa Vista', defaultCity: 'Sal Rei', defaultState: 'Boa Vista', defaultCountry: 'Cape Verde' },

  // ==========================================
  // Mexico — Baja & Yucatán (🇲🇽)
  // ==========================================
  { pattern: /\bla\s+ventana\b/i, name: 'La Ventana', destination: 'Baja California Sur', defaultCity: 'La Ventana', defaultState: 'Baja California Sur', defaultCountry: 'Mexico' },
  { pattern: /\bel\s+sargento\b/i, name: 'El Sargento', destination: 'Baja California Sur', defaultCity: 'El Sargento', defaultState: 'Baja California Sur', defaultCountry: 'Mexico' },
  { pattern: /\blos\s+barriles\b/i, name: 'Los Barriles', destination: 'Baja California Sur', defaultCity: 'Los Barriles', defaultState: 'Baja California Sur', defaultCountry: 'Mexico' },
  { pattern: /\bla\s+paz\b/i, name: 'La Paz', destination: 'Baja California Sur', defaultCity: 'La Paz', defaultState: 'Baja California Sur', defaultCountry: 'Mexico' },
  { pattern: /\bel\s+cuyo\b/i, name: 'El Cuyo', destination: 'Yucatán & Riviera Maya', defaultCity: 'El Cuyo', defaultState: 'Yucatán', defaultCountry: 'Mexico' },
  { pattern: /\bisla\s+blanca\b/i, name: 'Isla Blanca Lagoon', destination: 'Yucatán & Riviera Maya', defaultCity: 'Cancún', defaultState: 'Quintana Roo', defaultCountry: 'Mexico' },
  { pattern: /\b(?:holbox|isla\s+holbox)\b/i, name: 'Isla Holbox', destination: 'Yucatán & Riviera Maya', defaultCity: 'Holbox', defaultState: 'Quintana Roo', defaultCountry: 'Mexico' },
  { pattern: /\btulum\b/i, name: 'Tulum Beach', destination: 'Yucatán & Riviera Maya', defaultCity: 'Tulum', defaultState: 'Quintana Roo', defaultCountry: 'Mexico' },
  { pattern: /\b(?:canc[uú]n|playa\s+del\s+carmen|puerto\s+morelos)\b/i, name: 'Riviera Maya', destination: 'Yucatán & Riviera Maya', defaultCity: 'Cancún', defaultState: 'Quintana Roo', defaultCountry: 'Mexico' },

  // ==========================================
  // Portugal — Silver Coast, North & Algarve (🇵🇹)
  // ==========================================
  { pattern: /\b(?:[oó]bidos|lagoa\s+de\s+[oó]bidos|foz\s+do\s+arelho)\b/i, name: 'Lagoa de Óbidos', destination: 'Silver Coast', defaultCity: 'Foz do Arelho', defaultState: 'Leiria', defaultCountry: 'Portugal' },
  { pattern: /\b(?:peniche|baleal)\b/i, name: 'Peniche & Baleal', destination: 'Silver Coast', defaultCity: 'Peniche', defaultState: 'Leiria', defaultCountry: 'Portugal' },
  { pattern: /\bguincho\b/i, name: 'Praia do Guincho', destination: 'Lisbon Coast', defaultCity: 'Cascais', defaultState: 'Lisbon', defaultCountry: 'Portugal' },
  { pattern: /\b(?:costa\s+da\s+caparica|fonte\s+da\s+telha)\b/i, name: 'Costa da Caparica', destination: 'Lisbon Coast', defaultCity: 'Almada', defaultState: 'Setúbal', defaultCountry: 'Portugal' },
  { pattern: /\b(?:viana\s+do\s+castelo|cabedelo)\b/i, name: 'Praia do Cabedelo', destination: 'Northern Portugal', defaultCity: 'Viana do Castelo', defaultState: 'Viana do Castelo', defaultCountry: 'Portugal' },
  { pattern: /\besposende\b/i, name: 'Esposende', destination: 'Northern Portugal', defaultCity: 'Esposende', defaultState: 'Braga', defaultCountry: 'Portugal' },
  { pattern: /\b(?:aveiro|ria\s+de\s+aveiro|barra)\b/i, name: 'Ria de Aveiro', destination: 'Northern Portugal', defaultCity: 'Ílhavo', defaultState: 'Aveiro', defaultCountry: 'Portugal' },
  { pattern: /\b(?:alvor|alvor\s+lagoon|ria\s+de\s+alvor)\b/i, name: 'Alvor Lagoon', destination: 'Algarve', defaultCity: 'Portimão', defaultState: 'Faro', defaultCountry: 'Portugal' },
  { pattern: /\blagos\b/i, name: 'Meia Praia (Lagos)', destination: 'Algarve', defaultCity: 'Lagos', defaultState: 'Faro', defaultCountry: 'Portugal' },
  { pattern: /\bsagres\b/i, name: 'Sagres (Tonel / Martinhal)', destination: 'Algarve', defaultCity: 'Vila do Bispo', defaultState: 'Faro', defaultCountry: 'Portugal' },
  { pattern: /\b(?:fuseta|ria\s+formosa|tavira|faro)\b/i, name: 'Fuseta (Ria Formosa)', destination: 'Algarve', defaultCity: 'Olhão', defaultState: 'Faro', defaultCountry: 'Portugal' },

  // ==========================================
  // Dominican Republic — Cabarete & Las Terrenas (🇩🇴)
  // ==========================================
  { pattern: /\b(?:kite\s+beach\s+cabarete|kite\s+beach)\b/i, name: 'Kite Beach', destination: 'Cabarete', defaultCity: 'Cabarete', defaultState: 'Puerto Plata', defaultCountry: 'Dominican Republic' },
  { pattern: /\bbozo\s+beach\b/i, name: 'Bozo Beach', destination: 'Cabarete', defaultCity: 'Cabarete', defaultState: 'Puerto Plata', defaultCountry: 'Dominican Republic' },
  { pattern: /\bencuentro\b/i, name: 'Playa Encuentro', destination: 'Cabarete', defaultCity: 'Cabarete', defaultState: 'Puerto Plata', defaultCountry: 'Dominican Republic' },
  { pattern: /\bla\s+boca\b/i, name: 'La Boca', destination: 'Cabarete', defaultCity: 'Cabarete', defaultState: 'Puerto Plata', defaultCountry: 'Dominican Republic' },
  { pattern: /\bcabarete\b/i, name: 'Cabarete Bay', destination: 'Cabarete', defaultCity: 'Cabarete', defaultState: 'Puerto Plata', defaultCountry: 'Dominican Republic' },
  { pattern: /\b(?:punta\s+cana|playa\s+blanca)\b/i, name: 'Playa Blanca', destination: 'Punta Cana', defaultCity: 'Punta Cana', defaultState: 'La Altagracia', defaultCountry: 'Dominican Republic' },
  { pattern: /\b(?:las\s+terrenas|portillo|playa\s+bonita)\b/i, name: 'Playa Portillo', destination: 'Las Terrenas', defaultCity: 'Las Terrenas', defaultState: 'Samaná', defaultCountry: 'Dominican Republic' },

  // ==========================================
  // Colombia — Guajira & Caribbean (🇨🇴)
  // ==========================================
  { pattern: /\bcabo\s+de\s+la\s+vela\b/i, name: 'Cabo de la Vela', destination: 'La Guajira', defaultCity: 'Uribia', defaultState: 'La Guajira', defaultCountry: 'Colombia' },
  { pattern: /\bmayapo\b/i, name: 'Mayapo Beach', destination: 'La Guajira', defaultCity: 'Manaure', defaultState: 'La Guajira', defaultCountry: 'Colombia' },
  { pattern: /\briohacha\b/i, name: 'Riohacha', destination: 'La Guajira', defaultCity: 'Riohacha', defaultState: 'La Guajira', defaultCountry: 'Colombia' },
  { pattern: /\b(?:cartagena|la\s+boquilla|manzanillo)\b/i, name: 'La Boquilla', destination: 'Cartagena', defaultCity: 'Cartagena', defaultState: 'Bolívar', defaultCountry: 'Colombia' },
  { pattern: /\bsalinas\s+del\s+rey\b/i, name: 'Salinas del Rey', destination: 'Barranquilla Coast', defaultCity: 'Juan de Acosta', defaultState: 'Atlántico', defaultCountry: 'Colombia' },
  { pattern: /\bsan\s+andr[eé]s\b/i, name: 'San Andrés Island', destination: 'San Andrés', defaultCity: 'San Andrés', defaultState: 'San Andrés', defaultCountry: 'Colombia' },
  { pattern: /\b(?:calima|lago\s+calima)\b/i, name: 'Lago Calima', destination: 'Lago Calima', defaultCity: 'Darién', defaultState: 'Valle del Cauca', defaultCountry: 'Colombia' },

  // ==========================================
  // Mauritius (🇲🇺)
  // ==========================================
  { pattern: /\b(?:le\s+morne|kite\s+lagoon|one\s+eye|manawa)\b/i, name: 'Kite Lagoon & One Eye', destination: 'Le Morne', defaultCity: 'Le Morne', defaultState: 'Black River', defaultCountry: 'Mauritius' },
  { pattern: /\banse\s+la\s+raie\b/i, name: 'Anse La Raie', destination: 'Mauritius North', defaultCity: 'Cap Malheureux', defaultState: 'Rivière du Rempart', defaultCountry: 'Mauritius' },
  { pattern: /\bbelle\s+mare\b/i, name: 'Belle Mare', destination: 'Mauritius East', defaultCity: 'Belle Mare', defaultState: 'Flacq', defaultCountry: 'Mauritius' },
  { pattern: /\b(?:pointe\s+d['’]esny|blue\s+bay)\b/i, name: 'Pointe d\'Esny', destination: 'Mauritius South', defaultCity: 'Mahebourg', defaultState: 'Grand Port', defaultCountry: 'Mauritius' },

  // ==========================================
  // Tanzania & Zanzibar (🇹🇿)
  // ==========================================
  { pattern: /\bpaje\b/i, name: 'Paje Beach', destination: 'Zanzibar', defaultCity: 'Paje', defaultState: 'Kusini', defaultCountry: 'Tanzania' },
  { pattern: /\bjambiani\b/i, name: 'Jambiani Beach', destination: 'Zanzibar', defaultCity: 'Jambiani', defaultState: 'Kusini', defaultCountry: 'Tanzania' },
  { pattern: /\bkiwengwa\b/i, name: 'Kiwengwa Beach', destination: 'Zanzibar', defaultCity: 'Kiwengwa', defaultState: 'Kaskazini Unguja', defaultCountry: 'Tanzania' },
  { pattern: /\bnungwi\b/i, name: 'Nungwi', destination: 'Zanzibar', defaultCity: 'Nungwi', defaultState: 'Kaskazini Unguja', defaultCountry: 'Tanzania' },

  // ==========================================
  // Kenya (🇰🇪)
  // ==========================================
  { pattern: /\bgalu(?:\s+beach)?\b/i, name: 'Galu Beach', destination: 'Diani', defaultCity: 'Diani', defaultState: 'Kwale', defaultCountry: 'Kenya' },
  { pattern: /\bdiani(?:\s+beach)?\b/i, name: 'Diani Beach', destination: 'Diani', defaultCity: 'Diani', defaultState: 'Kwale', defaultCountry: 'Kenya' },
  { pattern: /\bche\s+shale\b/i, name: 'Che Shale', destination: 'Malindi & Watamu', defaultCity: 'Malindi', defaultState: 'Kilifi', defaultCountry: 'Kenya' },
  { pattern: /\bwatamu\b/i, name: 'Watamu Marine Park', destination: 'Malindi & Watamu', defaultCity: 'Watamu', defaultState: 'Kilifi', defaultCountry: 'Kenya' },
  { pattern: /\bmalindi\b/i, name: 'Malindi Bay', destination: 'Malindi & Watamu', defaultCity: 'Malindi', defaultState: 'Kilifi', defaultCountry: 'Kenya' },

  // ==========================================
  // Caribbean & Central America Gems
  // ==========================================
  { pattern: /\bfisherman'?s?\s+huts\b/i, name: 'Fisherman\'s Huts', destination: 'Aruba', defaultCity: 'Noord', defaultState: 'Aruba', defaultCountry: 'Aruba' },
  { pattern: /\bboca\s+grandi\b/i, name: 'Boca Grandi', destination: 'Aruba', defaultCity: 'San Nicolas', defaultState: 'Aruba', defaultCountry: 'Aruba' },
  { pattern: /\baruba\b/i, name: 'Palm Beach', destination: 'Aruba', defaultCity: 'Oranjestad', defaultState: 'Aruba', defaultCountry: 'Aruba' },
  { pattern: /\b(?:lac\s+bay|atlantis\s+beach|bonaire)\b/i, name: 'Lac Bay (Atlantis)', destination: 'Bonaire', defaultCity: 'Kralendijk', defaultState: 'Bonaire', defaultCountry: 'Bonaire' },
  { pattern: /\b(?:sint\s+joris|curacao|cura[cç]ao)\b/i, name: 'Sint Joris Bay', destination: 'Curaçao', defaultCity: 'Willemstad', defaultState: 'Curaçao', defaultCountry: 'Curaçao' },
  { pattern: /\b(?:silver\s+sands|barbados)\b/i, name: 'Silver Sands', destination: 'Barbados', defaultCity: 'Oistins', defaultState: 'Christ Church', defaultCountry: 'Barbados' },
  { pattern: /\b(?:bahia\s+salinas|copal)\b/i, name: 'Bahia Salinas', destination: 'Costa Rica', defaultCity: 'La Cruz', defaultState: 'Guanacaste', defaultCountry: 'Costa Rica' },
  { pattern: /\b(?:arenal|lake\s+arenal)\b/i, name: 'Lake Arenal', destination: 'Costa Rica', defaultCity: 'Tilarán', defaultState: 'Guanacaste', defaultCountry: 'Costa Rica' },
  { pattern: /\b(?:punta\s+chame|chame)\b/i, name: 'Punta Chame', destination: 'Panama', defaultCity: 'Chame', defaultState: 'Panamá Oeste', defaultCountry: 'Panama' },

  // ==========================================
  // USA & Australia (🇺🇸 🇦🇺)
  // ==========================================
  { pattern: /\b(?:hatteras|cape\s+hatteras|outer\s+banks|rodanthe|waves|salvo)\b/i, name: 'Cape Hatteras (Outer Banks)', destination: 'Outer Banks', defaultCity: 'Waves', defaultState: 'NC', defaultCountry: 'USA' },
  { pattern: /\b(?:crandon|biscayne|miami\s+kite)\b/i, name: 'Crandon Park (Miami)', destination: 'Florida', defaultCity: 'Key Biscayne', defaultState: 'FL', defaultCountry: 'USA' },
  { pattern: /\bkey\s+west\b/i, name: 'Key West', destination: 'Florida', defaultCity: 'Key West', defaultState: 'FL', defaultCountry: 'USA' },
  { pattern: /\b(?:south\s+padre|padre\s+island|spi)\b/i, name: 'South Padre Island', destination: 'Texas Gulf', defaultCity: 'South Padre Island', defaultState: 'TX', defaultCountry: 'USA' },
  { pattern: /\bcorpus\s+christi\b/i, name: 'Corpus Christi', destination: 'Texas Gulf', defaultCity: 'Corpus Christi', defaultState: 'TX', defaultCountry: 'USA' },
  { pattern: /\b(?:hood\s+river|columbia\s+gorge)\b/i, name: 'Hood River (The Gorge)', destination: 'Columbia River Gorge', defaultCity: 'Hood River', defaultState: 'OR', defaultCountry: 'USA' },
  { pattern: /\b(?:safety\s+bay|woodman\s+point|perth)\b/i, name: 'Safety Bay (Perth)', destination: 'Perth & WA', defaultCity: 'Perth', defaultState: 'WA', defaultCountry: 'Australia' },
  { pattern: /\bgeraldton\b/i, name: 'Geraldton', destination: 'Perth & WA', defaultCity: 'Geraldton', defaultState: 'WA', defaultCountry: 'Australia' },
  { pattern: /\bexmouth\b/i, name: 'Exmouth', destination: 'Perth & WA', defaultCity: 'Exmouth', defaultState: 'WA', defaultCountry: 'Australia' },
  { pattern: /\b(?:gold\s+coast|brisbane|noosa)\b/i, name: 'Gold Coast & Brisbane', destination: 'Queensland', defaultCity: 'Gold Coast', defaultState: 'QLD', defaultCountry: 'Australia' },
  { pattern: /\b(?:st\s+kilda|melbourne|brighton)\b/i, name: 'St Kilda (Melbourne)', destination: 'Victoria', defaultCity: 'Melbourne', defaultState: 'VIC', defaultCountry: 'Australia' },
  { pattern: /\b(?:botany\s+bay|dolls\s+point|sydney)\b/i, name: 'Botany Bay (Sydney)', destination: 'New South Wales', defaultCity: 'Sydney', defaultState: 'NSW', defaultCountry: 'Australia' },

  // ==========================================
  // Greece — Premier Aegean & Ionian Kite Destinations (🇬🇷)
  // ==========================================
  { pattern: /\b(?:prasonisi|prassonissi)\b/i, name: 'Prasonisi', destination: 'Rhodes', defaultCity: 'Rhodes', defaultState: 'Dodecanese', defaultCountry: 'Greece' },
  { pattern: /\b(?:theologos|kremasti|ialyssos)\b/i, name: 'Theologos', destination: 'Rhodes', defaultCity: 'Rhodes', defaultState: 'Dodecanese', defaultCountry: 'Greece' },
  { pattern: /\brhodes\b/i, name: 'Rhodes Coast', destination: 'Rhodes', defaultCity: 'Rhodes', defaultState: 'Dodecanese', defaultCountry: 'Greece' },
  { pattern: /\b(?:paros|pounta|pounda|santa\s+maria)\b/i, name: 'Pounda Beach', destination: 'Paros', defaultCity: 'Paros', defaultState: 'Cyclades', defaultCountry: 'Greece' },
  { pattern: /\b(?:naxos|mikri\s+vigla|glyfada)\b/i, name: 'Mikri Vigla', destination: 'Naxos', defaultCity: 'Naxos', defaultState: 'Cyclades', defaultCountry: 'Greece' },
  { pattern: /\b(?:mykonos|korfos|ftelia)\b/i, name: 'Korfos Bay', destination: 'Mykonos', defaultCity: 'Mykonos', defaultState: 'Cyclades', defaultCountry: 'Greece' },
  { pattern: /\b(?:santorini|monolithos)\b/i, name: 'Monolithos', destination: 'Santorini', defaultCity: 'Santorini', defaultState: 'Cyclades', defaultCountry: 'Greece' },
  { pattern: /\b(?:marmari\s+kos|mastichari|kohilari)\b/i, name: 'Marmari & Kohilari', destination: 'Kos', defaultCity: 'Kos', defaultState: 'Dodecanese', defaultCountry: 'Greece' },
  { pattern: /\bkos\b/i, name: 'Kos Island', destination: 'Kos', defaultCity: 'Kos', defaultState: 'Dodecanese', defaultCountry: 'Greece' },
  { pattern: /\b(?:karpathos|afiartis)\b/i, name: 'Afiartis', destination: 'Karpathos', defaultCity: 'Karpathos', defaultState: 'Dodecanese', defaultCountry: 'Greece' },
  { pattern: /\b(?:lefkada|agios\s+ioannis|milos\s+beach|vassiliki)\b/i, name: 'Agios Ioannis', destination: 'Lefkada', defaultCity: 'Lefkada', defaultState: 'Ionian Islands', defaultCountry: 'Greece' },
  { pattern: /\b(?:corfu|kerkyra|chalikounas|issos)\b/i, name: 'Chalikounas', destination: 'Corfu', defaultCity: 'Corfu', defaultState: 'Ionian Islands', defaultCountry: 'Greece' },
  { pattern: /\b(?:elafonisi|falassarna)\b/i, name: 'Elafonisi', destination: 'Crete', defaultCity: 'Chania', defaultState: 'Crete', defaultCountry: 'Greece' },
  { pattern: /\b(?:kouremenos|palekastro)\b/i, name: 'Palekastro', destination: 'Crete', defaultCity: 'Sitia', defaultState: 'Crete', defaultCountry: 'Greece' },
  { pattern: /\b(?:ammoudara|heraklion)\b/i, name: 'Heraklion', destination: 'Crete', defaultCity: 'Heraklion', defaultState: 'Crete', defaultCountry: 'Greece' },
  { pattern: /\b(?:limnos|lemnos|keros)\b/i, name: 'Keros Bay', destination: 'Limnos', defaultCity: 'Limnos', defaultState: 'North Aegean', defaultCountry: 'Greece' },
  { pattern: /\b(?:evia|lefkandi|marmari\s+evia)\b/i, name: 'Lefkandi', destination: 'Evia', defaultCity: 'Chalkida', defaultState: 'Central Greece', defaultCountry: 'Greece' },
  { pattern: /\b(?:drepano|cape\s+drepano|patras)\b/i, name: 'Cape Drepano', destination: 'Patras', defaultCity: 'Patras', defaultState: 'Western Greece', defaultCountry: 'Greece' },
  { pattern: /\b(?:loutsa|artemida)\b/i, name: 'Loutsa', destination: 'Athens Coast', defaultCity: 'Artemida', defaultState: 'Attica', defaultCountry: 'Greece' },
  { pattern: /\belafonisos\b/i, name: 'Elafonisos', destination: 'Peloponnese', defaultCity: 'Elafonisos', defaultState: 'Peloponnese', defaultCountry: 'Greece' },
  { pattern: /\b(?:schinias|marathon)\b/i, name: 'Schinias', destination: 'Athens Coast', defaultCity: 'Marathon', defaultState: 'Attica', defaultCountry: 'Greece' },
  { pattern: /\banavyssos\b/i, name: 'Anavyssos', destination: 'Athens Coast', defaultCity: 'Anavyssos', defaultState: 'Attica', defaultCountry: 'Greece' },

  // ==========================================
  // Spain — Tarifa, Canaries, Balearics & Med (🇪🇸)
  // ==========================================
  { pattern: /\b(?:valdevaqueros|punta\s+paloma)\b/i, name: 'Valdevaqueros', destination: 'Tarifa', defaultCity: 'Tarifa', defaultState: 'Andalusia', defaultCountry: 'Spain' },
  { pattern: /\blos\s+lances\b/i, name: 'Los Lances', destination: 'Tarifa', defaultCity: 'Tarifa', defaultState: 'Andalusia', defaultCountry: 'Spain' },
  { pattern: /\btarifa\b/i, name: 'Tarifa Town', destination: 'Tarifa', defaultCity: 'Tarifa', defaultState: 'Andalusia', defaultCountry: 'Spain' },
  { pattern: /\bsotavento\b/i, name: 'Sotavento Lagoon', destination: 'Fuerteventura', defaultCity: 'Pájara', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:corralejo|flag\s+beach)\b/i, name: 'Flag Beach & Corralejo', destination: 'Fuerteventura', defaultCity: 'La Oliva', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\bmatas\s+bay\b/i, name: 'Matas Bay', destination: 'Fuerteventura', defaultCity: 'Pájara', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\bcotillo\b/i, name: 'El Cotillo', destination: 'Fuerteventura', defaultCity: 'La Oliva', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\bfuerteventura\b/i, name: 'Fuerteventura Island', destination: 'Fuerteventura', defaultCity: 'Pájara', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:el\s+m[eé]dano|medano|tenerife)\b/i, name: 'El Médano', destination: 'Tenerife', defaultCity: 'Granadilla de Abona', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:famara|lanzarote)\b/i, name: 'Famara', destination: 'Lanzarote', defaultCity: 'Teguise', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:pozo\s+izquierdo|gran\s+canaria|vargas)\b/i, name: 'Pozo Izquierdo', destination: 'Gran Canaria', defaultCity: 'Santa Lucía', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:sant\s+pere\s+pescador|empuriabrava|roses|costa\s+brava)\b/i, name: 'Sant Pere Pescador', destination: 'Costa Brava', defaultCity: 'Sant Pere Pescador', defaultState: 'Catalonia', defaultCountry: 'Spain' },
  { pattern: /\b(?:mar\s+menor|la\s+manga|los\s+alc[aá]zares)\b/i, name: 'La Manga', destination: 'Mar Menor', defaultCity: 'San Javier', defaultState: 'Murcia', defaultCountry: 'Spain' },
  { pattern: /\b(?:pollen[cç]a|alcudia|sa\s+marina|mallorca)\b/i, name: 'Pollença Bay', destination: 'Mallorca', defaultCity: 'Pollença', defaultState: 'Balearic Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:ibiza|eivissa|cala\s+martina)\b/i, name: 'Cala Martina', destination: 'Ibiza', defaultCity: 'Santa Eulària', defaultState: 'Balearic Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:menorca|fornells|son\s+bou)\b/i, name: 'Fornells', destination: 'Menorca', defaultCity: 'Es Mercadal', defaultState: 'Balearic Islands', defaultCountry: 'Spain' },
  { pattern: /\bformentera\b/i, name: 'Formentera', destination: 'Formentera', defaultCity: 'Sant Francesc Xavier', defaultState: 'Balearic Islands', defaultCountry: 'Spain' },
  { pattern: /\bla\s+palma\b/i, name: 'La Palma', destination: 'La Palma', defaultCity: 'Santa Cruz de La Palma', defaultState: 'Canary Islands', defaultCountry: 'Spain' },
  { pattern: /\b(?:denia|oliva)\b/i, name: 'Denia & Oliva', destination: 'Costa Blanca', defaultCity: 'Denia', defaultState: 'Valencia', defaultCountry: 'Spain' },

  // ==========================================
  // France — Leucate, Hyères & Atlantic (🇫🇷)
  // ==========================================
  { pattern: /\b(?:leucate|la\s+franqui)\b/i, name: 'La Franqui', destination: 'Leucate', defaultCity: 'Leucate', defaultState: 'Occitanie', defaultCountry: 'France' },
  { pattern: /\b(?:hy[eè]res|almanarre)\b/i, name: 'L\'Almanarre', destination: 'Hyères', defaultCity: 'Hyères', defaultState: 'Provence', defaultCountry: 'France' },
  { pattern: /\b(?:beauduc|camargue)\b/i, name: 'Beauduc', destination: 'Camargue', defaultCity: 'Arles', defaultState: 'Provence', defaultCountry: 'France' },
  { pattern: /\b(?:gruissan|saint[- ]cyprien)\b/i, name: 'Gruissan', destination: 'Gruissan', defaultCity: 'Gruissan', defaultState: 'Occitanie', defaultCountry: 'France' },
  { pattern: /\b(?:quiberon|carnac|presqu['’]île\s+de\s+quiberon)\b/i, name: 'Presqu\'île de Quiberon', destination: 'Quiberon', defaultCity: 'Quiberon', defaultState: 'Brittany', defaultCountry: 'France' },
  { pattern: /\b(?:arcachon|biscarrosse|dune\s+du\s+pilat)\b/i, name: 'Biscarrosse', destination: 'Biscarrosse', defaultCity: 'Biscarrosse', defaultState: 'Nouvelle-Aquitaine', defaultCountry: 'France' },
  { pattern: /\bla\s+tranche[- ]sur[- ]mer\b/i, name: 'La Tranche-sur-Mer', destination: 'Vendée', defaultCity: 'La Tranche-sur-Mer', defaultState: 'Pays de la Loire', defaultCountry: 'France' },

  // ==========================================
  // Italy — Sicily, Sardinia, Puglia & Lakes (🇮🇹)
  // ==========================================
  { pattern: /\b(?:lo\s+stagnone|stagnone|marsala)\b/i, name: 'Lo Stagnone Lagoon', destination: 'Sicily', defaultCity: 'Marsala', defaultState: 'Sicily', defaultCountry: 'Italy' },
  { pattern: /\b(?:puzziteddu|capo\s+granitola)\b/i, name: 'Puzziteddu', destination: 'Sicily', defaultCity: 'Campobello di Mazara', defaultState: 'Sicily', defaultCountry: 'Italy' },
  { pattern: /\bporto\s+pollo\b/i, name: 'Porto Pollo', destination: 'Sardinia', defaultCity: 'Palau', defaultState: 'Sardinia', defaultCountry: 'Italy' },
  { pattern: /\bpunta\s+trettu\b/i, name: 'Punta Trettu', destination: 'Sardinia', defaultCity: 'San Giovanni Suergiu', defaultState: 'Sardinia', defaultCountry: 'Italy' },
  { pattern: /\b(?:chia|porto\s+pino)\b/i, name: 'Chia & Porto Pino', destination: 'Sardinia', defaultCity: 'Domus de Maria', defaultState: 'Sardinia', defaultCountry: 'Italy' },
  { pattern: /\b(?:gizzeria|hang\s+loose\s+beach)\b/i, name: 'Gizzeria Lido', destination: 'Calabria', defaultCity: 'Gizzeria', defaultState: 'Calabria', defaultCountry: 'Italy' },
  { pattern: /\b(?:garda|malcesine|navene|campione)\b/i, name: 'Lake Garda', destination: 'Lake Garda', defaultCity: 'Malcesine', defaultState: 'Veneto / Lombardy', defaultCountry: 'Italy' },
  { pattern: /\b(?:como|colico|dervio|valmadrera)\b/i, name: 'Lake Como', destination: 'Lake Como', defaultCity: 'Colico', defaultState: 'Lombardy', defaultCountry: 'Italy' },
  { pattern: /\b(?:punta\s+prosciutto|torre\s+san\s+giovanni|salento)\b/i, name: 'Punta Prosciutto (Salento)', destination: 'Puglia', defaultCity: 'Porto Cesareo', defaultState: 'Puglia', defaultCountry: 'Italy' },

  // ==========================================
  // Egypt — Red Sea Flat-Water Meccas (🇪🇬)
  // ==========================================
  { pattern: /\b(?:el\s+gouna|gouna)\b/i, name: 'El Gouna Lagoon', destination: 'El Gouna', defaultCity: 'El Gouna', defaultState: 'Red Sea', defaultCountry: 'Egypt' },
  { pattern: /\bsoma\s+bay\b/i, name: 'Soma Bay', destination: 'Soma Bay', defaultCity: 'Safaga', defaultState: 'Red Sea', defaultCountry: 'Egypt' },
  { pattern: /\bsafaga\b/i, name: 'Safaga Bay', destination: 'Safaga', defaultCity: 'Safaga', defaultState: 'Red Sea', defaultCountry: 'Egypt' },
  { pattern: /\bdahab\b/i, name: 'Dahab Blue Lagoon', destination: 'Dahab', defaultCity: 'Dahab', defaultState: 'South Sinai', defaultCountry: 'Egypt' },
  { pattern: /\bras\s+sudr\b/i, name: 'Ras Sudr', destination: 'Ras Sudr', defaultCity: 'Ras Sudr', defaultState: 'South Sinai', defaultCountry: 'Egypt' },
  { pattern: /\bhurghada\b/i, name: 'Hurghada Coast', destination: 'Hurghada', defaultCity: 'Hurghada', defaultState: 'Red Sea', defaultCountry: 'Egypt' },
  { pattern: /\bmarsa\s+alam\b/i, name: 'Marsa Alam', destination: 'Marsa Alam', defaultCity: 'Marsa Alam', defaultState: 'Red Sea', defaultCountry: 'Egypt' },

  // ==========================================
  // South Africa — Cape of Storms & Lagoons (🇿🇦)
  // ==========================================
  { pattern: /\b(?:bloubergstrand|blouberg|big\s+bay|delfin\s+beach|sunset\s+beach|cape\s+town)\b/i, name: 'Bloubergstrand & Big Bay', destination: 'Cape Town', defaultCity: 'Cape Town', defaultState: 'Western Cape', defaultCountry: 'South Africa' },
  { pattern: /\blangebaan\b/i, name: 'Langebaan Lagoon', destination: 'Langebaan', defaultCity: 'Langebaan', defaultState: 'Western Cape', defaultCountry: 'South Africa' },
  { pattern: /\bmuizenberg\b/i, name: 'Muizenberg', destination: 'Cape Town', defaultCity: 'Cape Town', defaultState: 'Western Cape', defaultCountry: 'South Africa' },

  // ==========================================
  // Southeast Asia (🇻🇳 🇵🇭 🇹🇭 🇱🇰)
  // ==========================================
  { pattern: /\bmui\s+ne\b/i, name: 'Mui Ne Bay', destination: 'Mui Ne', defaultCity: 'Phan Thiet', defaultState: 'Bình Thuận', defaultCountry: 'Vietnam' },
  { pattern: /\bphan\s+rang\b/i, name: 'My Hoa Lagoon', destination: 'Phan Rang', defaultCity: 'Phan Rang', defaultState: 'Ninh Thuận', defaultCountry: 'Vietnam' },
  { pattern: /\b(?:boracay|bulabog)\b/i, name: 'Bulabog Beach', destination: 'Boracay', defaultCity: 'Malay', defaultState: 'Aklan', defaultCountry: 'Philippines' },
  { pattern: /\b(?:hua\s+hin|pranburi)\b/i, name: 'Hua Hin & Pranburi', destination: 'Hua Hin', defaultCity: 'Hua Hin', defaultState: 'Prachuap Khiri Khan', defaultCountry: 'Thailand' },
  { pattern: /\bkoh\s+phangan\b/i, name: 'Koh Phangan', destination: 'Koh Phangan', defaultCity: 'Koh Phangan', defaultState: 'Surat Thani', defaultCountry: 'Thailand' },
  { pattern: /\bkappalady\b/i, name: 'Kappalady Lagoon', destination: 'Kalpitiya', defaultCity: 'Kalpitiya', defaultState: 'North Western Province', defaultCountry: 'Sri Lanka' },
  { pattern: /\bkalpitiya\b/i, name: 'Kalpitiya Lagoon', destination: 'Kalpitiya', defaultCity: 'Kalpitiya', defaultState: 'North Western Province', defaultCountry: 'Sri Lanka' },

  // ==========================================
  // South America Gems (🇵🇪 🇻🇪)
  // ==========================================
  { pattern: /\bpacasmayo\b/i, name: 'Pacasmayo', destination: 'Pacasmayo', defaultCity: 'Pacasmayo', defaultState: 'La Libertad', defaultCountry: 'Peru' },
  { pattern: /\bparacas\b/i, name: 'Paracas Bay', destination: 'Paracas', defaultCity: 'Paracas', defaultState: 'Ica', defaultCountry: 'Peru' },
  { pattern: /\b(?:m[aá]ncora|lobitos)\b/i, name: 'Máncora & Lobitos', destination: 'Máncora', defaultCity: 'Máncora', defaultState: 'Piura', defaultCountry: 'Peru' },
  { pattern: /\b(?:el\s+yaque|margarita)\b/i, name: 'El Yaque', destination: 'Isla Margarita', defaultCity: 'El Yaque', defaultState: 'Nueva Esparta', defaultCountry: 'Venezuela' },
  { pattern: /\blos\s+roques\b/i, name: 'Los Roques', destination: 'Los Roques', defaultCity: 'Gran Roque', defaultState: 'Federal Dependencies', defaultCountry: 'Venezuela' },
  { pattern: /\bad[ií]cora\b/i, name: 'Adícora', destination: 'Paraguaná', defaultCity: 'Adícora', defaultState: 'Falcón', defaultCountry: 'Venezuela' },
]

export function detectSpotAndDestination ( candidateTexts: string[] ): {
  spot: string | null
  destination: string | null
  beach: string | null
  city: string | null
  state: string
  country: string
} {
  const combined = candidateTexts.filter( Boolean ).join( ' ' )
  for ( const item of KNOWN_SPOTS ) {
    if ( item.pattern.test( combined ) ) {
      return {
        spot: item.name,
        destination: item.destination,
        beach: `${ item.destination } (${ item.name })`,
        city: item.defaultCity || null,
        state: item.defaultState || 'CE',
        country: item.defaultCountry || 'Brazil',
      }
    }
  }
  return { spot: null, destination: null, beach: null, city: null, state: 'CE', country: 'Brazil' }
}

function extractInstagram ( ...candidates: unknown[] ): string | null {
  for ( const c of candidates ) {
    if ( !c || typeof c !== 'string' ) continue
    const trimmed = c.trim()
    const igMatch = trimmed.match( /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i )
    if ( igMatch && igMatch[ 1 ] ) {
      const handle = igMatch[ 1 ].split( /[/?#]/ )[ 0 ]
      if ( handle && !['p', 'reel', 'stories', 'explore'].includes( handle.toLowerCase() ) ) {
        return `@${handle}`
      }
    }
    if ( trimmed.startsWith( '@' ) && trimmed.length > 1 ) {
      return trimmed
    }
  }
  return null
}

function normaliseKiteSupplier ( item: Record<string, unknown> ) {
  const name = text( item.name, item.Name )
  if ( !name ) return null

  const phone = text( item.phone, item.Phone, item.telephone ) || null
  const email = text( item.email, item.Email ) || null
  const rawWebsite = text( item.website, item.Website ) || null
  const address = text( item.address, item.Address ) || null
  const googleMapsUrl = text( item.googleMapsUrl, item.url, item[ 'Google Maps URL' ] ) || null
  const tag = text( item.tag, item.Tag, item.query, item.searchQuery, item.sourceQuery ) || null
  const category = text( item.category, item.Category ) || null
  const hours = text( item.hours, item.Hours ) || null

  const instagram = extractInstagram( item.instagram, item.Instagram, rawWebsite )
  const website = rawWebsite

  const explicitBeach = text( item.beach, item.Beach )
  const explicitDestination = text( item.destination, item.Destination )
  const explicitSpot = text( item.spot, item.Spot )
  const explicitCity = text( item.city, item.City )
  const detected = detectSpotAndDestination( [ explicitSpot, explicitDestination, explicitBeach, tag || '', address || '', name ] )

  const destination = explicitDestination || detected.destination || null
  const spot = explicitSpot || detected.spot || explicitBeach || null
  const beach = explicitBeach || ( destination && spot ? `${ destination } (${ spot })` : spot || null )
  const city = explicitCity || detected.city || null

  return {
    name,
    beach,
    destination,
    spot,
    city,
    state: text( item.state, item.State ) || detected.state || 'CE',
    country: text( item.country, item.Country ) || detected.country || 'Brazil',
    category,
    phone,
    email,
    website,
    instagram,
    address,
    rating: ( () => {
      const rawStr = item.rating !== null && item.rating !== undefined ? String( item.rating ).trim() : ''
      let r = numeric( item.rating, parseFloat )
      if ( r !== null && r > 5.0 ) {
        const decimalMatch = rawStr.match( /([1-5]\.\d)$/ )
        if ( decimalMatch ) {
          r = parseFloat( decimalMatch[ 1 ] )
        } else {
          const intMatch = String( r ).match( /([1-5])$/ )
          if ( intMatch ) {
            r = parseFloat( intMatch[ 1 ] )
          } else {
            r = 5.0
          }
        }
      }
      return r
    } )(),
    reviews: numeric( item.reviews, raw => parseInt( raw, 10 ) ),
    googleMapsUrl,
    hours,
    tag,
    notes: text( item.notes, item.Notes ) || null,
  }
}

export async function OPTIONS ( request: NextRequest ) {
  return NextResponse.json( {}, { headers: corsFor( request ) } )
}

export async function GET ( request: NextRequest ) {
  try {
    const { searchParams } = new URL( request.url )
    const page = parseInt( searchParams.get( 'page' ) || '1', 10 )
    const limit = parseInt( searchParams.get( 'limit' ) || '50', 10 )
    const contactedFilter = searchParams.get( 'contacted' )
    const beachFilter = searchParams.get( 'beach' )
    const destinationFilter = searchParams.get( 'destination' )
    const spotFilter = searchParams.get( 'spot' )
    const search = searchParams.get( 'search' ) || ''
    const hasEmail = searchParams.get( 'hasEmail' )
    const hasPhone = searchParams.get( 'hasPhone' )
    const hasWebsite = searchParams.get( 'hasWebsite' )
    const hasInstagram = searchParams.get( 'hasInstagram' )
    const nameFilter = searchParams.get( 'name' )
    const phoneFilter = searchParams.get( 'phone' )
    const websiteFilter = searchParams.get( 'website' )
    const categoryFilter = searchParams.get( 'category' )
    const addressFilter = searchParams.get( 'address' )
    const countryFilter = searchParams.get( 'country' )

    const skip = ( page - 1 ) * limit
    const where: Prisma.KiteBeachSupplierWhereInput = {}

    if ( countryFilter && countryFilter !== 'all' ) {
      where.country = countryFilter
    }

    if ( contactedFilter === 'true' ) {
      where.contacted = true
    } else if ( contactedFilter === 'false' ) {
      where.contacted = false
    }

    if ( destinationFilter && destinationFilter !== 'all' ) {
      where.destination = destinationFilter
    }

    if ( spotFilter && spotFilter !== 'all' ) {
      where.spot = spotFilter
    }

    if ( beachFilter === '__untagged__' ) {
      where.beach = null
    } else if ( beachFilter && beachFilter !== 'all' ) {
      where.beach = beachFilter
    }

    if ( hasEmail === 'true' ) {
      where.email = { not: null }
    } else if ( hasEmail === 'false' ) {
      where.email = null
    }

    if ( hasPhone === 'true' ) {
      where.phone = { not: null }
    } else if ( hasPhone === 'false' ) {
      where.phone = null
    }

    if ( hasWebsite === 'true' ) {
      where.website = { not: null }
    } else if ( hasWebsite === 'false' ) {
      where.website = null
    }

    if ( hasInstagram === 'true' ) {
      where.instagram = { not: null }
    } else if ( hasInstagram === 'false' ) {
      where.instagram = null
    }

    if ( nameFilter ) {
      where.name = { contains: nameFilter }
    }

    if ( phoneFilter ) {
      where.phone = { contains: phoneFilter }
    }

    if ( websiteFilter ) {
      where.website = { contains: websiteFilter }
    }

    if ( categoryFilter ) {
      where.category = { contains: categoryFilter }
    }

    if ( addressFilter ) {
      where.address = { contains: addressFilter }
    }

    if ( search ) {
      const searchTerms = search.trim().split( /\s+/ ).filter( Boolean )
      where.AND = searchTerms.map( term => ( {
        OR: [
          { name: { contains: term } },
          { destination: { contains: term } },
          { spot: { contains: term } },
          { beach: { contains: term } },
          { city: { contains: term } },
          { category: { contains: term } },
          { phone: { contains: term } },
          { email: { contains: term } },
          { website: { contains: term } },
          { instagram: { contains: term } },
          { address: { contains: term } },
          { tag: { contains: term } },
          { notes: { contains: term } },
        ],
      } ) )
    }

    const [ suppliers, total, contactedCount, destinationGroups, spotGroups, beachGroups ] = await Promise.all( [
      prisma.kiteBeachSupplier.findMany( {
        where,
        skip,
        take: limit,
        orderBy: [
          { rating: 'desc' },
          { reviews: 'desc' },
          { name: 'asc' },
        ],
      } ),
      prisma.kiteBeachSupplier.count( { where } ),
      prisma.kiteBeachSupplier.count( { where: { ...where, contacted: true } } ),
      prisma.kiteBeachSupplier.groupBy( {
        by: [ 'destination' ],
        _count: { id: true },
        where: { destination: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      } ),
      prisma.kiteBeachSupplier.groupBy( {
        by: [ 'spot' ],
        _count: { id: true },
        where: { spot: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      } ),
      prisma.kiteBeachSupplier.groupBy( {
        by: [ 'beach' ],
        _count: { id: true },
        where: { beach: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      } ),
    ] )

    const destinations = destinationGroups.map( dg => ( {
      name: dg.destination as string,
      count: dg._count.id,
    } ) )

    const spots = spotGroups.map( sg => ( {
      name: sg.spot as string,
      count: sg._count.id,
    } ) )

    const beaches = beachGroups.map( bg => ( {
      name: bg.beach as string,
      count: bg._count.id,
    } ) )

    const pendingCount = total - contactedCount
    const totalPages = Math.ceil( total / limit ) || 1

    return NextResponse.json(
      {
        suppliers,
        destinations,
        spots,
        beaches,
        total,
        contactedCount,
        pendingCount,
        page,
        totalPages,
        stats: {
          total,
          contacted: contactedCount,
          pending: pendingCount,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Failed to fetch kite beach suppliers:', error )
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function POST ( request: NextRequest ) {
  try {
    const body = await request.json()
    const rawList: Record<string, unknown>[] = []

    if ( Array.isArray( body ) ) {
      rawList.push( ...body )
    } else if ( Array.isArray( body.suppliers ) ) {
      rawList.push( ...body.suppliers )
    } else if ( Array.isArray( body.contacts ) ) {
      rawList.push( ...body.contacts )
    } else if ( body && typeof body === 'object' ) {
      rawList.push( body as Record<string, unknown> )
    }

    if ( rawList.length === 0 ) {
      return NextResponse.json(
        { error: 'No supplier records provided' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    if ( rawList.length > MAX_BATCH_SIZE ) {
      return NextResponse.json(
        { error: `Batch too large: ${ rawList.length }, maximum is ${ MAX_BATCH_SIZE }` },
        { status: 413, headers: corsFor( request ) }
      )
    }

    const dedupMap = new Map<string, NonNullable<ReturnType<typeof normaliseKiteSupplier>>>()
    let skipped = 0

    for ( const item of rawList ) {
      const normalised = normaliseKiteSupplier( item )
      if ( !normalised ) {
        skipped++
        continue
      }
      const key = normalised.googleMapsUrl
        ? `maps:${normalised.googleMapsUrl}`
        : normalised.phone
        ? `phone:${normalised.phone}`
        : `name:${normalised.name.toLowerCase()}:${( normalised.beach || '' ).toLowerCase()}`
      dedupMap.set( key, normalised )
    }

    const pending = [ ...dedupMap.values() ]
    if ( pending.length === 0 ) {
      return NextResponse.json(
        {
          success: true,
          summary: { totalProcessed: 0, newSuppliers: 0, updatedSuppliers: 0, skipped },
        },
        { headers: corsFor( request ) }
      )
    }

    const mapsUrls = pending.map( s => s.googleMapsUrl ).filter( Boolean ) as string[]
    const phones = pending.map( s => s.phone ).filter( Boolean ) as string[]
    const names = pending.map( s => s.name ).filter( Boolean ) as string[]

    const orConditions: Prisma.KiteBeachSupplierWhereInput[] = []
    if ( mapsUrls.length > 0 ) orConditions.push( { googleMapsUrl: { in: mapsUrls } } )
    if ( phones.length > 0 ) orConditions.push( { phone: { in: phones } } )
    if ( names.length > 0 ) orConditions.push( { name: { in: names } } )

    const existing = orConditions.length > 0
      ? await prisma.kiteBeachSupplier.findMany( { where: { OR: orConditions } } )
      : []

    let updatedSuppliers = 0
    let newSuppliers = 0

    await prisma.$transaction( async ( tx ) => {
      for ( const supplier of pending ) {
        const match = existing.find( ex =>
          ( supplier.googleMapsUrl && ex.googleMapsUrl === supplier.googleMapsUrl ) ||
          ( supplier.phone && ex.phone === supplier.phone ) ||
          ( ex.name.toLowerCase() === supplier.name.toLowerCase() && ( !supplier.beach || ex.beach === supplier.beach ) )
        )

        if ( match ) {
          const updated = await tx.kiteBeachSupplier.update( {
            where: { id: match.id },
            data: {
              ...supplier,
              phone: supplier.phone || match.phone,
              website: supplier.website || match.website,
              email: supplier.email || match.email,
              address: supplier.address || match.address,
              hours: supplier.hours || match.hours,
              contacted: match.contacted || false,
              notes: match.notes || supplier.notes,
            },
          } )
          Object.assign( match, updated )
          updatedSuppliers++
        } else {
          const created = await tx.kiteBeachSupplier.create( {
            data: supplier,
          } )
          existing.push( created )
          newSuppliers++
        }
      }
    } )

    const totalCount = await prisma.kiteBeachSupplier.count()
    broadcastCrmEvent( {
      type: 'KITE_BEACH_UPDATED',
      total: totalCount,
      timestamp: Date.now(),
    } )

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalProcessed: pending.length,
          newSuppliers,
          updatedSuppliers,
          skipped,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Failed to upsert kite beach suppliers:', error )
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function PUT ( request: NextRequest ) {
  try {
    const body = await request.json()
    const { id, contacted, notes, phone, email, website, instagram, beach, destination, spot, category, address, hours } = body

    if ( !id ) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    const updateData: Prisma.KiteBeachSupplierUpdateInput = {}

    if ( contacted !== undefined ) {
      updateData.contacted = Boolean( contacted )
      updateData.contactedAt = contacted ? new Date() : null
    }

    if ( notes !== undefined ) updateData.notes = notes ? String( notes ) : null
    if ( phone !== undefined ) updateData.phone = phone ? String( phone ) : null
    if ( email !== undefined ) updateData.email = email ? String( email ) : null
    if ( website !== undefined ) updateData.website = website ? String( website ) : null
    if ( instagram !== undefined ) updateData.instagram = instagram ? String( instagram ) : null
    if ( beach !== undefined ) updateData.beach = beach ? String( beach ) : null
    if ( destination !== undefined ) updateData.destination = destination ? String( destination ) : null
    if ( spot !== undefined ) updateData.spot = spot ? String( spot ) : null
    if ( category !== undefined ) updateData.category = category ? String( category ) : null
    if ( address !== undefined ) updateData.address = address ? String( address ) : null
    if ( hours !== undefined ) updateData.hours = hours ? String( hours ) : null

    const updated = await prisma.kiteBeachSupplier.update( {
      where: { id },
      data: updateData,
    } )

    const totalCount = await prisma.kiteBeachSupplier.count()
    broadcastCrmEvent( {
      type: 'KITE_BEACH_UPDATED',
      total: totalCount,
      timestamp: Date.now(),
    } )

    return NextResponse.json(
      { success: true, supplier: updated },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Failed to update kite beach supplier:', error )
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function DELETE ( request: NextRequest ) {
  try {
    const { searchParams } = new URL( request.url )
    const id = searchParams.get( 'id' )
    const clearAll = searchParams.get( 'all' ) === 'true'
    const beach = searchParams.get( 'beach' )

    if ( id ) {
      await prisma.kiteBeachSupplier.delete( { where: { id } } )
      broadcastCrmEvent( {
        type: 'KITE_BEACH_DELETED',
        count: 1,
        timestamp: Date.now(),
      } )
      return NextResponse.json( { success: true, deleted: 1 }, { headers: corsFor( request ) } )
    }

    if ( clearAll ) {
      const result = await prisma.kiteBeachSupplier.deleteMany( {} )
      broadcastCrmEvent( {
        type: 'KITE_BEACH_DELETED',
        count: result.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json( { success: true, deleted: result.count }, { headers: corsFor( request ) } )
    }

    if ( beach ) {
      const result = await prisma.kiteBeachSupplier.deleteMany( { where: { beach } } )
      broadcastCrmEvent( {
        type: 'KITE_BEACH_DELETED',
        count: result.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json( { success: true, deleted: result.count }, { headers: corsFor( request ) } )
    }

    return NextResponse.json(
      { error: 'Must provide id, all=true, or beach filter' },
      { status: 400, headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Failed to delete kite beach supplier:', error )
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}
