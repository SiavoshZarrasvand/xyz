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
  }
  return ''
}

function normaliseExhibitor ( item: Record<string, unknown> ) {
  const name = text( item.name, item.Name, item.companyName )
  if ( !name ) return null

  return {
    name,
    stand: text( item.stand, item.Stand, item.booth ) || null,
    whyVisit: text( item.whyVisit, item.WhyVisit, item[ 'Why visit our stand' ] ) || null,
    description: text( item.description, item.Description, item.about ) || null,
    website: text( item.website, item.Website, item.url ) || null,
    email: text( item.email, item.Email ) || null,
    phone: text( item.phone, item.Phone, item.telephone ) || null,
    street: text( item.street, item.Street ) || null,
    city: text( item.city, item.City ) || null,
    postcode: text( item.postcode, item.Postcode, item.postalCode ) || null,
    country: text( item.country, item.Country ) || null,
    address: text( item.address, item.Address, item.fullAddress ) || null,
    url: text( item.directoryUrl, item.directoryURL, item.url, item.link ) || null,
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
    const countryFilter = searchParams.get( 'country' )
    const search = searchParams.get( 'search' ) || ''
    const hasEmail = searchParams.get( 'hasEmail' )
    const hasPhone = searchParams.get( 'hasPhone' )
    const hasWebsite = searchParams.get( 'hasWebsite' )
    const nameFilter = searchParams.get( 'name' )
    const standFilter = searchParams.get( 'stand' )
    const phoneFilter = searchParams.get( 'phone' )
    const emailFilter = searchParams.get( 'email' )
    const websiteFilter = searchParams.get( 'website' )
    const cityFilter = searchParams.get( 'city' )
    const descriptionFilter = searchParams.get( 'description' )

    const skip = ( page - 1 ) * limit
    const where: Prisma.InCosmeticsExhibitorWhereInput = {}

    if ( contactedFilter === 'true' ) {
      where.contacted = true
    } else if ( contactedFilter === 'false' ) {
      where.contacted = false
    }

    if ( countryFilter && countryFilter !== 'all' ) {
      where.country = countryFilter
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

    if ( nameFilter ) where.name = { contains: nameFilter }
    if ( standFilter ) where.stand = { contains: standFilter }
    if ( phoneFilter ) where.phone = { contains: phoneFilter }
    if ( emailFilter ) where.email = { contains: emailFilter }
    if ( websiteFilter ) where.website = { contains: websiteFilter }
    if ( cityFilter ) where.city = { contains: cityFilter }
    if ( descriptionFilter ) {
      where.OR = [
        { description: { contains: descriptionFilter } },
        { whyVisit: { contains: descriptionFilter } },
      ]
    }

    if ( search ) {
      const searchConditions = [
        { name: { contains: search } },
        { stand: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { website: { contains: search } },
        { country: { contains: search } },
        { city: { contains: search } },
        { address: { contains: search } },
        { description: { contains: search } },
        { whyVisit: { contains: search } },
      ]
      if ( where.OR ) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    const baseWhere: Prisma.InCosmeticsExhibitorWhereInput = { ...where }
    delete baseWhere.contacted

    const [ exhibitors, total, countriesData, contactedCount, pendingCount ] = await Promise.all( [
      prisma.inCosmeticsExhibitor.findMany( {
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      } ),
      prisma.inCosmeticsExhibitor.count( { where } ),
      prisma.inCosmeticsExhibitor.groupBy( {
        by: [ 'country' ],
        _count: { id: true },
        where: { country: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      } ),
      prisma.inCosmeticsExhibitor.count( { where: { ...baseWhere, contacted: true } } ),
      prisma.inCosmeticsExhibitor.count( { where: { ...baseWhere, contacted: false } } ),
    ] )

    const countries = countriesData.map( c => ( { name: c.country as string, count: c._count.id } ) )

    return NextResponse.json(
      {
        exhibitors,
        countries,
        stats: {
          total,
          contacted: contactedCount,
          pending: pendingCount,
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
    console.error( 'Get in-cosmetics exhibitors error:', error )
    return NextResponse.json(
      { error: 'Failed to fetch exhibitors' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function POST ( request: NextRequest ) {
  try {
    const body = await request.json()
    const rawItems = Array.isArray( body )
      ? body
      : Array.isArray( body.exhibitors )
      ? body.exhibitors
      : Array.isArray( body.contacts )
      ? body.contacts
      : [ body ]

    if ( !rawItems || rawItems.length === 0 ) {
      return NextResponse.json(
        { error: 'No exhibitor data provided' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    if ( rawItems.length > MAX_BATCH_SIZE ) {
      return NextResponse.json(
        { error: `Batch too large: ${ rawItems.length }, maximum is ${ MAX_BATCH_SIZE }` },
        { status: 413, headers: corsFor( request ) }
      )
    }

    console.log( `[In-Cosmetics API] 📥 Received ${ rawItems.length } exhibitor(s) to process.` )

    const dedupMap = new Map<string, NonNullable<ReturnType<typeof normaliseExhibitor>>>()
    let skipped = 0

    for ( const item of rawItems ) {
      const normalised = normaliseExhibitor( item )
      if ( !normalised ) {
        skipped++
        continue
      }
      const key = normalised.url
        ? `url:${ normalised.url }`
        : normalised.name
        ? `name:${ normalised.name }:${ normalised.stand || '' }`
        : `id:${ Math.random() }`
      dedupMap.set( key, normalised )
    }

    const pending = [ ...dedupMap.values() ]

    if ( pending.length === 0 ) {
      console.log( `[In-Cosmetics API] ⚠️ No valid exhibitors in batch.` )
      return NextResponse.json(
        {
          success: true,
          summary: { totalProcessed: 0, newExhibitors: 0, updatedExhibitors: 0, skipped },
        },
        { headers: corsFor( request ) }
      )
    }

    const urls = pending.map( e => e.url ).filter( Boolean ) as string[]
    const names = pending.map( e => e.name ).filter( Boolean ) as string[]

    const orConditions: Prisma.InCosmeticsExhibitorWhereInput[] = []
    if ( urls.length > 0 ) orConditions.push( { url: { in: urls } } )
    if ( names.length > 0 ) orConditions.push( { name: { in: names } } )

    const existing = orConditions.length > 0
      ? await prisma.inCosmeticsExhibitor.findMany( {
          where: { OR: orConditions },
        } )
      : []

    let updatedExhibitors = 0
    let newExhibitors = 0

    await prisma.$transaction( async ( tx ) => {
      for ( const exhibitor of pending ) {
        const match = existing.find( ( ex ) =>
          ( exhibitor.url && ex.url === exhibitor.url ) ||
          ( exhibitor.name && ex.name.toLowerCase() === exhibitor.name.toLowerCase() && ( !exhibitor.stand || ex.stand === exhibitor.stand ) )
        )

        if ( match ) {
          await tx.inCosmeticsExhibitor.update( {
            where: { id: match.id },
            data: exhibitor,
          } )
          updatedExhibitors++
        } else {
          await tx.inCosmeticsExhibitor.create( {
            data: exhibitor,
          } )
          newExhibitors++
        }
      }
    } )

    if ( pending.length === 1 ) {
      const e = pending[ 0 ]
      console.log( `[In-Cosmetics API] ✅ Saved "${ e.name }" (Stand: ${ e.stand || '-' }, Country: ${ e.country || '-' })` )
    } else {
      console.log(
        `[In-Cosmetics API] ✅ Processed batch of ${ pending.length } exhibitors: ` +
        `${ newExhibitors } new, ${ updatedExhibitors } updated, ${ skipped } skipped.`
      )
    }

    broadcastCrmEvent( {
      type: 'INCOSMETICS_UPDATED',
      total: pending.length,
      timestamp: Date.now(),
    } )

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalProcessed: pending.length,
          newExhibitors,
          updatedExhibitors,
          skipped,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Create/batch in-cosmetics error:', error )
    return NextResponse.json(
      { error: 'Failed to process exhibitors', details: error instanceof Error ? error.message : String( error ) },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function PUT ( request: NextRequest ) {
  try {
    const body = await request.json()
    const { id } = body

    if ( !id ) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    const data: Prisma.InCosmeticsExhibitorUpdateInput = {}

    if ( typeof body.contacted === 'boolean' ) {
      data.contacted = body.contacted
      data.contactedAt = body.contacted ? new Date() : null
    }

    if ( 'email' in body ) {
      data.email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
    }

    if ( 'phone' in body ) {
      data.phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    }

    if ( 'website' in body ) {
      data.website = typeof body.website === 'string' && body.website.trim() ? body.website.trim() : null
    }

    const exhibitor = await prisma.inCosmeticsExhibitor.update( {
      where: { id },
      data,
    } )

    broadcastCrmEvent( {
      type: 'INCOSMETICS_UPDATED',
      total: 1,
      timestamp: Date.now(),
    } )

    return NextResponse.json( { success: true, exhibitor }, { headers: corsFor( request ) } )
  } catch ( error ) {
    console.error( 'Update exhibitor error:', error )
    return NextResponse.json(
      { error: 'Failed to update exhibitor' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function DELETE ( request: NextRequest ) {
  try {
    const { searchParams } = new URL( request.url )
    const all = searchParams.get( 'all' ) === 'true'
    const id = searchParams.get( 'id' )

    if ( all ) {
      const result = await prisma.inCosmeticsExhibitor.deleteMany( {} )
      broadcastCrmEvent( {
        type: 'INCOSMETICS_DELETED',
        count: result.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json(
        { success: true, message: 'All in-cosmetics exhibitors cleared', count: result.count },
        { headers: corsFor( request ) }
      )
    }

    if ( id ) {
      const deleted = await prisma.inCosmeticsExhibitor.delete( { where: { id } } )
      broadcastCrmEvent( {
        type: 'INCOSMETICS_DELETED',
        count: 1,
        timestamp: Date.now(),
      } )
      return NextResponse.json(
        { success: true, exhibitor: deleted },
        { headers: corsFor( request ) }
      )
    }

    return NextResponse.json(
      { error: 'Specify ?all=true or ?id=<id> to delete' },
      { status: 400, headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Delete exhibitor error:', error )
    return NextResponse.json(
      { error: 'Failed to delete exhibitor' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}
