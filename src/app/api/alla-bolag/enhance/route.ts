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
      const rawPhone = typeof item.phone === 'string' && item.phone.trim() ? item.phone.trim() : null
      const phoneDigits = rawPhone ? rawPhone.replace( /\D/g, '' ) : null
      const tag = typeof item.tag === 'string' ? item.tag.trim() : ''

      if ( !website && !googleMapsUrl && !rawPhone ) continue

      // Look up matching AllaBolagCompany
      let company = null

      // 1. Exact primary key match (when called by enhancement script)
      if ( item.companyId && typeof item.companyId === 'string' ) {
        company = await prisma.allaBolagCompany.findUnique( {
          where: { id: item.companyId },
        } )
      }

      // 2. Exact company name match
      if ( !company && name ) {
        company = await prisma.allaBolagCompany.findFirst( {
          where: {
            name: { equals: name },
          },
        } )
      }

      // 3. Normalized company name match (stripping AB, Aktiebolag, etc.)
      if ( !company && name ) {
        const cleanName = name
          .replace( /\b(ab|aktiebolag|hb|handelsbolag|kb|kommanditbolag)\b/gi, '' )
          .replace( /[^\p{L}\p{N}\s]/gu, '' )
          .trim()
        if ( cleanName.length >= 3 ) {
          company = await prisma.allaBolagCompany.findFirst( {
            where: {
              name: { contains: cleanName },
            },
          } )
        }
      }

      // 4. By search tag: if tag was "Company Name AB City", match if company name starts with words in tag
      if ( !company && tag ) {
        const tagWords = tag.split( /\s+/ ).filter( Boolean )
        if ( tagWords.length >= 2 ) {
          const baseName = tagWords.slice( 0, 2 ).join( ' ' )
          company = await prisma.allaBolagCompany.findFirst( {
            where: {
              name: { contains: baseName },
            },
          } )
        }
      }

      // 5. By phone number digits
      if ( !company && phoneDigits && phoneDigits.length >= 7 ) {
        const last7 = phoneDigits.slice( -7 )
        company = await prisma.allaBolagCompany.findFirst( {
          where: {
            phone: { contains: last7 },
          },
        } )
      }

      if ( company ) {
        // Determine whether to save or upgrade telephone number:
        // 1. If company currently has no phone, save the newly found phone
        // 2. If newly found phone is a mobile number (e.g. 07x) and existing is landline, upgrade to mobile
        const isNewMobile = rawPhone ? /^(\+46\s*7|07)[02369]/.test( rawPhone.replace( /[\s.-]/g, '' ) ) : false
        const currentIsMobile = company.phone ? /^(\+46\s*7|07)[02369]/.test( company.phone.replace( /[\s.-]/g, '' ) ) : false

        let targetPhone = company.phone
        if ( !targetPhone && rawPhone ) {
          targetPhone = rawPhone
        } else if ( isNewMobile && !currentIsMobile && rawPhone ) {
          targetPhone = rawPhone
        }

        await prisma.allaBolagCompany.update( {
          where: { id: company.id },
          data: {
            website: website || company.website,
            googleMapsUrl: googleMapsUrl || company.googleMapsUrl,
            phone: targetPhone,
          },
        } )
        updatedCount++
        const parts = [
          website ? `Website: ${ website }` : null,
          targetPhone && targetPhone !== company.phone ? `Phone: ${ targetPhone }` : null,
          googleMapsUrl ? 'Maps URL' : null,
        ].filter( Boolean )
        enhancedCompanies.push( `${ company.name } -> ${ parts.join( ', ' ) || 'Updated' }` )
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
