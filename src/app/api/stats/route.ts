import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET () {
  try {
    const [
      mapsTotal,
      mapsContacted,
      inCosmeticsTotal,
      inCosmeticsContacted,
      allaBolagTotal,
      allaBolagContacted,
    ] = await Promise.all( [
      prisma.contact.count(),
      prisma.contact.count( { where: { contacted: true } } ),
      prisma.inCosmeticsExhibitor.count(),
      prisma.inCosmeticsExhibitor.count( { where: { contacted: true } } ),
      prisma.allaBolagCompany.count(),
      prisma.allaBolagCompany.count( { where: { contacted: true } } ),
    ] )

    return NextResponse.json( {
      maps: {
        total: mapsTotal,
        contacted: mapsContacted,
        pending: mapsTotal - mapsContacted,
      },
      inCosmetics: {
        total: inCosmeticsTotal,
        contacted: inCosmeticsContacted,
        pending: inCosmeticsTotal - inCosmeticsContacted,
      },
      allaBolag: {
        total: allaBolagTotal,
        contacted: allaBolagContacted,
        pending: allaBolagTotal - allaBolagContacted,
      },
      // Backward compatibility fields
      total: mapsTotal,
      contacted: mapsContacted,
      notContacted: mapsTotal - mapsContacted,
    } )
  } catch ( error ) {
    console.error( 'Get stats error:', error )
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
