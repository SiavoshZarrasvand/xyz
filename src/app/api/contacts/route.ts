import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS () {
  return NextResponse.json( {}, { headers: corsHeaders } )
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
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { category: { contains: search, mode: 'insensitive' } },
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
      { headers: corsHeaders }
    )
  } catch ( error ) {
    console.error( 'Get contacts error:', error )
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500, headers: corsHeaders }
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
        { status: 400, headers: corsHeaders }
      )
    }

    let totalProcessed = 0
    let newContacts = 0
    let updatedContacts = 0
    let skipped = 0

    for ( const item of rawContacts ) {
      const name = ( item.name || item.Name || '' ).trim()
      const phone = ( item.phone || item.Phone || '' ).trim()

      if ( !name || !phone ) {
        skipped++
        continue
      }

      totalProcessed++

      const ratingVal = item.rating !== undefined && item.rating !== null && item.rating !== ''
        ? parseFloat( String( item.rating ) )
        : null
      const reviewsVal = item.reviews !== undefined && item.reviews !== null && item.reviews !== ''
        ? parseInt( String( item.reviews ).replace( /[^0-9]/g, '' ), 10 ) || null
        : null

      const contactData = {
        name,
        phone,
        email: ( item.email || item.Email || '' ).trim() || null,
        website: ( item.website || item.Website || '' ).trim() || null,
        address: ( item.address || item.Address || '' ).trim() || null,
        category: ( item.category || item.Category || '' ).trim() || null,
        rating: isNaN( ratingVal as number ) ? null : ratingVal,
        reviews: isNaN( reviewsVal as number ) ? null : reviewsVal,
        googleMapsUrl: ( item.googleMapsUrl || item.url || item[ 'Google Maps URL' ] || '' ).trim() || null,
      }

      const existingContact = await prisma.contact.findUnique( {
        where: { phone },
      } )

      if ( existingContact ) {
        await prisma.contact.update( {
          where: { phone },
          data: contactData,
        } )
        updatedContacts++
      } else {
        await prisma.contact.create( {
          data: contactData,
        } )
        newContacts++
      }
    }

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalProcessed,
          newContacts,
          updatedContacts,
          skipped,
        },
      },
      { headers: corsHeaders }
    )
  } catch ( error ) {
    console.error( 'Create/batch contacts error:', error )
    return NextResponse.json(
      { error: 'Failed to process contacts' },
      { status: 500, headers: corsHeaders }
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
        { status: 400, headers: corsHeaders }
      )
    }

    const contact = await prisma.contact.update( {
      where: { id },
      data: {
        contacted,
        contactedAt: contacted ? new Date() : null,
      },
    } )

    return NextResponse.json( { success: true, contact }, { headers: corsHeaders } )
  } catch ( error ) {
    console.error( 'Update contact error:', error )
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500, headers: corsHeaders }
    )
  }
}
