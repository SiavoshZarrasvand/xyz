// One-time migration & backfill script to populate Country -> Destination -> Spot hierarchy
// for all existing KiteBeachSupplier records in xyz

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Spot definitions matching route.ts
const SPOTS = [
  // Brazil Ceará & Corridor
  { pattern: /\bcau[ií]pe\b/i, name: 'Cauípe Lagoon', destination: 'Cumbuco', country: 'Brazil' },
  { pattern: /\bcumbuco\b/i, name: 'Cumbuco Beach', destination: 'Cumbuco', country: 'Brazil' },
  { pattern: /\bta[ií]ba\b/i, name: 'Taíba', destination: 'Taíba', country: 'Brazil' },
  { pattern: /\b(?:paracuru|quebramar)\b/i, name: 'Quebramar', destination: 'Paracuru', country: 'Brazil' },
  { pattern: /\blagoinha\b/i, name: 'Lagoinha', destination: 'Lagoinha', country: 'Brazil' },
  { pattern: /\bguajir[uú]\b/i, name: 'Guajirú', destination: 'Guajirú', country: 'Brazil' },
  { pattern: /\bflecheiras\b/i, name: 'Flecheiras', destination: 'Flecheiras', country: 'Brazil' },
  { pattern: /\bbaleia\b/i, name: 'Baleia', destination: 'Baleia', country: 'Brazil' },
  { pattern: /\b(?:icara[ií]zinho|icara[ií]\s+de\s+amontada)\b/i, name: 'Icaraizinho', destination: 'Icaraizinho', country: 'Brazil' },
  { pattern: /\b(?:ilha\s+do\s+guajir[uú]|ilhadoguajiru)\b/i, name: 'Ilha do Guajirú', destination: 'Ilha do Guajirú', country: 'Brazil' },
  { pattern: /\bpre[aá]\b/i, name: 'Preá Beach', destination: 'Jericoacoara & Preá', country: 'Brazil' },
  { pattern: /\bbarrinha(?:\s+de\s+baixo)?\b/i, name: 'Barrinha', destination: 'Jericoacoara & Preá', country: 'Brazil' },
  { pattern: /\bacara[uú]\b/i, name: 'Acaraú', destination: 'Acaraú', country: 'Brazil' },
  { pattern: /\b(?:jericoacoara|jeri)\b/i, name: 'Jericoacoara', destination: 'Jericoacoara & Preá', country: 'Brazil' },
  { pattern: /\bguri[uú]\b/i, name: 'Guriú Lagoon', destination: 'Jericoacoara & Preá', country: 'Brazil' },
  { pattern: /\btatajuba\b/i, name: 'Tatajuba', destination: 'Tatajuba', country: 'Brazil' },
  { pattern: /\bcamocim\b/i, name: 'Camocim', destination: 'Camocim', country: 'Brazil' },
  { pattern: /\bporto\s+das\s+dunas\b/i, name: 'Porto das Dunas', destination: 'Fortaleza & Aquiraz', country: 'Brazil' },
  { pattern: /\b(?:aquiraz|lagoa\s+do\s+catu)\b/i, name: 'Aquiraz', destination: 'Fortaleza & Aquiraz', country: 'Brazil' },
  { pattern: /\biguape\b/i, name: 'Iguape', destination: 'Fortaleza & Aquiraz', country: 'Brazil' },
  { pattern: /\bbarra\s+nova\b/i, name: 'Barra Nova', destination: 'Barra Nova', country: 'Brazil' },
  { pattern: /\burua[uú]\b/i, name: 'Uruaú Lagoon', destination: 'Uruaú', country: 'Brazil' },
  { pattern: /\bparajuru\b/i, name: 'Parajuru', destination: 'Parajuru', country: 'Brazil' },
  { pattern: /\bpontal\s+de\s+macei[oó]\b/i, name: 'Pontal de Maceió', destination: 'Fortim', country: 'Brazil' },
  { pattern: /\bfortim\b/i, name: 'Fortim', destination: 'Fortim', country: 'Brazil' },
  { pattern: /\bcanoa\s+quebrada\b/i, name: 'Canoa Quebrada', destination: 'Canoa Quebrada', country: 'Brazil' },
  { pattern: /\bmajorl[aâ]ndia\b/i, name: 'Majorlândia', destination: 'Canoa Quebrada', country: 'Brazil' },
  { pattern: /\bquixaba\b/i, name: 'Quixaba', destination: 'Canoa Quebrada', country: 'Brazil' },
  { pattern: /\b(?:icapu[ií]|redonda|peroba|ponta\s+grossa)\b/i, name: 'Icapuí', destination: 'Icapuí', country: 'Brazil' },
  { pattern: /\bfortaleza\b/i, name: 'Fortaleza', destination: 'Fortaleza & Aquiraz', country: 'Brazil' },

  // Piauí, Maranhão & RN
  { pattern: /\bbarra\s+grande\b/i, name: 'Barra Grande', destination: 'Barra Grande (PI)', country: 'Brazil' },
  { pattern: /\bmacap[aá]\b/i, name: 'Macapá', destination: 'Barra Grande (PI)', country: 'Brazil' },
  { pattern: /\batins\b/i, name: 'Atins', destination: 'Lençóis Maranhenses', country: 'Brazil' },
  { pattern: /\bbarreirinhas\b/i, name: 'Barreirinhas', destination: 'Lençóis Maranhenses', country: 'Brazil' },
  { pattern: /\b(?:s[aã]o\s+miguel\s+do\s+gostoso|gostoso)\b/i, name: 'São Miguel do Gostoso', destination: 'São Miguel do Gostoso', country: 'Brazil' },
  { pattern: /\b(?:galinhos|galos)\b/i, name: 'Galinhos', destination: 'Galinhos', country: 'Brazil' },
  { pattern: /\btibau\b/i, name: 'Tibau', destination: 'Tibau', country: 'Brazil' },
  { pattern: /\btouros\b/i, name: 'Touros', destination: 'Touros', country: 'Brazil' },
  { pattern: /\b(?:pipa|tibau\s+do\s+sul)\b/i, name: 'Pipa & Tibau do Sul', destination: 'Pipa & RN South', country: 'Brazil' },
  { pattern: /\b(?:barra\s+do\s+cunha[uú]|cunha[uú])\b/i, name: 'Barra do Cunhaú', destination: 'Pipa & RN South', country: 'Brazil' },
  { pattern: /\bmaracaja[uú]\b/i, name: 'Maracajaú', destination: 'Maracajaú', country: 'Brazil' },

  // Spain
  { pattern: /\b(?:valdevaqueros|punta\s+paloma)\b/i, name: 'Valdevaqueros', destination: 'Tarifa', country: 'Spain' },
  { pattern: /\blos\s+lances\b/i, name: 'Los Lances', destination: 'Tarifa', country: 'Spain' },
  { pattern: /\btarifa\b/i, name: 'Tarifa Town', destination: 'Tarifa', country: 'Spain' },
  { pattern: /\bsotavento\b/i, name: 'Sotavento Lagoon', destination: 'Fuerteventura', country: 'Spain' },
  { pattern: /\b(?:corralejo|flag\s+beach)\b/i, name: 'Flag Beach & Corralejo', destination: 'Fuerteventura', country: 'Spain' },
  { pattern: /\bmatas\s+bay\b/i, name: 'Matas Bay', destination: 'Fuerteventura', country: 'Spain' },
  { pattern: /\bcotillo\b/i, name: 'El Cotillo', destination: 'Fuerteventura', country: 'Spain' },
  { pattern: /\bfuerteventura\b/i, name: 'Fuerteventura Island', destination: 'Fuerteventura', country: 'Spain' },
  { pattern: /\b(?:el\s+m[eé]dano|medano|tenerife)\b/i, name: 'El Médano', destination: 'Tenerife', country: 'Spain' },
  { pattern: /\b(?:famara|lanzarote)\b/i, name: 'Famara', destination: 'Lanzarote', country: 'Spain' },
  { pattern: /\b(?:pozo\s+izquierdo|gran\s+canaria|vargas)\b/i, name: 'Pozo Izquierdo', destination: 'Gran Canaria', country: 'Spain' },
  { pattern: /\b(?:sant\s+pere\s+pescador|empuriabrava|roses|costa\s+brava)\b/i, name: 'Sant Pere Pescador', destination: 'Costa Brava', country: 'Spain' },
  { pattern: /\b(?:mar\s+menor|la\s+manga|los\s+alc[aá]zares)\b/i, name: 'La Manga', destination: 'Mar Menor', country: 'Spain' },
  { pattern: /\b(?:pollen[cç]a|alcudia|sa\s+marina|mallorca)\b/i, name: 'Pollença Bay', destination: 'Mallorca', country: 'Spain' },
  { pattern: /\b(?:ibiza|eivissa|cala\s+martina)\b/i, name: 'Cala Martina', destination: 'Ibiza', country: 'Spain' },
  { pattern: /\b(?:menorca|fornells|son\s+bou)\b/i, name: 'Fornells', destination: 'Menorca', country: 'Spain' },
  { pattern: /\bformentera\b/i, name: 'Formentera', destination: 'Formentera', country: 'Spain' },
  { pattern: /\bla\s+palma\b/i, name: 'La Palma', destination: 'La Palma', country: 'Spain' },
  { pattern: /\b(?:denia|oliva)\b/i, name: 'Denia & Oliva', destination: 'Costa Blanca', country: 'Spain' },

  // Greece
  { pattern: /\b(?:prasonisi|prassonissi)\b/i, name: 'Prasonisi', destination: 'Rhodes', country: 'Greece' },
  { pattern: /\b(?:theologos|kremasti|ialyssos)\b/i, name: 'Theologos', destination: 'Rhodes', country: 'Greece' },
  { pattern: /\brhodes\b/i, name: 'Rhodes Coast', destination: 'Rhodes', country: 'Greece' },
  { pattern: /\b(?:paros|pounta|pounda|santa\s+maria)\b/i, name: 'Pounda Beach', destination: 'Paros', country: 'Greece' },
  { pattern: /\b(?:naxos|mikri\s+vigla|glyfada)\b/i, name: 'Mikri Vigla', destination: 'Naxos', country: 'Greece' },
  { pattern: /\b(?:mykonos|korfos|ftelia)\b/i, name: 'Korfos Bay', destination: 'Mykonos', country: 'Greece' },
  { pattern: /\b(?:santorini|monolithos)\b/i, name: 'Monolithos', destination: 'Santorini', country: 'Greece' },
  { pattern: /\b(?:marmari\s+kos|mastichari|kohilari)\b/i, name: 'Marmari & Kohilari', destination: 'Kos', country: 'Greece' },
  { pattern: /\bkos\b/i, name: 'Kos Island', destination: 'Kos', country: 'Greece' },
  { pattern: /\b(?:karpathos|afiartis)\b/i, name: 'Afiartis', destination: 'Karpathos', country: 'Greece' },
  { pattern: /\b(?:lefkada|agios\s+ioannis|milos\s+beach|vassiliki)\b/i, name: 'Agios Ioannis', destination: 'Lefkada', country: 'Greece' },
  { pattern: /\b(?:corfu|kerkyra|chalikounas|issos)\b/i, name: 'Chalikounas', destination: 'Corfu', country: 'Greece' },
  { pattern: /\b(?:elafonisi|falassarna)\b/i, name: 'Elafonisi', destination: 'Crete', country: 'Greece' },
  { pattern: /\b(?:kouremenos|palekastro)\b/i, name: 'Palekastro', destination: 'Crete', country: 'Greece' },
  { pattern: /\b(?:ammoudara|heraklion)\b/i, name: 'Heraklion', destination: 'Crete', country: 'Greece' },
  { pattern: /\b(?:limnos|lemnos|keros)\b/i, name: 'Keros Bay', destination: 'Limnos', country: 'Greece' },
  { pattern: /\b(?:evia|lefkandi|marmari\s+evia)\b/i, name: 'Lefkandi', destination: 'Evia', country: 'Greece' },
  { pattern: /\b(?:drepano|cape\s+drepano|patras)\b/i, name: 'Cape Drepano', destination: 'Patras', country: 'Greece' },
  { pattern: /\b(?:loutsa|artemida)\b/i, name: 'Loutsa', destination: 'Athens Coast', country: 'Greece' },
  { pattern: /\belafonisos\b/i, name: 'Elafonisos', destination: 'Peloponnese', country: 'Greece' },
  { pattern: /\b(?:schinias|marathon)\b/i, name: 'Schinias', destination: 'Athens Coast', country: 'Greece' },
  { pattern: /\banavyssos\b/i, name: 'Anavyssos', destination: 'Athens Coast', country: 'Greece' },

  // France
  { pattern: /\b(?:leucate|la\s+franqui)\b/i, name: 'La Franqui', destination: 'Leucate', country: 'France' },
  { pattern: /\b(?:hy[eè]res|almanarre)\b/i, name: 'L\'Almanarre', destination: 'Hyères', country: 'France' },
  { pattern: /\b(?:beauduc|camargue)\b/i, name: 'Beauduc', destination: 'Camargue', country: 'France' },
  { pattern: /\b(?:gruissan|saint[- ]cyprien)\b/i, name: 'Gruissan', destination: 'Gruissan', country: 'France' },
  { pattern: /\b(?:quiberon|carnac|presqu['’]île\s+de\s+quiberon)\b/i, name: 'Presqu\'île de Quiberon', destination: 'Quiberon', country: 'France' },
  { pattern: /\b(?:arcachon|biscarrosse|dune\s+du\s+pilat)\b/i, name: 'Biscarrosse', destination: 'Biscarrosse', country: 'France' },
  { pattern: /\bla\s+tranche[- ]sur[- ]mer\b/i, name: 'La Tranche-sur-Mer', destination: 'Vendée', country: 'France' },

  // Italy
  { pattern: /\b(?:lo\s+stagnone|stagnone|marsala)\b/i, name: 'Lo Stagnone Lagoon', destination: 'Sicily', country: 'Italy' },
  { pattern: /\b(?:puzziteddu|capo\s+granitola)\b/i, name: 'Puzziteddu', destination: 'Sicily', country: 'Italy' },
  { pattern: /\bporto\s+pollo\b/i, name: 'Porto Pollo', destination: 'Sardinia', country: 'Italy' },
  { pattern: /\bpunta\s+trettu\b/i, name: 'Punta Trettu', destination: 'Sardinia', country: 'Italy' },
  { pattern: /\b(?:chia|porto\s+pino)\b/i, name: 'Chia & Porto Pino', destination: 'Sardinia', country: 'Italy' },
  { pattern: /\b(?:gizzeria|hang\s+loose\s+beach)\b/i, name: 'Gizzeria Lido', destination: 'Calabria', country: 'Italy' },
  { pattern: /\b(?:garda|malcesine|navene|campione)\b/i, name: 'Lake Garda', destination: 'Lake Garda', country: 'Italy' },
  { pattern: /\b(?:como|colico|dervio|valmadrera)\b/i, name: 'Lake Como', destination: 'Lake Como', country: 'Italy' },
  { pattern: /\b(?:punta\s+prosciutto|torre\s+san\s+giovanni|salento)\b/i, name: 'Punta Prosciutto (Salento)', destination: 'Puglia', country: 'Italy' },

  // Egypt
  { pattern: /\b(?:el\s+gouna|gouna)\b/i, name: 'El Gouna Lagoon', destination: 'El Gouna', country: 'Egypt' },
  { pattern: /\bsoma\s+bay\b/i, name: 'Soma Bay', destination: 'Soma Bay', country: 'Egypt' },
  { pattern: /\bsafaga\b/i, name: 'Safaga Bay', destination: 'Safaga', country: 'Egypt' },
  { pattern: /\bdahab\b/i, name: 'Dahab Blue Lagoon', destination: 'Dahab', country: 'Egypt' },
  { pattern: /\bras\s+sudr\b/i, name: 'Ras Sudr', destination: 'Ras Sudr', country: 'Egypt' },
  { pattern: /\bhurghada\b/i, name: 'Hurghada Coast', destination: 'Hurghada', country: 'Egypt' },
  { pattern: /\bmarsa\s+alam\b/i, name: 'Marsa Alam', destination: 'Marsa Alam', country: 'Egypt' },

  // South Africa
  { pattern: /\b(?:bloubergstrand|blouberg|big\s+bay|delfin\s+beach|sunset\s+beach|cape\s+town)\b/i, name: 'Bloubergstrand & Big Bay', destination: 'Cape Town', country: 'South Africa' },
  { pattern: /\blangebaan\b/i, name: 'Langebaan Lagoon', destination: 'Langebaan', country: 'South Africa' },
  { pattern: /\bmuizenberg\b/i, name: 'Muizenberg', destination: 'Cape Town', country: 'South Africa' },

  // Southeast Asia & South America
  { pattern: /\bmui\s+ne\b/i, name: 'Mui Ne Bay', destination: 'Mui Ne', country: 'Vietnam' },
  { pattern: /\bphan\s+rang\b/i, name: 'My Hoa Lagoon', destination: 'Phan Rang', country: 'Vietnam' },
  { pattern: /\b(?:boracay|bulabog)\b/i, name: 'Bulabog Beach', destination: 'Boracay', country: 'Philippines' },
  { pattern: /\b(?:hua\s+hin|pranburi)\b/i, name: 'Hua Hin & Pranburi', destination: 'Hua Hin', country: 'Thailand' },
  { pattern: /\bkoh\s+phangan\b/i, name: 'Koh Phangan', destination: 'Koh Phangan', country: 'Thailand' },
  { pattern: /\bkappalady\b/i, name: 'Kappalady Lagoon', destination: 'Kalpitiya', country: 'Sri Lanka' },
  { pattern: /\bkalpitiya\b/i, name: 'Kalpitiya Lagoon', destination: 'Kalpitiya', country: 'Sri Lanka' },
  { pattern: /\bpacasmayo\b/i, name: 'Pacasmayo', destination: 'Pacasmayo', country: 'Peru' },
  { pattern: /\bparacas\b/i, name: 'Paracas Bay', destination: 'Paracas', country: 'Peru' },
  { pattern: /\b(?:m[aá]ncora|lobitos)\b/i, name: 'Máncora & Lobitos', destination: 'Máncora', country: 'Peru' },
  { pattern: /\b(?:el\s+yaque|margarita)\b/i, name: 'El Yaque', destination: 'Isla Margarita', country: 'Venezuela' },
  { pattern: /\blos\s+roques\b/i, name: 'Los Roques', destination: 'Los Roques', country: 'Venezuela' },
  { pattern: /\bad[ií]cora\b/i, name: 'Adícora', destination: 'Paraguaná', country: 'Venezuela' },
]

async function runBackfill () {
  console.log( 'Starting backfill of Country -> Destination -> Spot hierarchy...' )
  const suppliers = await prisma.kiteBeachSupplier.findMany()
  console.log( `Found ${ suppliers.length } total supplier records.` )

  let updatedCount = 0

  for ( const s of suppliers ) {
    const combined = [ s.spot, s.destination, s.beach, s.tag, s.address, s.name, s.city ].filter( Boolean ).join( ' ' )
    
    let matched = null
    for ( const spotDef of SPOTS ) {
      if ( spotDef.pattern.test( combined ) ) {
        matched = spotDef
        break
      }
    }

    // Fallback: parse existing composite "Destination (Spot)" if present in beach
    let destination = matched ? matched.destination : null
    let spot = matched ? matched.name : null
    let country = matched ? matched.country : s.country

    if ( !destination && s.beach ) {
      const parenMatch = s.beach.match( /^([^(]+)\s*\(([^)]+)\)$/ )
      if ( parenMatch ) {
        destination = parenMatch[ 1 ].trim()
        spot = parenMatch[ 2 ].trim()
      } else {
        destination = s.beach
        spot = s.beach
      }
    }

    if ( !destination && s.city ) {
      destination = s.city
      spot = s.city
    }

    const updates = {}
    if ( destination && s.destination !== destination ) updates.destination = destination
    if ( spot && s.spot !== spot ) updates.spot = spot
    if ( country && s.country !== country ) updates.country = country

    if ( Object.keys( updates ).length > 0 ) {
      await prisma.kiteBeachSupplier.update( {
        where: { id: s.id },
        data: updates,
      } )
      updatedCount++
    }
  }

  console.log( `✔ Successfully backfilled ${ updatedCount } records.` )

  const stats = await prisma.kiteBeachSupplier.groupBy( {
    by: [ 'country', 'destination' ],
    _count: { id: true },
    orderBy: [ { country: 'asc' }, { _count: { id: 'desc' } } ],
  } )

  console.log( '\n=== Country & Destination Breakdown ===' )
  for ( const st of stats ) {
    console.log( `${ st.country } -> ${ st.destination || 'Unknown' }: ${ st._count.id } listings` )
  }
}

runBackfill()
  .catch( console.error )
  .finally( () => prisma.$disconnect() )
