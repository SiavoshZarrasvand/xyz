'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
  const [ page, setPage ] = useState( 1 )
  const [ totalPages, setTotalPages ] = useState( 1 )
  const [ expandedDescriptions, setExpandedDescriptions ] = useState<Record<string, boolean>>( {} )
  const [ isClearing, setIsClearing ] = useState( false )

  const fetchExhibitors = useCallback( async ( isInitial = false ) => {
    if ( isInitial ) setLoading( true )
    try {
      const params = new URLSearchParams( {
        page: page.toString(),
        limit: '50',
        ...( onlyPending ? { contacted: 'false' } : {} ),
        ...( countryFilter !== 'all' ? { country: countryFilter } : {} ),
        ...( search ? { search } : {} ),
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
  }, [ onlyPending, countryFilter, page, search ] )

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

    const onVisibilityChange = () => {
      if ( document.visibilityState === 'visible' ) {
        fetchExhibitors( false )
      }
    }

    const pollInterval = setInterval( () => {
      if ( document.visibilityState === 'visible' ) {
        fetchExhibitors( false )
      }
    }, 2500 )

    const onFocus = () => fetchExhibitors( false )
    document.addEventListener( 'visibilitychange', onVisibilityChange )
    window.addEventListener( 'focus', onFocus )

    return () => {
      eventSource.close()
      clearInterval( pollInterval )
      document.removeEventListener( 'visibilitychange', onVisibilityChange )
      window.removeEventListener( 'focus', onFocus )
    }
  }, [ fetchExhibitors ] )

  const toggleContacted = async ( id: string, currentStatus: boolean ) => {
    try {
      setExhibitors( prev =>
        prev.map( e => ( e.id === id ? { ...e, contacted: !currentStatus } : e ) )
      )

      const response = await fetch( '/api/in-cosmetics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { id, contacted: !currentStatus } ),
      } )

      if ( !response.ok ) {
        setExhibitors( prev =>
          prev.map( e => ( e.id === id ? { ...e, contacted: currentStatus } : e ) )
        )
      }
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
    if ( !confirm( 'Are you sure you want to clear all in-cosmetics exhibitors?' ) ) return
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

  const toggleDescription = ( id: string ) => {
    setExpandedDescriptions( prev => ( { ...prev, [ id ]: !prev[ id ] } ) )
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
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-muted/60 text-foreground border border-border">
                In-Cosmetics Global
              </span>
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

          {/* Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 items-stretch sm:items-center">
              <input
                type="text"
                placeholder="Search name, stand, country, description..."
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
                value={ countryFilter }
                onChange={ ( e ) => {
                  setCountryFilter( e.target.value )
                  setPage( 1 )
                } }
                className="px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm max-w-[200px] truncate"
              >
                <option value="all">All Countries</option>
                { countries.map( ( c ) => (
                  <option key={ c.name } value={ c.name }>
                    { c.name } ({ c.count })
                  </option>
                ) ) }
              </select>
            </div>

            <button
              onClick={ handleClearAll }
              disabled={ isClearing || exhibitors.length === 0 }
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{ isClearing ? 'Clearing...' : 'Clear All' }</span>
            </button>
          </div>

          {/* Table */}
          { loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading exhibitors...</div>
          ) : exhibitors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
              No in-cosmetics exhibitors found. Run the scraper extension to extract records.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[220px]">Company & Stand</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground min-w-[320px]">Cosmetics Focus & Description</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[160px]">Phone</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[160px]">Website</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[170px]">Email</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-[160px]">Location</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-[80px]">Contacted</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-[60px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  { exhibitors.map( ( exhibitor ) => {
                    const isExpanded = Boolean( expandedDescriptions[ exhibitor.id ] )
                    const descriptionText = exhibitor.description || ''
                    const isLongDescription = descriptionText.length > 200

                    return (
                      <tr key={ exhibitor.id } className="hover:bg-muted/30 transition-colors align-top">
                        {/* Company & Stand */ }
                        <td className="px-4 py-3">
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
                        </td>

                        {/* Description & Why Visit */ }
                        <td className="px-4 py-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          { exhibitor.whyVisit && (
                            <div className="mb-2 p-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-md">
                              <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                                ⭐ Why visit our stand:
                              </span>
                              <span>{ exhibitor.whyVisit }</span>
                            </div>
                          ) }

                          { descriptionText ? (
                            <div>
                              <p className={ isExpanded ? '' : 'line-clamp-3' }>{ descriptionText }</p>
                              { isLongDescription && (
                                <button
                                  onClick={ () => toggleDescription( exhibitor.id ) }
                                  className="text-primary hover:underline font-semibold mt-1 inline-block"
                                >
                                  { isExpanded ? 'Show less' : 'Read more...' }
                                </button>
                              ) }
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">No description provided</span>
                          ) }
                        </td>

                        {/* Phone */ }
                        <td className="px-4 py-3 text-xs">
                          { exhibitor.phone ? (
                            <div className="flex flex-col gap-1">
                              <a
                                href={ `https://wa.me/${ exhibitor.phone.replace( /\D/g, '' ) }` }
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                className="text-primary hover:underline flex items-center gap-1 truncate max-w-[150px]"
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                <span className="truncate">{ exhibitor.phone }</span>
                              </a>
                              <a
                                href={ `https://t.me/+${ exhibitor.phone.replace( /\D/g, '' ) }` }
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Telegram chat"
                                className="text-sky-500 hover:text-sky-600 hover:underline flex items-center gap-1 truncate text-xs"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.946z" />
                                </svg>
                                <span>Telegram</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          ) }
                        </td>

                        {/* Website */ }
                        <td className="px-4 py-3 text-xs">
                          { exhibitor.website ? (
                            <a
                              href={ exhibitor.website }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1.5 truncate max-w-[150px]"
                              title={ exhibitor.website }
                            >
                              <span>🌐</span>
                              <span className="truncate">{ exhibitor.website.replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' ) }</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          ) }
                        </td>

                        {/* Email */ }
                        <td className="px-4 py-3 text-xs">
                          { exhibitor.email ? (
                            <a
                              href={ `mailto:${ exhibitor.email }` }
                              className="text-primary hover:underline flex items-center gap-1.5 truncate max-w-[160px]"
                              title={ exhibitor.email }
                            >
                              <span>✉</span>
                              <span className="truncate">{ exhibitor.email }</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          ) }
                        </td>

                        {/* Location */ }
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div>
                            { exhibitor.street && <div className="text-foreground font-medium truncate max-w-[170px]">{ exhibitor.street }</div> }
                            <div>{ [ exhibitor.city, exhibitor.postcode ].filter( Boolean ).join( ', ' ) }</div>
                            <div>{ exhibitor.country }</div>
                          </div>
                        </td>

                        {/* Contacted */ }
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={ exhibitor.contacted }
                            onChange={ () => toggleContacted( exhibitor.id, exhibitor.contacted ) }
                            className="w-5 h-5 cursor-pointer accent-primary"
                          />
                        </td>

                        {/* Actions */ }
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={ () => handleDelete( exhibitor.id, exhibitor.name ) }
                            className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  } ) }
                </tbody>
              </table>
            </div>
          ) }

          {/* Pagination */ }
          { totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={ () => setPage( ( p ) => Math.max( 1, p - 1 ) ) }
                disabled={ page === 1 }
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-xs text-muted-foreground">
                Page { page } of { totalPages }
              </span>
              <button
                onClick={ () => setPage( ( p ) => Math.min( totalPages, p + 1 ) ) }
                disabled={ page === totalPages }
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
              >
                Next
              </button>
            </div>
          ) }
        </div>
      </main>
    </div>
  )
}

export default function InCosmeticsPage () {
  return (
    <Suspense fallback={ <div className="text-center py-12 text-muted-foreground">Loading...</div> }>
      <InCosmeticsContent />
    </Suspense>
  )
}
