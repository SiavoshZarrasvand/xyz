'use client'

import { Suspense, useMemo, useState } from 'react'
import { DirectoryView } from '@/components/DirectoryView'
import { ColumnDef } from '@/components/DataTable'

interface Exhibitor {
  id: string
  name: string
  stand: string | null
  whyVisit: string | null
  description: string | null
  website: string | null
  email: string | null
  phone: string | null
  street: string | null
  city: string | null
  postcode: string | null
  country: string | null
  address: string | null
  url: string | null
  contacted: boolean
  contactedAt: string | null
  createdAt: string
}

function InCosmeticsPageContent () {
  const [ expandedDescriptions, setExpandedDescriptions ] = useState<Record<string, boolean>>( {} )

  const columns: ColumnDef<Exhibitor>[] = useMemo( () => [
    {
      id: 'name',
      header: 'Company & Stand',
      headerClassName: 'w-[220px]',
      filter: { type: 'text', placeholder: 'Filter company...' },
      cell: ( exhibitor ) => (
        <div className="flex flex-col gap-1">
          { exhibitor.url ? (
            <a
              href={ exhibitor.url }
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
              title="Open in-cosmetics directory page"
            >
              <span>{ exhibitor.name }</span>
              <span className="opacity-0 group-hover:opacity-100 text-xs">↗</span>
            </a>
          ) : (
            <span className="font-semibold text-foreground">{ exhibitor.name }</span>
          ) }

          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            { exhibitor.stand && (
              <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-900/50">
                Stand { exhibitor.stand }
              </span>
            ) }
            { exhibitor.country && (
              <span className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                { exhibitor.country }
              </span>
            ) }
          </div>
        </div>
      ),
    },
    {
      id: 'description',
      header: 'Cosmetics Focus & Description',
      headerClassName: 'min-w-[320px]',
      filter: { type: 'text', placeholder: 'Filter focus & description...' },
      cell: ( exhibitor ) => {
        const isExpanded = Boolean( expandedDescriptions[ exhibitor.id ] )
        const descriptionText = exhibitor.description || ''
        const isLongDescription = descriptionText.length > 200

        return (
          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            { exhibitor.whyVisit && (
              <div className="mb-2 p-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-md">
                <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                  ⭐ Why visit our stand:
                </span>
                <p className="line-clamp-3 text-slate-700 dark:text-slate-300">{ exhibitor.whyVisit }</p>
              </div>
            ) }

            { descriptionText ? (
              <div>
                <p className={ isExpanded ? '' : 'line-clamp-3' }>{ descriptionText }</p>
                { isLongDescription && (
                  <button
                    type="button"
                    onClick={ () =>
                      setExpandedDescriptions( prev => ( {
                        ...prev,
                        [ exhibitor.id ]: !isExpanded,
                      } ) )
                    }
                    className="mt-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    { isExpanded ? 'Show less' : 'Read full description...' }
                  </button>
                ) }
              </div>
            ) : (
              <span className="text-muted-foreground italic">No detailed profile description provided.</span>
            ) }
          </div>
        )
      },
    },
    {
      id: 'phone',
      header: 'Phone',
      headerClassName: 'w-[160px]',
      filter: { type: 'text', placeholder: 'Filter phone...' },
      cell: ( exhibitor ) => (
        exhibitor.phone ? (
          <a
            href={ `tel:${ exhibitor.phone.replace( /\s/g, '' ) }` }
            className="text-xs font-medium text-foreground hover:text-primary hover:underline block truncate"
          >
            📞 { exhibitor.phone }
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'website',
      header: 'Website',
      headerClassName: 'w-[160px]',
      filter: { type: 'text', placeholder: 'Filter website...' },
      cell: ( exhibitor ) => (
        exhibitor.website ? (
          <a
            href={ exhibitor.website.startsWith( 'http' ) ? exhibitor.website : `https://${ exhibitor.website }` }
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block"
          >
            🌐 { exhibitor.website.replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' ) }
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'email',
      header: 'Email',
      headerClassName: 'w-[170px]',
      filter: { type: 'text', placeholder: 'Filter email...' },
      cell: ( exhibitor ) => (
        exhibitor.email ? (
          <a
            href={ `mailto:${ exhibitor.email }` }
            className="text-xs text-primary hover:underline truncate block"
          >
            ✉️ { exhibitor.email }
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'city',
      header: 'Location',
      headerClassName: 'w-[160px]',
      filter: { type: 'text', placeholder: 'Filter city / country...' },
      cell: ( exhibitor ) => (
        <div className="flex flex-col text-xs">
          { exhibitor.country && <span className="font-medium text-foreground">{ exhibitor.country }</span> }
          { exhibitor.city && <span className="text-muted-foreground">{ exhibitor.city }</span> }
          { !exhibitor.country && !exhibitor.city && <span className="text-muted-foreground">-</span> }
        </div>
      ),
    },
  ], [ expandedDescriptions ] )

  return (
    <DirectoryView<Exhibitor>
      title="In-Cosmetics Global Directory"
      subtitle="Exhibitor directory, company descriptions, booth stands, and commercial contacts"
      activeNav="in-cosmetics"
      apiEndpoint="/api/in-cosmetics"
      itemsKey="exhibitors"
      sseEvents={ [ 'INCOSMETICS_UPDATED', 'INCOSMETICS_DELETED' ] }
      columns={ columns }
      csvHeaders={ [ 'Name', 'Stand', 'Country', 'City', 'Phone', 'Website', 'Email', 'Why Visit', 'Description', 'URL', 'Contacted' ] }
      csvRowMapper={ ( e ) => [ e.name, e.stand, e.country, e.city, e.phone, e.website, e.email, e.whyVisit, e.description, e.url, e.contacted ? 'Yes' : 'No' ] }
      csvFilenamePrefix="in-cosmetics-exhibitors"
      primaryFilterConfig={ {
        paramName: 'country',
        responseKey: 'countries',
        allLabel: 'All Countries',
      } }
      enabledQuickFilters={ { email: true, phone: true, website: true, pending: true } }
      emptyMessage="No in-cosmetics exhibitors match your filters."
    />
  )
}

export default function InCosmeticsPage () {
  return (
    <Suspense fallback={ <div className="min-h-screen p-8 text-center text-muted-foreground">Loading In-Cosmetics CRM...</div> }>
      <InCosmeticsPageContent />
    </Suspense>
  )
}
