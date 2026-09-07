'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable, ColumnDef } from '@/components/DataTable'

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

interface CountryInfo {
  name: string
  count: number
}

function InCosmeticsContent () {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ exhibitors, setExhibitors ] = useState<Exhibitor[]>( [] )
  const [ loading, setLoading ] = useState( true )
  const [ countries, setCountries ] = useState<CountryInfo[]>( [] )
  const [ stats, setStats ] = useState( { total: 0, contacted: 0, pending: 0 } )
  const [ search, setSearch ] = useState( searchParams.get( 'search' ) || '' )
  const [ onlyPending, setOnlyPending ] = useState(
    searchParams.get( 'contacted' ) === 'false'
  )
  const [ countryFilter, setCountryFilter ] = useState<string>(
    searchParams.get( 'country' ) || 'all'
  )
  const [ hasEmail, setHasEmail ] = useState<boolean | null>( null )
  const [ hasPhone, setHasPhone ] = useState<boolean | null>( null )
  const [ hasWebsite, setHasWebsite ] = useState<boolean | null>( null )
  const [ columnFilters, setColumnFilters ] = useState<Record<string, string>>( {} )

  const [ page, setPage ] = useState( 1 )
  const [ totalPages, setTotalPages ] = useState( 1 )
  const [ expandedDescriptions, setExpandedDescriptions ] = useState<Record<string, boolean>>( {} )
  const [ isClearing, setIsClearing ] = useState( false )

  const handleClearFilters = () => {
    setSearch( '' )
    setOnlyPending( false )
    setCountryFilter( 'all' )
    setHasEmail( null )
    setHasPhone( null )
    setHasWebsite( null )
    setColumnFilters( {} )
    setPage( 1 )
  }

  const handleColumnFilterChange = ( columnId: string, value: string ) => {
    if ( columnId === 'country' ) {
      setCountryFilter( value )
    } else {
      setColumnFilters( prev => ( { ...prev, [ columnId ]: value } ) )
    }
    setPage( 1 )
  }

  const fetchExhibitors = useCallback( async ( isInitial = false ) => {
    if ( isInitial ) setLoading( true )
    try {
      const params = new URLSearchParams( {
        page: page.toString(),
        limit: '50',
        ...( onlyPending ? { contacted: 'false' } : {} ),
        ...( countryFilter !== 'all' ? { country: countryFilter } : {} ),
        ...( search ? { search } : {} ),
        ...( hasEmail !== null ? { hasEmail: String( hasEmail ) } : {} ),
        ...( hasPhone !== null ? { hasPhone: String( hasPhone ) } : {} ),
        ...( hasWebsite !== null ? { hasWebsite: String( hasWebsite ) } : {} ),
        ...( columnFilters.name ? { name: columnFilters.name } : {} ),
        ...( columnFilters.stand ? { stand: columnFilters.stand } : {} ),
        ...( columnFilters.description ? { description: columnFilters.description } : {} ),
        ...( columnFilters.phone ? { phone: columnFilters.phone } : {} ),
        ...( columnFilters.website ? { website: columnFilters.website } : {} ),
        ...( columnFilters.email ? { email: columnFilters.email } : {} ),
        ...( columnFilters.city ? { city: columnFilters.city } : {} ),
      } )

      const response = await fetch( `/api/in-cosmetics?${ params }` )
      const data = await response.json()
      setExhibitors( data.exhibitors || [] )
      setCountries( data.countries || [] )
      setStats( data.stats || { total: 0, contacted: 0, pending: 0 } )
      setTotalPages( data.pagination?.totalPages || 1 )
    } catch ( error ) {
      console.error( 'Failed to fetch exhibitors:', error )
    } finally {
      if ( isInitial ) setLoading( false )
    }
  }, [
    onlyPending,
    countryFilter,
    page,
    search,
    hasEmail,
    hasPhone,
    hasWebsite,
    columnFilters,
  ] )

  useEffect( () => {
    fetchExhibitors( true )

    const eventSource = new EventSource( '/api/events' )
    eventSource.onmessage = ( event ) => {
      try {
        const payload = JSON.parse( event.data )
        if ( payload.type === 'INCOSMETICS_UPDATED' || payload.type === 'INCOSMETICS_DELETED' ) {
          fetchExhibitors( false )
        }
      } catch ( err ) {
        console.error( 'Failed to parse SSE payload:', err )
      }
    }

    const pollInterval = setInterval( () => {
      fetchExhibitors( false )
    }, 2500 )

    return () => {
      eventSource.close()
      clearInterval( pollInterval )
    }
  }, [ fetchExhibitors ] )

  const toggleContacted = async ( id: string, currentStatus: boolean ) => {
    try {
      setExhibitors( prev =>
        prev.map( e => ( e.id === id ? { ...e, contacted: !currentStatus } : e ) )
      )

      await fetch( '/api/in-cosmetics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { id, contacted: !currentStatus } ),
      } )
    } catch ( error ) {
      console.error( 'Failed to toggle contacted status:', error )
      setExhibitors( prev =>
        prev.map( e => ( e.id === id ? { ...e, contacted: currentStatus } : e ) )
      )
    }
  }

  const handleDelete = async ( id: string, name: string ) => {
    if ( !confirm( `Delete exhibitor "${ name }"?` ) ) return
    try {
      const res = await fetch( `/api/in-cosmetics?id=${ id }`, { method: 'DELETE' } )
      if ( res.ok ) fetchExhibitors( false )
    } catch ( err ) {
      console.error( 'Failed to delete exhibitor:', err )
    }
  }

  const handleClearAll = async () => {
    if ( !confirm( 'Are you sure you want to clear all in-cosmetics exhibitors? This cannot be undone.' ) ) return
    setIsClearing( true )
    try {
      const res = await fetch( '/api/in-cosmetics?all=true', { method: 'DELETE' } )
      if ( res.ok ) fetchExhibitors( false )
    } catch ( err ) {
      console.error( 'Failed to clear exhibitors:', err )
    } finally {
      setIsClearing( false )
    }
  }

  const handleExportCsv = () => {
    if ( exhibitors.length === 0 ) return
    const headers = [ 'Name', 'Stand', 'Country', 'City', 'Phone', 'Website', 'Email', 'Why Visit', 'Description', 'URL', 'Contacted' ]
    const escape = ( v: unknown ) => ( v ? `"${ String( v ).replace( /"/g, '""' ) }"` : '""' )
    const rows = exhibitors.map( e => [
      escape( e.name ),
      escape( e.stand ),
      escape( e.country ),
      escape( e.city ),
      escape( e.phone ),
      escape( e.website ),
      escape( e.email ),
      escape( e.whyVisit ),
      escape( e.description ),
      escape( e.url ),
      escape( e.contacted ? 'Yes' : 'No' ),
    ].join( ',' ) )
    const csvContent = '\uFEFF' + [ headers.join( ',' ), ...rows ].join( '\n' )
    const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } )
    const url = URL.createObjectURL( blob )
    const a = document.createElement( 'a' )
    a.href = url
    a.download = `in-cosmetics-exhibitors-${ new Date().toISOString().slice( 0, 10 ) }.csv`
    a.click()
    URL.revokeObjectURL( url )
  }

  // Schema-driven columns definition
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={ () => router.push( '/' ) }
              className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              XYZ
            </button>
            <nav className="flex items-center gap-2">
              <button
                onClick={ () => router.push( '/contacts' ) }
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Maps Contacts
              </button>
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-muted/60 text-foreground border border-border">
                In-Cosmetics Global
              </span>
              <button
                onClick={ () => router.push( '/alla-bolag' ) }
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                🇸🇪 Alla Bolag
              </button>
            </nav>
          </div>
          <button
            onClick={ () => router.push( '/' ) }
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Home
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="space-y-6">
          {/* Title & Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">In-Cosmetics Global Directory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Exhibitor directory, company descriptions, booth stands, and commercial contacts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-muted/50 border border-border rounded-lg text-xs font-semibold text-foreground">
                Total: { stats.total }
              </span>
              <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                Contacted: { stats.contacted }
              </span>
              <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-300">
                Pending: { stats.pending }
              </span>
            </div>
          </div>

          <DataTable<Exhibitor>
            columns={ columns }
            data={ exhibitors }
            loading={ loading }
            emptyMessage="No in-cosmetics exhibitors match your filters."
            total={ stats.total }
            contactedCount={ stats.contacted }
            pendingCount={ stats.pending }
            search={ search }
            onSearchChange={ ( val ) => {
              setSearch( val )
              setPage( 1 )
            } }
            searchPlaceholder="Global search name, stand, phone, email, country, description..."
            primaryFilter={ {
              value: countryFilter,
              onChange: ( val ) => {
                setCountryFilter( val )
                setPage( 1 )
              },
              options: [
                { label: 'All Countries', value: 'all' },
                ...countries.map( c => ( { label: `${ c.name } (${ c.count })`, value: c.name } ) ),
              ],
            } }
            quickFilters={ {
              hasEmail: {
                value: hasEmail,
                onChange: ( val ) => {
                  setHasEmail( val )
                  setPage( 1 )
                },
              },
              hasPhone: {
                value: hasPhone,
                onChange: ( val ) => {
                  setHasPhone( val )
                  setPage( 1 )
                },
              },
              hasWebsite: {
                value: hasWebsite,
                onChange: ( val ) => {
                  setHasWebsite( val )
                  setPage( 1 )
                },
              },
              onlyPending: {
                value: onlyPending,
                onChange: ( val ) => {
                  setOnlyPending( val )
                  setPage( 1 )
                },
              },
            } }
            columnFilters={ {
              ...columnFilters,
              country: countryFilter,
            } }
            onColumnFilterChange={ handleColumnFilterChange }
            onClearAllFilters={ handleClearFilters }
            onExportCsv={ handleExportCsv }
            onClearAll={ handleClearAll }
            clearAllLabel="Clear All"
            isClearing={ isClearing }
            onToggleContacted={ toggleContacted }
            onDeleteItem={ ( id, item ) => handleDelete( id, item.name ) }
            page={ page }
            totalPages={ totalPages }
            onPageChange={ setPage }
          />
        </div>
      </main>
    </div>
  )
}

export default function InCosmeticsPage () {
  return (
    <Suspense fallback={ <div className="min-h-screen p-8 text-center text-muted-foreground">Loading In-Cosmetics CRM...</div> }>
      <InCosmeticsContent />
    </Suspense>
  )
}
