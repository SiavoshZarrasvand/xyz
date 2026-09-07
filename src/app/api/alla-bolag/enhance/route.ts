import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { broadcastCrmEvent } from '@/lib/events'

function corsFor ( request: NextRequest ) {
  const origin = request.headers.get( 'origin' ) || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export async function OPTIONS ( request: NextRequest ) {
  return NextResponse.json( {}, { headers: corsFor( request ) } )
}

/**
 * POST /api/alla-bolag/enhance
 * Accepts business listings extracted from Google Maps, matches them to AllaBolagCompany records
 * by name, city, phone, or search tag, and updates their `website` and `googleMapsUrl`.
 */
export async function POST ( request: NextRequest ) {
  try {
    const body = await request.json()
    const items = Array.isArray( body )
      ? body
      : Array.isArray( body.contacts )
      ? body.contacts
      : Array.isArray( body.companies )
      ? body.companies
      : [ body ]

    if ( items.length === 0 ) {
      return NextResponse.json( { success: true, updated: 0 }, { headers: corsFor( request ) } )
    }

    let updatedCount = 0
    const enhancedCompanies: string[] = []

    for ( const item of items ) {
      if ( !item ) continue

      const name = typeof item.name === 'string' ? item.name.trim() : ''
      const website = typeof item.website === 'string' && item.website.trim() ? item.website.trim() : null
      const googleMapsUrl = typeof item.url === 'string' && item.url.trim() ? item.url.trim() : null
      const phone = typeof item.phone === 'string' && item.phone.trim() ? item.phone.replace( /\D/g, '' ) : null
      const tag = typeof item.tag === 'string' ? item.tag.trim() : ''

      if ( !website && !googleMapsUrl ) continue

      // Look up matching AllaBolagCompany
      // 1. By exact name
      let company = name
        ? await prisma.allaBolagCompany.findFirst( {
            where: {
              name: { equals: name },
            },
          } )
        : null

      // 2. By search tag if name didn't match directly
      if ( !company && tag ) {
        company = await prisma.allaBolagCompany.findFirst( {
          where: {
            OR: [
              { name: { contains: tag } },
              { name: { equals: tag } },
            ],
          },
        } )
      }

      // 3. By phone number digits
      if ( !company && phone && phone.length >= 7 ) {
        const last7 = phone.slice( -7 )
        company = await prisma.allaBolagCompany.findFirst( {
          where: {
            phone: { contains: last7 },
          },
        } )
      }

      if ( company ) {
        await prisma.allaBolagCompany.update( {
          where: { id: company.id },
          data: {
            website: website || company.website,
            googleMapsUrl: googleMapsUrl || company.googleMapsUrl,
            phone: company.phone || item.phone || null,
          },
        } )
        updatedCount++
        enhancedCompanies.push( `${ company.name } -> ${ website || 'Maps URL' }` )
      }
    }

    if ( updatedCount > 0 ) {
      broadcastCrmEvent( {
        type: 'ALLABOLAG_UPDATED',
        total: updatedCount,
        timestamp: Date.now(),
      } )
    }

    console.log( `[AllaBolag Enhance] Enhanced ${ updatedCount } company(s) with Maps website data:` )
    for ( const msg of enhancedCompanies.slice( 0, 5 ) ) {
      console.log( `  ✔ ${ msg }` )
    }

    return NextResponse.json(
      {
        success: true,
        updated: updatedCount,
        details: enhancedCompanies,
      },
      { headers: corsFor( request ) }
    )
  } catch ( error ) {
    console.error( 'Error enhancing AllaBolag company:', error )
    return NextResponse.json(
      { error: 'Failed to enhance company' },
      { status: 500, headers: corsFor( request ) }
    )
  }
}
