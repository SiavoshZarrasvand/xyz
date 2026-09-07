import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { broadcastCrmEvent } from '@/lib/events'

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/

export const MAX_BATCH_SIZE = 500

function corsFor ( request: NextRequest ): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' }
  const origin = request.headers.get( 'origin' )

  if ( origin && EXTENSION_ORIGIN.test( origin ) ) {
    headers[ 'Access-Control-Allow-Origin' ] = origin
    headers[ 'Access-Control-Allow-Methods' ] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers[ 'Access-Control-Allow-Headers' ] = 'Content-Type'
    headers[ 'Access-Control-Max-Age' ] = '600'
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

function normaliseContact ( item: Record<string, unknown> ) {
  const name = text( item.name, item.Name )
  const phone = text( item.phone, item.Phone ) || null
  const email = text( item.email, item.Email ) || null
  const website = text( item.website, item.Website ) || null

  // Require name and at least one communication channel (phone, email, or website)
  if ( !name || ( !phone && !email && !website ) ) return null

  return {
    name,
    phone,
    email,
    website,
    address: text( item.address, item.Address ) || null,
    category: text( item.category, item.Category ) || null,
    tag: text( item.tag, item.Tag, item.query, item.searchQuery, item.sourceQuery ) || null,
    rating: numeric( item.rating, parseFloat ),
    reviews: numeric( item.reviews, raw => parseInt( raw, 10 ) ),
    googleMapsUrl: text( item.googleMapsUrl, item.url, item[ 'Google Maps URL' ] ) || null,
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
    const tagFilter = searchParams.get( 'tag' )
    const search = searchParams.get( 'search' ) || ''
    const hasEmail = searchParams.get( 'hasEmail' )
    const hasPhone = searchParams.get( 'hasPhone' )
    const hasWebsite = searchParams.get( 'hasWebsite' )
    const nameFilter = searchParams.get( 'name' )
    const phoneFilter = searchParams.get( 'phone' )
    const emailFilter = searchParams.get( 'email' )
    const websiteFilter = searchParams.get( 'website' )
    const addressFilter = searchParams.get( 'address' )
    const categoryFilter = searchParams.get( 'category' )

    const skip = ( page - 1 ) * limit

    // Build where clause
    const where: Prisma.ContactWhereInput = {}

    if ( contactedFilter === 'true' ) {
      where.contacted = true
    } else if ( contactedFilter === 'false' ) {
      where.contacted = false
    }

    if ( tagFilter === '__untagged__' ) {
      where.tag = null
    } else if ( tagFilter && tagFilter !== 'all' ) {
      where.tag = tagFilter
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
    if ( phoneFilter ) where.phone = { contains: phoneFilter }
    if ( emailFilter ) where.email = { contains: emailFilter }
    if ( websiteFilter ) where.website = { contains: websiteFilter }
    if ( addressFilter ) where.address = { contains: addressFilter }
    if ( categoryFilter ) where.category = { contains: categoryFilter }

    if ( search ) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { website: { contains: search } },
        { address: { contains: search } },
        { category: { contains: search } },
        { tag: { contains: search } },
      ]
    }

    const [ contacts, total, tagsData, untaggedCount ] = await Promise.all( [
      prisma.contact.findMany( {
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      } ),
      prisma.contact.count( { where } ),
      prisma.contact.groupBy( {
        by: [ 'tag' ],
        _count: { id: true },
        where: { tag: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      } ),
      prisma.contact.count( { where: { tag: null } } ),
    ] )

    const tags = tagsData.map( t => ( { name: t.tag as string, count: t._count.id } ) )

    return NextResponse.json(
      {
        contacts,
        tags,
        untaggedCount,
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
    console.error( 'Get contacts error:', error )
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function POST ( request: NextRequest ) {
  try {
    const body = await request.json()
    const rawContacts = Array.isArray( body )
      ? body
      : Array.isArray( body.contacts )
      ? body.contacts
      : [ body ]

    if ( !rawContacts || rawContacts.length === 0 ) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    if ( rawContacts.length > MAX_BATCH_SIZE ) {
      return NextResponse.json(
        { error: `Batch too large: ${ rawContacts.length } contacts, maximum is ${ MAX_BATCH_SIZE }` },
        { status: 413, headers: corsFor( request ) }
      )
    }

    console.log( `[CRM API] 📥 Received ${ rawContacts.length } contact(s) to process.` )

    const dedupMap = new Map<string, NonNullable<ReturnType<typeof normaliseContact>>>()
    let skipped = 0

    for ( const item of rawContacts ) {
      const normalised = normaliseContact( item )
      if ( !normalised ) {
        skipped++
        const itemName = ( item && ( ( item as Record<string, unknown> ).name || ( item as Record<string, unknown> ).Name ) ) || 'Unknown'
        console.log( `[CRM API] ⚠️  Skipped "${ itemName }": missing phone, email, and website.` )
        continue
      }
      const key = normalised.phone
        ? `phone:${normalised.phone}`
        : normalised.googleMapsUrl
        ? `maps:${normalised.googleMapsUrl}`
        : normalised.website
        ? `web:${normalised.name}:${normalised.website}`
        : normalised.email
        ? `email:${normalised.email}`
        : `name:${normalised.name}:${normalised.address || ''}`
      dedupMap.set( key, normalised )
    }

    const pending = [ ...dedupMap.values() ]

    if ( pending.length === 0 ) {
      console.log( `[CRM API] ⚠️  No valid contacts in batch (${ skipped } skipped).` )
      return NextResponse.json(
        {
          success: true,
          summary: { totalProcessed: 0, newContacts: 0, updatedContacts: 0, skipped },
        },
        { headers: corsFor( request ) }
      )
    }

    const phones = pending.map( c => c.phone ).filter( Boolean ) as string[]
    const mapsUrls = pending.map( c => c.googleMapsUrl ).filter( Boolean ) as string[]
    const websites = pending.map( c => c.website ).filter( Boolean ) as string[]
    const emails = pending.map( c => c.email ).filter( Boolean ) as string[]

    const orConditions: Prisma.ContactWhereInput[] = []
    if ( phones.length > 0 ) orConditions.push( { phone: { in: phones } } )
    if ( mapsUrls.length > 0 ) orConditions.push( { googleMapsUrl: { in: mapsUrls } } )
    if ( websites.length > 0 ) orConditions.push( { website: { in: websites } } )
    if ( emails.length > 0 ) orConditions.push( { email: { in: emails } } )

    const existing = orConditions.length > 0
      ? await prisma.contact.findMany( {
          where: { OR: orConditions },
        } )
      : []

    let updatedContacts = 0
    let newContacts = 0

    await prisma.$transaction( async ( tx ) => {
      for ( const contact of pending ) {
        const match = existing.find( ( ex ) =>
          ( contact.phone && ex.phone === contact.phone ) ||
          ( contact.googleMapsUrl && ex.googleMapsUrl === contact.googleMapsUrl ) ||
          ( contact.website && ex.website === contact.website && ex.name === contact.name ) ||
          ( contact.email && ex.email === contact.email )
        )

        if ( match ) {
          await tx.contact.update( {
            where: { id: match.id },
            data: contact,
          } )
          updatedContacts++
        } else {
          await tx.contact.create( {
            data: contact,
          } )
          newContacts++
        }
      }
    } )

    if ( pending.length === 1 ) {
      const c = pending[ 0 ]
      console.log( `[CRM API] ✅ Saved "${ c.name }" (phone: ${ c.phone || 'none' }, web: ${ c.website ? 'yes' : 'none' }, tag: "${ c.tag || 'none' }")` )
    } else {
      console.log(
        `[CRM API] ✅ Processed batch of ${ pending.length } contacts: ` +
        `${ newContacts } new, ${ updatedContacts } updated, ${ skipped } skipped.`
      )
    }

    broadcastCrmEvent( {
      type: 'CONTACTS_UPDATED',
      total: pending.length,
      timestamp: Date.now(),
    } )

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalProcessed: pending.length,
          newContacts,
          updatedContacts,
          skipped,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Create/batch contacts error:', error )
    return NextResponse.json(
      { error: 'Failed to process contacts', details: error instanceof Error ? error.message : String( error ) },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function PUT ( request: NextRequest ) {
  try {
    const body = await request.json()
    const { id, contacted } = body

    if ( !id || typeof contacted !== 'boolean' ) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400, headers: corsFor( request ) }
      )
    }

    const contact = await prisma.contact.update( {
      where: { id },
      data: {
        contacted,
        contactedAt: contacted ? new Date() : null,
      },
    } )

    broadcastCrmEvent( {
      type: 'CONTACTS_UPDATED',
      total: 1,
      timestamp: Date.now(),
    } )

    return NextResponse.json( { success: true, contact }, { headers: corsFor( request ) } )
  } catch ( error ) {
    console.error( 'Update contact error:', error )
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}

export async function DELETE ( request: NextRequest ) {
  try {
    const { searchParams } = new URL( request.url )
    const id = searchParams.get( 'id' )
    const tag = searchParams.get( 'tag' )
    const all = searchParams.get( 'all' ) === 'true'

    if ( all ) {
      const result = await prisma.contact.deleteMany( {} )
      broadcastCrmEvent( {
        type: 'CONTACTS_DELETED',
        count: result.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json(
        { success: true, message: 'All contacts cleared', count: result.count },
        { headers: corsFor( request ) }
      )
    }

    if ( tag === '__untagged__' ) {
      const result = await prisma.contact.deleteMany( { where: { tag: null } } )
      broadcastCrmEvent( {
        type: 'CONTACTS_DELETED',
        count: result.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json(
        { success: true, message: 'Deleted untagged contacts', count: result.count },
        { headers: corsFor( request ) }
      )
    }

    if ( tag ) {
      const result = await prisma.contact.deleteMany( { where: { tag } } )
      broadcastCrmEvent( {
        type: 'CONTACTS_DELETED',
        count: result.count,
        timestamp: Date.now(),
      } )
      return NextResponse.json(
        { success: true, message: `Deleted contacts for tag: ${ tag }`, count: result.count },
        { headers: corsFor( request ) }
      )
    }

    if ( id ) {
      const deleted = await prisma.contact.delete( { where: { id } } )
      broadcastCrmEvent( {
        type: 'CONTACTS_DELETED',
        count: 1,
        timestamp: Date.now(),
      } )
      return NextResponse.json(
        { success: true, contact: deleted },
        { headers: corsFor( request ) }
      )
    }

    return NextResponse.json(
      { error: 'Specify ?all=true, ?tag=<tag>, or ?id=<id> to delete' },
      { status: 400, headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Delete contact error:', error )
    return NextResponse.json(
      { error: 'Failed to delete contacts' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}
