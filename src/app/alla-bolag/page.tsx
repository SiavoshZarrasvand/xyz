'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable, ColumnDef } from '@/components/DataTable'

interface Company {
  id: string
  name: string
  orgnr: string | null
  phone: string | null
  email: string | null
  street: string | null
  postcode: string | null
  city: string | null
  address: string | null
  url: string | null
  contacted: boolean
  contactedAt: string | null
  createdAt: string
}

interface CityInfo {
  name: string
  count: number
}

function AllaBolagContent () {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ companies, setCompanies ] = useState<Company[]>( [] )
  const [ cities, setCities ] = useState<CityInfo[]>( [] )
  const [ total, setTotal ] = useState( 0 )
  const [ contactedCount, setContactedCount ] = useState( 0 )
  const [ pendingCount, setPendingCount ] = useState( 0 )
  const [ loading, setLoading ] = useState( true )
  const [ isClearing, setIsClearing ] = useState( false )
  const [ search, setSearch ] = useState( '' )
  const [ onlyPending, setOnlyPending ] = useState<boolean>(
    searchParams.get( 'pending' ) === 'true' || searchParams.get( 'contacted' ) === 'false'
  )
  const [ cityFilter, setCityFilter ] = useState<string>(
    searchParams.get( 'city' ) || 'all'
  )
  const [ hasEmail, setHasEmail ] = useState<boolean | null>( null )
  const [ hasPhone, setHasPhone ] = useState<boolean | null>( null )
  const [ columnFilters, setColumnFilters ] = useState<Record<string, string>>( {} )

  const [ page, setPage ] = useState( 1 )
  const [ totalPages, setTotalPages ] = useState( 1 )
  const [ copiedId, setCopiedId ] = useState<string | null>( null )

  const copyToClipboard = ( text: string, id: string ) => {
    navigator.clipboard.writeText( text )
    setCopiedId( id )
    setTimeout( () => setCopiedId( null ), 2000 )
  }

  const handleClearFilters = () => {
    setSearch( '' )
    setOnlyPending( false )
    setCityFilter( 'all' )
    setHasEmail( null )
    setHasPhone( null )
    setColumnFilters( {} )
    setPage( 1 )
  }

  const handleColumnFilterChange = ( columnId: string, value: string ) => {
    if ( columnId === 'city' ) {
      setCityFilter( value )
    } else {
      setColumnFilters( prev => ( { ...prev, [ columnId ]: value } ) )
    }
    setPage( 1 )
  }

  const fetchCompanies = useCallback( async ( isInitial = false ) => {
    if ( isInitial ) setLoading( true )
    try {
      const params = new URLSearchParams( {
        page: page.toString(),
        limit: '50',
        ...( onlyPending ? { contacted: 'false' } : {} ),
        ...( cityFilter !== 'all' ? { city: cityFilter } : {} ),
        ...( search ? { search } : {} ),
        ...( hasEmail !== null ? { hasEmail: String( hasEmail ) } : {} ),
        ...( hasPhone !== null ? { hasPhone: String( hasPhone ) } : {} ),
        ...( columnFilters.name ? { name: columnFilters.name } : {} ),
        ...( columnFilters.orgnr ? { orgnr: columnFilters.orgnr } : {} ),
        ...( columnFilters.phone ? { phone: columnFilters.phone } : {} ),
        ...( columnFilters.email ? { email: columnFilters.email } : {} ),
        ...( columnFilters.address ? { address: columnFilters.address } : {} ),
      } )

      const response = await fetch( `/api/alla-bolag?${ params }` )
      const data = await response.json()
      setCompanies( data.companies || [] )
      setCities( data.cities || [] )
      setTotal( data.stats?.total || 0 )
      setContactedCount( data.stats?.contacted || 0 )
      setPendingCount( data.stats?.pending || 0 )
      setTotalPages( data.pagination?.totalPages || 1 )
    } catch ( error ) {
      console.error( 'Failed to fetch Alla Bolag companies:', error )
    } finally {
      if ( isInitial ) setLoading( false )
    }
  }, [
    onlyPending,
    cityFilter,
    page,
    search,
    hasEmail,
    hasPhone,
    columnFilters,
  ] )

  useEffect( () => {
    fetchCompanies( true )

    const eventSource = new EventSource( '/api/events' )
    eventSource.onmessage = ( event ) => {
      try {
        const payload = JSON.parse( event.data )
        if ( payload.type === 'ALLABOLAG_UPDATED' || payload.type === 'ALLABOLAG_DELETED' ) {
          fetchCompanies( false )
        }
      } catch ( err ) {
        console.error( 'SSE parse error:', err )
      }
    }

    const pollInterval = setInterval( () => {
      fetchCompanies( false )
    }, 2500 )

    return () => {
      eventSource.close()
      clearInterval( pollInterval )
    }
  }, [ fetchCompanies ] )

  const toggleContacted = async ( id: string, currentStatus: boolean ) => {
    try {
      setCompanies( prev =>
        prev.map( c => ( c.id === id ? { ...c, contacted: !currentStatus } : c ) )
      )

      const response = await fetch( '/api/alla-bolag', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { id, contacted: !currentStatus } ),
      } )

      if ( !response.ok ) {
        setCompanies( prev =>
          prev.map( c => ( c.id === id ? { ...c, contacted: currentStatus } : c ) )
        )
      }
    } catch ( error ) {
      console.error( 'Failed to toggle contacted status:', error )
      setCompanies( prev =>
        prev.map( c => ( c.id === id ? { ...c, contacted: currentStatus } : c ) )
      )
    }
  }

  const handleDelete = async ( id: string, name: string ) => {
    if ( !confirm( `Delete company "${ name }"?` ) ) return
    try {
      const res = await fetch( `/api/alla-bolag?id=${ id }`, { method: 'DELETE' } )
      if ( res.ok ) fetchCompanies( false )
    } catch ( err ) {
      console.error( 'Failed to delete company:', err )
    }
  }

  const handleExportCsv = () => {
    if ( companies.length === 0 ) return
    const headers = [ 'Name', 'Org.nr', 'Telefon', 'E-post', 'Address', 'Street', 'Postcode', 'City', 'URL', 'Contacted' ]
    const escape = ( v: unknown ) => ( v ? `"${ String( v ).replace( /"/g, '""' ) }"` : '""' )
    const rows = companies.map( c => [
      escape( c.name ),
      escape( c.orgnr ),
      escape( c.phone ),
      escape( c.email ),
      escape( c.address ),
      escape( c.street ),
      escape( c.postcode ),
      escape( c.city ),
      escape( c.url ),
      escape( c.contacted ? 'Yes' : 'No' ),
    ].join( ',' ) )
    const csvContent = '\uFEFF' + [ headers.join( ',' ), ...rows ].join( '\n' )
    const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } )
    const url = URL.createObjectURL( blob )
    const a = document.createElement( 'a' )
    a.href = url
    a.download = `alla-bolag-companies-${ new Date().toISOString().slice( 0, 10 ) }.csv`
    a.click()
    URL.revokeObjectURL( url )
  }

  const handleClearAll = async () => {
    if ( !confirm( 'Are you sure you want to clear all Alla Bolag companies? This cannot be undone.' ) ) return
    setIsClearing( true )
    try {
      const res = await fetch( '/api/alla-bolag?all=true', { method: 'DELETE' } )
      if ( res.ok ) fetchCompanies( false )
    } catch ( err ) {
      console.error( 'Failed to clear companies:', err )
    } finally {
      setIsClearing( false )
    }
  }

  // Define schema-driven columns
  const columns: ColumnDef<Company>[] = useMemo( () => [
    {
      id: 'name',
      header: 'Company',
      headerClassName: 'w-[260px]',
      filter: { type: 'text', placeholder: 'Filter company...' },
      cell: ( company ) => (
        company.url ? (
          <a
            href={ company.url }
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
            title="Open allabolag.se page"
          >
            <span>{ company.name }</span>
            <span className="opacity-0 group-hover:opacity-100 text-xs">↗</span>
          </a>
        ) : (
          <span className="font-semibold text-foreground">{ company.name }</span>
        )
      ),
    },
    {
      id: 'orgnr',
      header: 'Org.nr',
      headerClassName: 'w-[150px]',
      filter: { type: 'text', placeholder: 'Filter org.nr...' },
      cell: ( company ) => (
        company.orgnr ? (
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 font-mono font-medium text-xs">
            { company.orgnr }
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
      cell: ( company ) => (
        company.phone ? (
          <div className="flex items-center gap-1.5 text-xs">
            <a
              href={ `tel:${ company.phone.replace( /\s/g, '' ) }` }
              className="font-medium text-foreground hover:text-primary hover:underline truncate"
              title="Call phone number"
            >
              <span>📞 { company.phone }</span>
            </a>
            <button
              type="button"
              onClick={ () => copyToClipboard( company.phone!, `phone-${ company.id }` ) }
              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors shrink-0"
              title="Copy phone"
            >
              { copiedId === `phone-${ company.id }` ? '✓' : '📋' }
            </button>
          </div>
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
      cell: ( company ) => (
        company.email ? (
          <div className="flex items-center gap-1.5 text-xs">
            <a
              href={ `mailto:${ company.email }` }
              className="font-medium text-foreground hover:text-primary hover:underline truncate"
              title="Send email"
            >
              <span>✉️ { company.email }</span>
            </a>
            <button
              type="button"
              onClick={ () => copyToClipboard( company.email!, `email-${ company.id }` ) }
              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors shrink-0"
              title="Copy email"
            >
              { copiedId === `email-${ company.id }` ? '✓' : '📋' }
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'address',
      header: 'Address',
      headerClassName: 'min-w-[220px]',
      filter: { type: 'text', placeholder: 'Filter address...' },
      cell: ( company ) => (
        company.address ? (
          <span className="text-xs text-muted-foreground line-clamp-1">{ company.address }</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'city',
      header: 'City / Ort',
      headerClassName: 'w-[140px]',
      filter: {
        type: 'select',
        options: cities.map( c => ( { label: `${ c.name } (${ c.count })`, value: c.name } ) ),
      },
      cell: ( company ) => (
        company.city ? (
          <span className="text-xs font-medium text-foreground">{ company.city }</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
  ], [ cities, copiedId ] )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
              <button
                onClick={ () => router.push( '/in-cosmetics' ) }
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                In-Cosmetics Global
              </button>
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-muted/60 text-foreground border border-border">
                🇸🇪 Alla Bolag
              </span>
            </nav>
          </div>
          <button
            onClick={ () => router.push( '/' ) }
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Hub
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="space-y-6">
          {/* Header & Stats Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🇸🇪</span>
                <h1 className="text-2xl font-bold text-foreground">Alla Bolag Directory</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
                  Live Sync
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Swedish enterprise records extracted from allabolag.se
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 bg-background border border-border rounded-lg text-xs">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold text-foreground">{ total }</span>
              </div>
              <div className="px-3.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-600 dark:text-green-400">
                <span>Contacted: </span>
                <span className="font-bold">{ contactedCount }</span>
              </div>
              <div className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                <span>Pending: </span>
                <span className="font-bold">{ pendingCount }</span>
              </div>
            </div>
          </div>

          {/* Unified Schema-driven Data Table */}
          <DataTable<Company>
            columns={ columns }
            data={ companies }
            loading={ loading }
            emptyMessage="No companies match your filters. Run the Alla Bolag Extractor extension on allabolag.se or adjust filters."
            total={ total }
            contactedCount={ contactedCount }
            pendingCount={ pendingCount }
            search={ search }
            onSearchChange={ ( val ) => {
              setSearch( val )
              setPage( 1 )
            } }
            searchPlaceholder="Global search by company, org.nr, phone, email, city..."
            primaryFilter={ {
              value: cityFilter,
              onChange: ( val ) => {
                setCityFilter( val )
                setPage( 1 )
              },
              options: [
                { label: `All Cities (${ total })`, value: 'all' },
                ...cities.map( c => ( { label: `${ c.name } (${ c.count })`, value: c.name } ) ),
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
              city: cityFilter,
            } }
            onColumnFilterChange={ handleColumnFilterChange }
            onClearAllFilters={ handleClearFilters }
            onExportCsv={ handleExportCsv }
            onClearAll={ handleClearAll }
            clearAllLabel="Clear Database"
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

export default function AllaBolagPage () {
  return (
    <Suspense fallback={ <div className="min-h-screen p-8 text-center text-muted-foreground">Loading Alla Bolag CRM...</div> }>
      <AllaBolagContent />
    </Suspense>
  )
}
