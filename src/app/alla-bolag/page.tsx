'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Company {
  id: string
  name: string
  orgnr: string | null
  phone: string | null
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

  const [ companies, setCompanies] = useState<Company[]>( [] )
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
  const [ page, setPage ] = useState( 1 )
  const [ totalPages, setTotalPages ] = useState( 1 )

  const fetchCompanies = useCallback( async ( isInitial = false ) => {
    if ( isInitial ) setLoading( true )
    try {
      const params = new URLSearchParams( {
        page: page.toString(),
        limit: '50',
        ...( onlyPending ? { contacted: 'false' } : {} ),
        ...( cityFilter !== 'all' ? { city: cityFilter } : {} ),
        ...( search ? { search } : {} ),
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
  }, [ onlyPending, cityFilter, page, search ] )

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

          {/* Filters & Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 items-stretch sm:items-center">
              <input
                type="text"
                placeholder="Search by company, org.nr, phone, city..."
                value={ search }
                onChange={ ( e ) => {
                  setSearch( e.target.value )
                  setPage( 1 )
                } }
                className="flex-1 px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm"
              />

              <label className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg cursor-pointer select-none text-sm text-foreground hover:bg-muted/30 transition-colors shrink-0">
                <input
                  type="checkbox"
                  checked={ onlyPending }
                  onChange={ ( e ) => {
                    setOnlyPending( e.target.checked )
                    setPage( 1 )
                  } }
                  className="w-4 h-4 cursor-pointer accent-primary"
                />
                <span>Pending only</span>
              </label>

              <select
                value={ cityFilter }
                onChange={ ( e ) => {
                  setCityFilter( e.target.value )
                  setPage( 1 )
                } }
                className="px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm max-w-[200px] truncate"
              >
                <option value="all">All Cities ({ total })</option>
                { cities.map( ( c ) => (
                  <option key={ c.name } value={ c.name }>
                    { c.name } ({ c.count })
                  </option>
                ) ) }
              </select>
            </div>

            <button
              onClick={ handleClearAll }
              disabled={ isClearing || companies.length === 0 }
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
              title="Clear all companies"
            >
              <span>{ isClearing ? 'Clearing...' : 'Clear Database' }</span>
            </button>
          </div>

          {/* Table */}
          { loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
              No companies found. Run the Alla Bolag Extractor extension on allabolag.se to scrape records.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[260px]">Company</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[150px]">Org.nr</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[180px]">Telefon</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground min-w-[220px]">Address</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[140px]">City / Ort</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-[90px]">Contacted</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-[70px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  { companies.map( ( company ) => (
                    <tr key={ company.id } className="hover:bg-muted/30 transition-colors align-middle">
                      {/* Company Name */}
                      <td className="px-4 py-3">
                        { company.url ? (
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
                        ) }
                      </td>

                      {/* Org.nr */}
                      <td className="px-4 py-3 text-xs">
                        { company.orgnr ? (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 font-mono font-medium">
                            { company.orgnr }
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        ) }
                      </td>

                      {/* Telefon */}
                      <td className="px-4 py-3 text-xs">
                        { company.phone ? (
                          <div className="flex flex-col gap-1">
                            <a
                              href={ `tel:${ company.phone.replace( /\s/g, '' ) }` }
                              className="font-medium text-foreground hover:text-primary hover:underline flex items-center gap-1 truncate"
                              title="Call phone number"
                            >
                              <span>📞</span>
                              <span>{ company.phone }</span>
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                              <a
                                href={ `https://wa.me/${ company.phone.replace( /\D/g, '' ).replace( /^0/, '46' ) }` }
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open WhatsApp chat"
                                className="text-emerald-600 hover:underline flex items-center gap-1 text-[11px]"
                              >
                                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                <span>WhatsApp</span>
                              </a>
                              <a
                                href={ `https://t.me/+${ company.phone.replace( /\D/g, '' ).replace( /^0/, '46' ) }` }
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Telegram chat"
                                className="text-sky-500 hover:underline flex items-center gap-1 text-[11px]"
                              >
                                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.946z" />
                                </svg>
                                <span>Telegram</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        ) }
                      </td>

                      {/* Address */}
                      <td className="px-4 py-3 text-xs">
                        { company.street || company.address ? (
                          <div>
                            <div className="text-foreground font-medium">{ company.street || company.address }</div>
                            { company.postcode && <div className="text-muted-foreground">{ company.postcode }</div> }
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        ) }
                      </td>

                      {/* City / Ort */}
                      <td className="px-4 py-3 text-xs">
                        { company.city ? (
                          <span className="px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border font-medium">
                            { company.city }
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        ) }
                      </td>

                      {/* Contacted */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={ company.contacted }
                          onChange={ () => toggleContacted( company.id, company.contacted ) }
                          className="w-5 h-5 cursor-pointer accent-primary"
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={ () => handleDelete( company.id, company.name ) }
                          className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Delete company"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ) ) }
                </tbody>
              </table>
            </div>
          ) }

          {/* Pagination */}
          { totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Page { page } of { totalPages } ({ total } total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={ () => setPage( p => Math.max( 1, p - 1 ) ) }
                  disabled={ page <= 1 }
                  className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={ () => setPage( p => Math.min( totalPages, p + 1 ) ) }
                  disabled={ page >= totalPages }
                  className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          ) }
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
