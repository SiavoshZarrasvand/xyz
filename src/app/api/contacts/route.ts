import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/

export const MAX_BATCH_SIZE = 500

function corsFor ( request: NextRequest ): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' }
  const origin = request.headers.get( 'origin' )

  if ( origin && EXTENSION_ORIGIN.test( origin ) ) {
    headers[ 'Access-Control-Allow-Origin' ] = origin
    headers[ 'Access-Control-Allow-Methods' ] = 'GET, POST, PUT, OPTIONS'
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
  const phone = text( item.phone, item.Phone )

  if ( !name || !phone ) return null

  return {
    name,
    phone,
    email: text( item.email, item.Email ) || null,
    website: text( item.website, item.Website ) || null,
    address: text( item.address, item.Address ) || null,
    category: text( item.category, item.Category ) || null,
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
    const search = searchParams.get( 'search' ) || ''

    const skip = ( page - 1 ) * limit

    // Build where clause
    const where: any = {}

    if ( contactedFilter === 'true' ) {
      where.contacted = true
    } else if ( contactedFilter === 'false' ) {
      where.contacted = false
    }

    if ( search ) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { category: { contains: search } },
      ]
    }

    const [ contacts, total ] = await Promise.all( [
      prisma.contact.findMany( {
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      } ),
      prisma.contact.count( { where } ),
    ] )

    return NextResponse.json(
      {
        contacts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil( total / limit ),
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

    const byPhone = new Map<string, NonNullable<ReturnType<typeof normaliseContact>>>()
    let skipped = 0

    for ( const item of rawContacts ) {
      const normalised = normaliseContact( item )
      if ( !normalised ) {
        skipped++
        continue
      }
      byPhone.set( normalised.phone, normalised )
    }

    const pending = [ ...byPhone.values() ]

    if ( pending.length === 0 ) {
      return NextResponse.json(
        {
          success: true,
          summary: { totalProcessed: 0, newContacts: 0, updatedContacts: 0, skipped },
        },
        { headers: corsFor( request ) }
      )
    }

    const existing = await prisma.contact.findMany( {
      where: { phone: { in: pending.map( c => c.phone ) } },
      select: { phone: true },
    } )
    const existingPhones = new Set( existing.map( c => c.phone ) )

    await prisma.$transaction(
      pending.map( contact => prisma.contact.upsert( {
        where: { phone: contact.phone },
        update: contact,
        create: contact,
      } ) )
    )

    const updatedContacts = pending.filter( c => existingPhones.has( c.phone ) ).length

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalProcessed: pending.length,
          newContacts: pending.length - updatedContacts,
          updatedContacts,
          skipped,
        },
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Create/batch contacts error:', error )
    return NextResponse.json(
      { error: 'Failed to process contacts' },
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

    return NextResponse.json( { success: true, contact }, { headers: corsFor( request ) } )
  } catch ( error ) {
    console.error( 'Update contact error:', error )
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}
