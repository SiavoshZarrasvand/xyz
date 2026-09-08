'use client'

import { Suspense, useMemo, useState } from 'react'
import { DirectoryView } from '@/components/DirectoryView'
import { ColumnDef } from '@/components/DataTable'
import { PhoneCell } from '@/components/PhoneCell'
import { EditableEmailCell } from '@/components/EditableEmailCell'
import { EditableWebsiteCell } from '@/components/EditableWebsiteCell'

interface Company {
  id: string
  name: string
  orgnr: string | null
  phone: string | null
  email: string | null
  website: string | null
  googleMapsUrl: string | null
  street: string | null
  postcode: string | null
  city: string | null
  address: string | null
  url: string | null
  contacted: boolean
  contactedAt: string | null
  createdAt: string
}

function AllaBolagPageContent () {
  const [ copiedId, setCopiedId ] = useState<string | null>( null )

  const copyToClipboard = ( text: string, id: string ) => {
    navigator.clipboard.writeText( text )
    setCopiedId( id )
    setTimeout( () => setCopiedId( null ), 2000 )
  }

  const columns: ColumnDef<Company>[] = useMemo( () => [
    {
      id: 'name',
      header: 'Company',
      headerClassName: 'w-[260px]',
      filter: { type: 'text', placeholder: 'Filter company...' },
      cell: ( c ) => (
        c.url ? (
          <a
            href={ c.url }
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
            title="Open allabolag.se page"
          >
            <span>{ c.name }</span>
            <span className="opacity-0 group-hover:opacity-100 text-xs">↗</span>
          </a>
        ) : (
          <span className="font-semibold text-foreground">{ c.name }</span>
        )
      ),
    },
    {
      id: 'orgnr',
      header: 'Org.nr',
      headerClassName: 'w-[150px]',
      filter: { type: 'text', placeholder: 'Filter org.nr...' },
      cell: ( c ) => (
        c.orgnr ? (
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 font-mono font-medium text-xs">
            { c.orgnr }
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'phone',
      header: 'Telefon',
      headerClassName: 'w-[180px]',
      filter: { type: 'text', placeholder: 'Filter telefon...' },
      cell: ( c ) => (
        <PhoneCell
          phone={ c.phone }
          id={ c.id }
          apiEndpoint="/api/alla-bolag"
          copiedId={ copiedId }
          onCopy={ copyToClipboard }
        />
      ),
    },
    {
      id: 'website',
      header: 'Website',
      headerClassName: 'w-[180px]',
      filter: { type: 'text', placeholder: 'Filter website...' },
      cell: ( c ) => (
        <EditableWebsiteCell
          id={ c.id }
          website={ c.website }
          apiEndpoint="/api/alla-bolag"
        />
      ),
    },
    {
      id: 'googleMapsUrl',
      header: 'Maps',
      headerClassName: 'w-[70px] text-center',
      className: 'text-center',
      cell: ( c ) => (
        c.googleMapsUrl ? (
          <a
            href={ c.googleMapsUrl }
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold inline-block p-1 text-sm"
            title="Open listing on Google Maps"
          >
            ↗
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'email',
      header: 'E-post',
      headerClassName: 'w-[200px]',
      filter: { type: 'text', placeholder: 'Filter e-post...' },
      cell: ( c ) => (
        <EditableEmailCell
          id={ c.id }
          email={ c.email }
          apiEndpoint="/api/alla-bolag"
          copiedId={ copiedId }
          onCopy={ copyToClipboard }
        />
      ),
    },
    {
      id: 'address',
      header: 'Address',
      headerClassName: 'min-w-[220px]',
      filter: { type: 'text', placeholder: 'Filter address...' },
      cell: ( c ) => (
        c.address ? (
          <span className="text-xs text-muted-foreground line-clamp-1">{ c.address }</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'city',
      header: 'City / Ort',
      headerClassName: 'w-[140px]',
      cell: ( c ) => (
        c.city ? (
          <span className="text-xs font-medium text-foreground">{ c.city }</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
  ], [ copiedId ] )

  return (
    <DirectoryView<Company>
      title="Alla Bolag Directory"
      subtitle="Swedish enterprise records extracted from allabolag.se"
      activeNav="alla-bolag"
      apiEndpoint="/api/alla-bolag"
      itemsKey="companies"
      sseEvents={ [ 'ALLABOLAG_UPDATED', 'ALLABOLAG_DELETED' ] }
      columns={ columns }
      csvHeaders={ [ 'Name', 'Org.nr', 'Telefon', 'Website', 'Google Maps URL', 'E-post', 'Address', 'Street', 'Postcode', 'City', 'URL', 'Contacted' ] }
      csvRowMapper={ ( c ) => [ c.name, c.orgnr, c.phone, c.website, c.googleMapsUrl, c.email, c.address, c.street, c.postcode, c.city, c.url, c.contacted ? 'Yes' : 'No' ] }
      csvFilenamePrefix="alla-bolag-companies"
      primaryFilterConfig={ {
        paramName: 'city',
        responseKey: 'cities',
        allLabel: 'All Cities',
      } }
      enabledQuickFilters={ { email: true, phone: true, website: true, maps: true, pending: true } }
      emptyMessage="No companies match your filters. Run the Alla Bolag Extractor extension on allabolag.se or adjust filters."
    />
  )
}

export default function AllaBolagPage () {
  return (
    <Suspense fallback={ <div className="min-h-screen p-8 text-center text-muted-foreground">Loading Alla Bolag CRM...</div> }>
      <AllaBolagPageContent />
    </Suspense>
  )
}
