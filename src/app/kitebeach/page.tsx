'use client'

import { Suspense, useMemo } from 'react'
import { DirectoryView } from '@/components/DirectoryView'
import { ColumnDef } from '@/components/DataTable'
import { PhoneCell } from '@/components/PhoneCell'
import { EditableWebsiteCell } from '@/components/EditableWebsiteCell'
import { EditableEmailCell } from '@/components/EditableEmailCell'

interface KiteBeachSupplier {
  id: string
  name: string
  destination: string | null
  spot: string | null
  beach: string | null
  city: string | null
  state: string | null
  country: string | null
  category: string | null
  phone: string | null
  email: string | null
  website: string | null
  instagram: string | null
  address: string | null
  rating: number | null
  reviews: number | null
  googleMapsUrl: string | null
  hours: string | null
  tag: string | null
  notes: string | null
  contacted: boolean
  contactedAt: string | null
  createdAt: string
}

const COUNTRY_FLAGS: Record<string, string> = {
  Brazil: '🇧🇷',
  Morocco: '🇲🇦',
  'Cape Verde': '🇨🇻',
  Mexico: '🇲🇽',
  Portugal: '🇵🇹',
  'Dominican Republic': '🇩🇴',
  Colombia: '🇨🇴',
  Mauritius: '🇲🇺',
  Tanzania: '🇹🇿',
  Kenya: '🇰🇪',
  Aruba: '🇦🇼',
  Bonaire: '🇧🇶',
  Curaçao: '🇨🇼',
  Barbados: '🇧🇧',
  'Costa Rica': '🇨🇷',
  Panama: '🇵🇦',
  USA: '🇺🇸',
  Australia: '🇦🇺',
  Spain: '🇪🇸',
  Greece: '🇬🇷',
  Egypt: '🇪🇬',
  Italy: '🇮🇹',
  France: '🇫🇷',
  'South Africa': '🇿🇦',
  Vietnam: '🇻🇳',
  Philippines: '🇵🇭',
  Thailand: '🇹🇭',
  'Sri Lanka': '🇱🇰',
  Peru: '🇵🇪',
  Venezuela: '🇻🇪',
}

function KiteBeachPageContent () {
  const columns: ColumnDef<KiteBeachSupplier>[] = useMemo( () => [
    {
      id: 'name',
      header: 'Supplier / Business',
      filter: { type: 'text', placeholder: 'Filter name...' },
      cell: ( item ) => (
        <div className="flex flex-col">
          { item.googleMapsUrl ? (
            <a
              href={ item.googleMapsUrl }
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
              title="Open Google Maps listing"
            >
              <span>{ item.name }</span>
              <span className="opacity-0 group-hover:opacity-100 text-xs text-primary">↗</span>
            </a>
          ) : (
            <span className="font-medium text-foreground">{ item.name }</span>
          ) }
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            { item.tag && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded border border-blue-100 dark:border-blue-800">
                { item.tag }
              </span>
            ) }
            { item.address && (
              <span className="text-xs text-muted-foreground line-clamp-1" title={ item.address }>
                { item.address }
              </span>
            ) }
          </div>
        </div>
      ),
    },
    {
      id: 'country',
      header: 'Country',
      filter: { type: 'text', placeholder: 'Filter country...' },
      cell: ( item ) => (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="text-base">{ ( item.country && COUNTRY_FLAGS[ item.country ] ) || '🌐' }</span>
          <span>{ item.country || '-' }</span>
        </div>
      ),
    },
    {
      id: 'destination',
      header: 'Destination',
      filter: { type: 'text', placeholder: 'Filter destination...' },
      cell: ( item ) => (
        item.destination ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 w-fit">
              <span>📍</span>
              <span>{ item.destination }</span>
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs italic">-</span>
        )
      ),
    },
    {
      id: 'spot',
      header: 'Spot',
      filter: { type: 'text', placeholder: 'Filter spot...' },
      cell: ( item ) => (
        ( item.spot || item.beach ) ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 w-fit">
                <span>🏖️</span>
                <span>{ item.spot || item.beach }</span>
              </span>
              { item.state && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                  { item.state }
                </span>
              ) }
            </div>
            { item.city && item.city.toLowerCase() !== ( item.spot || item.beach || '' ).toLowerCase() && (
              <span className="text-[11px] text-muted-foreground ml-1">
                { item.city }
              </span>
            ) }
          </div>
        ) : (
          <span className="text-muted-foreground text-xs italic">Unknown spot</span>
        )
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ( item ) => (
        item.rating ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-amber-500">★</span>
            <span className="font-semibold text-foreground">{ item.rating.toFixed( 1 ) }</span>
            { item.reviews !== null && (
              <span className="text-muted-foreground">({ item.reviews })</span>
            ) }
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'category',
      header: 'Category',
      filter: { type: 'text', placeholder: 'Filter category...' },
      cell: ( item ) => (
        item.category ? (
          <span className="text-xs text-muted-foreground max-w-[180px] truncate block" title={ item.category }>
            { item.category }
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'phone',
      header: 'Phone / WhatsApp',
      filter: { type: 'text', placeholder: 'Filter phone...' },
      cell: ( item ) => (
        <PhoneCell
          phone={ item.phone }
          id={ item.id }
          apiEndpoint="/api/kitebeach"
        />
      ),
    },
    {
      id: 'website',
      header: 'Website',
      filter: { type: 'text', placeholder: 'Filter website...' },
      cell: ( item ) => (
        <EditableWebsiteCell
          id={ item.id }
          website={ item.website }
          apiEndpoint="/api/kitebeach"
        />
      ),
    },
    {
      id: 'instagram',
      header: 'Instagram',
      cell: ( item ) => {
        if ( !item.instagram ) {
          return <span className="text-muted-foreground text-xs">-</span>
        }
        const cleanHandle = item.instagram.startsWith( '@' ) ? item.instagram.slice( 1 ) : item.instagram
        const profileUrl = `https://instagram.com/${ cleanHandle }`
        return (
          <a
            href={ profileUrl }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-pink-600 dark:text-pink-400 hover:underline font-medium"
            title={`View Instagram profile ${ item.instagram }`}
          >
            <span>📸</span>
            <span>{ item.instagram.startsWith( '@' ) ? item.instagram : `@${ item.instagram }` }</span>
          </a>
        )
      },
    },
    {
      id: 'email',
      header: 'Email',
      filter: { type: 'text', placeholder: 'Filter email...' },
      cell: ( item ) => (
        <EditableEmailCell
          id={ item.id }
          email={ item.email }
          apiEndpoint="/api/kitebeach"
        />
      ),
    },
  ], [] )

  return (
    <DirectoryView<KiteBeachSupplier>
      title="Kite Beach Directory"
      subtitle="Global kite schools, rental centres, wingfoil clubs, and kite camps across premier destinations"
      activeNav="kitebeach"
      apiEndpoint="/api/kitebeach"
      itemsKey="suppliers"
      sseEvents={ [ 'KITE_BEACH_UPDATED', 'KITE_BEACH_DELETED' ] }
      columns={ columns }
      csvHeaders={ [ 'Name', 'Country', 'Destination', 'Spot', 'City', 'State', 'Category', 'Rating', 'Reviews', 'Phone', 'Website', 'Instagram', 'Email', 'Address', 'Google Maps URL', 'Contacted' ] }
      csvRowMapper={ ( s ) => [
        s.name,
        s.country,
        s.destination,
        s.spot || s.beach,
        s.city,
        s.state,
        s.category,
        s.rating,
        s.reviews,
        s.phone,
        s.website,
        s.instagram,
        s.email,
        s.address,
        s.googleMapsUrl,
        s.contacted ? 'Yes' : 'No',
      ] }
      csvFilenamePrefix="kite-beach-suppliers"
      primaryFilterConfig={ {
        paramName: 'beach',
        responseKey: 'beaches',
        allLabel: 'All Spots / Beaches',
      } }
      enabledQuickFilters={ { phone: true, website: true, email: true, pending: true } }
      emptyMessage="No kite suppliers found. Run Google Maps Extractor pointing to /api/kitebeach to populate."
    />
  )
}

export default function KiteBeachPage () {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Kite Beach Directory...</div>}>
      <KiteBeachPageContent />
    </Suspense>
  )
}
