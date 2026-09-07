import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { broadcastCrmEvent } from '@/lib/events'
import { Prisma } from '@prisma/client'

const MAX_BATCH_SIZE = 500

function corsFor ( request: NextRequest ): Record<string, string> {
  const origin = request.headers.get( 'origin' ) || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function text ( ...values: unknown[] ): string {
  for ( const v of values ) {
    if ( typeof v === 'string' && v.trim().length > 0 ) {
      return v.trim()
    }
    if ( typeof v === 'number' ) {
      return String( v )
    }
  }
  return ''
}

function formatOrgnr ( raw: string ): string {
  const digits = raw.replace( /\D/g, '' )
  if ( digits.length === 10 ) {
    return `${ digits.slice( 0, 6 ) }-${ digits.slice( 6 ) }`
  }
  return raw.trim()
}

function normaliseCompany ( item: Record<string, unknown> ) {
  const name = text( item.name, item.Name, item.companyName, item.foretag )
  if ( !name ) return null

  const rawOrgnr = text( item.orgnr, item.organisationNumber, item.orgNr, item.orgNumber, item[ 'Org.nr' ] )
  const orgnr = rawOrgnr ? formatOrgnr( rawOrgnr ) : null

  const phone = text(
    item.phone,
    item.telephone,
    item.telefon,
    item.telephoneNumber,
    item.mobile,
    item.mobilePhone,
    item.phoneNumbers && typeof item.phoneNumbers === 'object'
      ? ( ( item.phoneNumbers as Record<string, unknown> ).telephoneNumber || ( item.phoneNumbers as Record<string, unknown> ).mobilePhone )
      : null
  ) || null

  let street = text( item.street, item.addressLine, item.gatuadress, item.utdelningsadress ) || null
  let postcode = text( item.postcode, item.zipCode, item.postnummer ) || null
  let city = text( item.city, item.postPlace, item.ort, item.stad ) || null

  // If nested postalAddress object exists
  if ( item.postalAddress && typeof item.postalAddress === 'object' ) {
    const pa = item.postalAddress as Record<string, unknown>
    if ( !street ) street = text( pa.addressLine, pa.boxAddressLine ) || null
    if ( !postcode ) postcode = text( pa.zipCode ) || null
    if ( !city ) city = text( pa.postPlace ) || null
  } else if ( item.visitorAddress && typeof item.visitorAddress === 'object' ) {
    const va = item.visitorAddress as Record<string, unknown>
    if ( !street ) street = text( va.addressLine, va.boxAddressLine ) || null
    if ( !postcode ) postcode = text( va.zipCode ) || null
    if ( !city ) city = text( va.postPlace ) || null
  }

  let address = text( item.address, item.fullAddress, item.adress ) || null
  if ( !address ) {
    const parts = [ street, postcode, city ].filter( Boolean )
    address = parts.length > 0 ? parts.join( ', ' ) : null
  }

  const url = text( item.url, item.link, item.profileUrl, item.allabolagUrl ) || null

  return {
    name,
    orgnr,
    phone,
    street,
    postcode,
    city,
    address,
    url,
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
    const cityFilter = searchParams.get( 'city' )
    const search = searchParams.get( 'search' ) || ''

    const skip = ( page - 1 ) * limit

    const where: Prisma.AllaBolagCompanyWhereInput = {}

    if ( contactedFilter === 'true' ) {
      where.contacted = true
    } else if ( contactedFilter === 'false' ) {
      where.contacted = false
    }

    if ( cityFilter && cityFilter !== 'all' ) {
      where.city = cityFilter
    }

    if ( search ) {
      where.OR = [
        { name: { contains: search } },
        { orgnr: { contains: search } },
        { phone: { contains: search } },
        { city: { contains: search } },
        { address: { contains: search } },
      ]
    }

    const [ companies, total, contactedCount, notContactedCount, citiesRaw ] = await Promise.all( [
      prisma.allaBolagCompany.findMany( {
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      } ),
      prisma.allaBolagCompany.count( { where } ),
      prisma.allaBolagCompany.count( { where: { ...where, contacted: true } } ),
      prisma.allaBolagCompany.count( { where: { ...where, contacted: false } } ),
      prisma.allaBolagCompany.groupBy( {
        by: [ 'city' ],
        _count: { city: true },
        where: { city: { not: null } },
        orderBy: { _count: { city: 'desc' } },
        take: 30,
      } ),
    ] )

    const cities = citiesRaw
      .filter( c => c.city && c.city.trim() )
      .map( c => ( {
        name: c.city as string,
        count: c._count.city,
      } ) )

    return NextResponse.json(
      {
        companies,
        cities,
        stats: {
          total,
          contacted: contactedCount,
          pending: notContactedCount,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil( total / limit ) || 1,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Get alla-bolag companies error:', error )
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function POST ( request: NextRequest ) {
  try {
    const body = await request.json()
    const rawItems = Array.isArray( body )
      ? body
      : Array.isArray( body.companies )
      ? body.companies
      : Array.isArray( body.contacts )
      ? body.contacts
      : [ body ]

    if ( !rawItems || rawItems.length === 0 ) {
      return NextResponse.json(
        { error: 'No company data provided' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    if ( rawItems.length > MAX_BATCH_SIZE ) {
      return NextResponse.json(
        { error: `Batch too large: ${ rawItems.length }, maximum is ${ MAX_BATCH_SIZE }` },
        { status: 413, headers: corsFor( request ) }
      )
    }

    console.log( `[AllaBolag API] 📥 Received ${ rawItems.length } company(s) to process.` )

    const dedupMap = new Map<string, NonNullable<ReturnType<typeof normaliseCompany>>>()
    let skipped = 0

    for ( const item of rawItems ) {
      const normalised = normaliseCompany( item )
      if ( !normalised ) {
        skipped++
        continue
      }
      const key = normalised.orgnr
        ? `orgnr:${ normalised.orgnr }`
        : normalised.url
        ? `url:${ normalised.url }`
        : `name:${ normalised.name }:${ normalised.city || '' }`
      dedupMap.set( key, normalised )
    }

    const pending = [ ...dedupMap.values() ]

    if ( pending.length === 0 ) {
      return NextResponse.json(
        {
          success: true,
          summary: { totalProcessed: 0, newCompanies: 0, updatedCompanies: 0, skipped },
        },
        { headers: corsFor( request ) }
      )
    }

    const orgnrs = pending.map( c => c.orgnr ).filter( Boolean ) as string[]
    const urls = pending.map( c => c.url ).filter( Boolean ) as string[]
    const names = pending.map( c => c.name ).filter( Boolean ) as string[]

    const orConditions: Prisma.AllaBolagCompanyWhereInput[] = []
    if ( orgnrs.length > 0 ) orConditions.push( { orgnr: { in: orgnrs } } )
    if ( urls.length > 0 ) orConditions.push( { url: { in: urls } } )
    if ( names.length > 0 ) orConditions.push( { name: { in: names } } )

    const existing = orConditions.length > 0
      ? await prisma.allaBolagCompany.findMany( {
          where: { OR: orConditions },
        } )
      : []

    let updatedCompanies = 0
    let newCompanies = 0

    await prisma.$transaction( async ( tx ) => {
      for ( const comp of pending ) {
        const match = existing.find( ( ex ) =>
          ( comp.orgnr && ex.orgnr === comp.orgnr ) ||
          ( comp.url && ex.url === comp.url ) ||
          ( comp.name && ex.name.toLowerCase() === comp.name.toLowerCase() && ( !comp.city || ex.city === comp.city ) )
        )

        if ( match ) {
          await tx.allaBolagCompany.update( {
            where: { id: match.id },
            data: {
              ...comp,
              phone: comp.phone || match.phone,
              street: comp.street || match.street,
              postcode: comp.postcode || match.postcode,
              city: comp.city || match.city,
              address: comp.address || match.address,
            },
          } )
          updatedCompanies++
        } else {
          await tx.allaBolagCompany.create( {
            data: comp,
          } )
          newCompanies++
        }
      }
    } )

    if ( pending.length === 1 ) {
      const c = pending[ 0 ]
      console.log( `[AllaBolag API] ✅ Saved "${ c.name }" (Org.nr: ${ c.orgnr || '-' }, Tel: ${ c.phone || '-' })` )
    } else {
      console.log(
        `[AllaBolag API] ✅ Processed batch of ${ pending.length } companies: ` +
        `${ newCompanies } new, ${ updatedCompanies } updated, ${ skipped } skipped.`
      )
    }

    broadcastCrmEvent( {
      type: 'ALLABOLAG_UPDATED',
      total: pending.length,
      timestamp: Date.now(),
    } )

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalProcessed: pending.length,
          newCompanies,
          updatedCompanies,
          skipped,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Save alla-bolag companies error:', error )
    return NextResponse.json(
      { error: 'Failed to process companies', details: error instanceof Error ? error.message : String( error ) },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function PUT ( request: NextRequest ) {
  try {
    const { id, contacted } = await request.json()

    if ( !id || typeof contacted !== 'boolean' ) {
      return NextResponse.json(
        { error: 'id and contacted status (boolean) are required' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    const updated = await prisma.allaBolagCompany.update( {
      where: { id },
      data: {
        contacted,
        contactedAt: contacted ? new Date() : null,
      },
    } )

    broadcastCrmEvent( {
      type: 'ALLABOLAG_UPDATED',
      total: 1,
      timestamp: Date.now(),
    } )

    return NextResponse.json( updated, { headers: corsFor( request ) } )
  } catch ( error ) {
    console.error( 'Update company error:', error )
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function DELETE ( request: NextRequest ) {
  try {
    const { searchParams } = new URL( request.url )
    const clearAll = searchParams.get( 'all' ) === 'true'
    const id = searchParams.get( 'id' )

    if ( clearAll ) {
      const deleted = await prisma.allaBolagCompany.deleteMany( {} )
      broadcastCrmEvent( {
        type: 'ALLABOLAG_DELETED',
        count: deleted.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json( { success: true, count: deleted.count }, { headers: corsFor( request ) } )
    }

    if ( id ) {
      await prisma.allaBolagCompany.delete( { where: { id } } )
      broadcastCrmEvent( {
        type: 'ALLABOLAG_DELETED',
        count: 1,
        timestamp: Date.now(),
      } )
      return NextResponse.json( { success: true }, { headers: corsFor( request ) } )
    }

    return NextResponse.json(
      { error: 'Provide ?all=true or ?id=<uuid> to delete' },
      { status: 400, headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Delete alla-bolag error:', error )
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}
