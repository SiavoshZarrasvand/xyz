import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import Papa from 'papaparse'
import JSZip from 'jszip'

interface CSVRow {
  Name: string
  Rating: string
  Reviews: string
  Category: string
  Tag?: string
  Address: string
  Phone: string
  Email: string
  Website: string
  Hours: string
  'Google Maps URL': string
}

export async function POST ( request: NextRequest ) {
  try {
    const formData = await request.formData()
    const files = formData.getAll( 'files' ) as File[]

    if ( !files || files.length === 0 ) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    let totalContacts = 0
    let newContacts = 0
    let updatedContacts = 0
    const allCsvContent: string[] = []

    // Process each file
    for ( const file of files ) {
      const buffer = await file.arrayBuffer()
      const fileContent = Buffer.from( buffer )

      if ( file.name.endsWith( '.zip' ) ) {
        // Extract ZIP and get CSV files
        const zip = await JSZip.loadAsync( fileContent )
        const csvFiles = Object.keys( zip.files ).filter(
          ( name ) => name.endsWith( '.csv' ) && !name.startsWith( '__MACOSX' )
        )

        for ( const csvFileName of csvFiles ) {
          const csvFile = zip.files[ csvFileName ]
          const csvText = await csvFile.async( 'text' )
          allCsvContent.push( csvText )
        }
      } else if ( file.name.endsWith( '.csv' ) ) {
        // Process CSV directly
        const csvText = fileContent.toString( 'utf-8' )
        allCsvContent.push( csvText )
      }
    }

    const byPhone = new Map<string, {
      name: string
      phone: string
      email: string | null
      website: string | null
      address: string | null
      category: string | null
      tag: string | null
      rating: number | null
      reviews: number | null
      googleMapsUrl: string | null
    }>()

    // Parse and collect all CSV content
    for ( const csvText of allCsvContent ) {
      const parseResult = Papa.parse<CSVRow>( csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: ( header ) => header.trim(),
      } )

      for ( const row of parseResult.data ) {
        if ( !row.Name || !row.Phone ) continue

        const phone = row.Phone.trim()
        if ( !phone ) continue

        byPhone.set( phone, {
          name: row.Name.trim(),
          phone,
          email: row.Email?.trim() || null,
          website: row.Website?.trim() || null,
          address: row.Address?.trim() || null,
          category: row.Category?.trim() || null,
          tag: row.Tag?.trim() || null,
          rating: row.Rating ? parseFloat( row.Rating ) : null,
          reviews: row.Reviews ? parseInt( row.Reviews, 10 ) : null,
          googleMapsUrl: row[ 'Google Maps URL' ]?.trim() || null,
        } )
      }
    }

    const pending = [ ...byPhone.values() ]

    if ( pending.length > 0 ) {
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

      updatedContacts = pending.filter( c => existingPhones.has( c.phone ) ).length
      newContacts = pending.length - updatedContacts
      totalContacts = pending.length
    }

    return NextResponse.json( {
      success: true,
      summary: {
        totalProcessed: totalContacts,
        newContacts,
        updatedContacts,
      },
    } )
  } catch ( error ) {
    console.error( 'Upload error:', error )
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    )
  }
}
