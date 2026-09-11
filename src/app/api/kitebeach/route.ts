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

// Known kite spots and beaches in Ceará & Nordeste
const KNOWN_SPOTS: { pattern: RegExp; name: string; defaultCity?: string }[] = [
  { pattern: /\bcumbuco\b/i, name: 'Cumbuco', defaultCity: 'Caucaia' },
  { pattern: /\bta[ií]ba\b/i, name: 'Taíba', defaultCity: 'São Gonçalo do Amarante' },
  { pattern: /\bparacuru\b/i, name: 'Paracuru', defaultCity: 'Paracuru' },
  { pattern: /\b(?:ilha\s+do\s+guajir[uú]|ilhadoguajiru)\b/i, name: 'Ilha do Guajirú', defaultCity: 'Itarema' },
  { pattern: /\bpre[aá]\b/i, name: 'Preá', defaultCity: 'Cruz' },
  { pattern: /\b(?:jericoacoara|jeri)\b/i, name: 'Jericoacoara', defaultCity: 'Jijoca de Jericoacoara' },
  { pattern: /\b(?:icara[ií]zinho|icara[ií]\s+de\s+amontada)\b/i, name: 'Icaraizinho', defaultCity: 'Amontada' },
  { pattern: /\bguajir[uú]\b/i, name: 'Guajirú', defaultCity: 'Trairi' },
  { pattern: /\bflecheiras\b/i, name: 'Flecheiras', defaultCity: 'Trairi' },
  { pattern: /\blagoinha\b/i, name: 'Lagoinha', defaultCity: 'Paraipaba' },
  { pattern: /\bbarra\s+nova\b/i, name: 'Barra Nova', defaultCity: 'Cascavel' },
  { pattern: /\burua[uú]\b/i, name: 'Uruaú', defaultCity: 'Beberibe' },
  { pattern: /\btatajuba\b/i, name: 'Tatajuba', defaultCity: 'Camocim' },
  { pattern: /\bcamocim\b/i, name: 'Camocim', defaultCity: 'Camocim' },
  { pattern: /\bfortaleza\b/i, name: 'Fortaleza', defaultCity: 'Fortaleza' },
  { pattern: /\bbarra\s+grande\b/i, name: 'Barra Grande', defaultCity: 'Cajueiro da Praia' },
  { pattern: /\bmacap[aá]\b/i, name: 'Macapá', defaultCity: 'Luís Correia' },
]

function detectBeachAndCity ( candidateTexts: string[] ): { beach: string | null; city: string | null } {
  const combined = candidateTexts.filter( Boolean ).join( ' ' )
  for ( const spot of KNOWN_SPOTS ) {
    if ( spot.pattern.test( combined ) ) {
      return { beach: spot.name, city: spot.defaultCity || null }
    }
  }
  return { beach: null, city: null }
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
  const explicitCity = text( item.city, item.City )
  const detected = detectBeachAndCity( [ explicitBeach, tag || '', address || '', name ] )

  const beach = explicitBeach || detected.beach || null
  const city = explicitCity || detected.city || null

  return {
    name,
    beach,
    city,
    state: text( item.state, item.State ) || 'CE',
    country: text( item.country, item.Country ) || 'Brazil',
    category,
    phone,
    email,
    website,
    instagram,
    address,
    rating: numeric( item.rating, parseFloat ),
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

    const skip = ( page - 1 ) * limit
    const where: Prisma.KiteBeachSupplierWhereInput = {}

    if ( contactedFilter === 'true' ) {
      where.contacted = true
    } else if ( contactedFilter === 'false' ) {
      where.contacted = false
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

    const [ suppliers, total, contactedCount, beachGroups ] = await Promise.all( [
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
        by: [ 'beach' ],
        _count: { id: true },
        where: { beach: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      } ),
    ] )

    const beaches = beachGroups.map( bg => ( {
      name: bg.beach as string,
      count: bg._count.id,
    } ) )

    const pendingCount = total - contactedCount
    const totalPages = Math.ceil( total / limit ) || 1

    return NextResponse.json(
      {
        suppliers,
        beaches,
        total,
        contactedCount,
        pendingCount,
        page,
        totalPages,
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
    const { id, contacted, notes, phone, email, website, instagram, beach, category } = body

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
    if ( category !== undefined ) updateData.category = category ? String( category ) : null

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
