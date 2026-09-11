'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable, ColumnDef, ContactedFilterStatus } from '@/components/DataTable'

export interface DirectoryViewProps<T extends { id: string; name?: string; contacted?: boolean }> {
  // Directory metadata
  title: string
  subtitle: string
  activeNav: 'contacts' | 'in-cosmetics' | 'alla-bolag' | 'kitebeach'

  // API configuration
  apiEndpoint: string
  itemsKey: string // 'companies' | 'contacts' | 'exhibitors'
  sseEvents?: string[] // e.g. ['ALLABOLAG_UPDATED', 'ALLABOLAG_DELETED']

  // Table Schema
  columns: ColumnDef<T>[]
  csvHeaders: string[]
  csvRowMapper: ( item: T ) => ( string | number | boolean | null | undefined )[]
  csvFilenamePrefix: string

  // Primary dropdown filter (e.g. city, tag, country)
  primaryFilterConfig?: {
    paramName: string
    responseKey: string // 'cities' | 'tags' | 'countries'
    allLabel?: string
    placeholder?: string
    getOptionLabel?: ( item: { name: string; count: number } ) => string
  }

  // Quick filters supported by this directory
  enabledQuickFilters?: {
    email?: boolean
    phone?: boolean
    website?: boolean
    maps?: boolean
    pending?: boolean
  }

  emptyMessage?: string
  clearAllConfirmMessage?: string
  tableId?: string
}

export function DirectoryView<T extends { id: string; name?: string; contacted?: boolean }> ( {
  title,
  subtitle,
  activeNav,
  apiEndpoint,
  itemsKey,
  sseEvents = [],
  columns,
  csvHeaders,
  csvRowMapper,
  csvFilenamePrefix,
  primaryFilterConfig,
  enabledQuickFilters = { email: true, phone: true, pending: true },
  emptyMessage,
  clearAllConfirmMessage,
  tableId,
}: DirectoryViewProps<T> ) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ items, setItems ] = useState<T[]>( [] )
  const [ primaryFilterOptions, setPrimaryFilterOptions ] = useState<{ name: string; count: number }[]>( [] )
  const [ total, setTotal ] = useState( 0 )
  const [ contactedCount, setContactedCount ] = useState( 0 )
  const [ pendingCount, setPendingCount ] = useState( 0 )
  const [ loading, setLoading ] = useState( true )
  const [ isClearing, setIsClearing ] = useState( false )

  const [ search, setSearch ] = useState( '' )
  const [ contactedFilter, setContactedFilter ] = useState<ContactedFilterStatus>(
    searchParams.get( 'contacted' ) === 'true'
      ? 'contacted'
      : searchParams.get( 'pending' ) === 'true' || searchParams.get( 'contacted' ) === 'false'
      ? 'pending'
      : 'all'
  )
  const [ primaryFilterValue, setPrimaryFilterValue ] = useState<string>(
    primaryFilterConfig ? searchParams.get( primaryFilterConfig.paramName ) || 'all' : 'all'
  )

  const [ hasEmail, setHasEmail ] = useState<boolean | null>( null )
  const [ hasPhone, setHasPhone ] = useState<boolean | null>( null )
  const [ hasWebsite, setHasWebsite ] = useState<boolean | null>( null )
  const [ hasMaps, setHasMaps ] = useState<boolean | null>( null )
  const [ columnFilters, setColumnFilters ] = useState<Record<string, string>>( {} )

  const [ page, setPage ] = useState( 1 )
  const [ totalPages, setTotalPages ] = useState( 1 )

  const handleClearFilters = () => {
    setSearch( '' )
    setContactedFilter( 'all' )
    setPrimaryFilterValue( 'all' )
    setHasEmail( null )
    setHasPhone( null )
    setHasWebsite( null )
    setHasMaps( null )
    setColumnFilters( {} )
    setPage( 1 )
  }

  const handleColumnFilterChange = ( columnId: string, value: string ) => {
    if ( primaryFilterConfig && columnId === primaryFilterConfig.paramName ) {
      setPrimaryFilterValue( value )
    } else {
      setColumnFilters( prev => {
        const updated = { ...prev }
        if ( !value || !value.trim() ) {
          delete updated[ columnId ]
        } else {
          updated[ columnId ] = value
        }
        return updated
      } )
    }
    setPage( 1 )
  }

  const pendingDataRef = useRef<{
    list: T[]
    primaryOptions?: { name: string; count: number }[]
    stats?: { total?: number; contacted?: number; pending?: number }
    pagination?: { totalPages?: number; total?: number }
  } | null>( null )

  const isEditingCell = useCallback( () => {
    if ( typeof document === 'undefined' ) return false
    const activeEl = document.activeElement
    if (
      activeEl &&
      ( activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' ) &&
      Boolean( activeEl.closest( 'td' ) )
    ) {
      return true
    }
    return Boolean( document.querySelector( 'td [data-editing-cell="true"], td input:not([type="checkbox"])' ) )
  }, [] )

  const applyPendingData = useCallback( () => {
    if ( !pendingDataRef.current ) return
    const { list, primaryOptions, stats, pagination } = pendingDataRef.current
    pendingDataRef.current = null
    setItems( list )
    if ( primaryOptions && primaryFilterConfig ) {
      setPrimaryFilterOptions( primaryOptions )
    }
    if ( stats ) {
      setTotal( stats.total ?? pagination?.total ?? list.length )
      setContactedCount( stats.contacted ?? 0 )
      setPendingCount( stats.pending ?? 0 )
    }
    if ( pagination ) {
      setTotalPages( pagination.totalPages || 1 )
    }
  }, [ primaryFilterConfig ] )

  const fetchItems = useCallback( async ( isInitial = false ) => {
    if ( isInitial ) setLoading( true )
    try {
      const params = new URLSearchParams( {
        page: page.toString(),
        limit: '50',
        ...( contactedFilter === 'contacted' ? { contacted: 'true' } : {} ),
        ...( contactedFilter === 'pending' ? { contacted: 'false' } : {} ),
        ...( search ? { search } : {} ),
        ...( hasEmail !== null ? { hasEmail: String( hasEmail ) } : {} ),
        ...( hasPhone !== null ? { hasPhone: String( hasPhone ) } : {} ),
        ...( hasWebsite !== null ? { hasWebsite: String( hasWebsite ) } : {} ),
        ...( hasMaps !== null ? { hasMaps: String( hasMaps ) } : {} ),
      } )

      if ( primaryFilterConfig && primaryFilterValue !== 'all' ) {
        params.set( primaryFilterConfig.paramName, primaryFilterValue )
      }

      for ( const [ k, v ] of Object.entries( columnFilters ) ) {
        if ( v && v.trim() && v !== 'all' ) {
          params.set( k, v.trim() )
        }
      }

      const response = await fetch( `${ apiEndpoint }?${ params }` )
      const data = await response.json()

      const list = ( data[ itemsKey ] || data.items || [] ) as T[]
      const primaryOptions = primaryFilterConfig && data[ primaryFilterConfig.responseKey ]
        ? data[ primaryFilterConfig.responseKey ]
        : undefined
      const stats = data.stats || {}
      const pagination = data.pagination || {}

      if ( !isInitial && isEditingCell() ) {
        // Active cell edit in progress: buffer incoming updates to avoid interrupting user input
        pendingDataRef.current = { list, primaryOptions, stats, pagination }
        return
      }

      pendingDataRef.current = null
      setItems( list )

      if ( primaryOptions ) {
        setPrimaryFilterOptions( primaryOptions )
      }

      setTotal( stats.total ?? pagination.total ?? list.length )
      setContactedCount( stats.contacted ?? 0 )
      setPendingCount( stats.pending ?? 0 )
      setTotalPages( pagination.totalPages || 1 )
    } catch ( error ) {
      console.error( `Failed to fetch from ${ apiEndpoint }:`, error )
    } finally {
      if ( isInitial ) setLoading( false )
    }
  }, [
    apiEndpoint,
    itemsKey,
    page,
    contactedFilter,
    search,
    hasEmail,
    hasPhone,
    hasWebsite,
    hasMaps,
    primaryFilterConfig,
    primaryFilterValue,
    columnFilters,
    isEditingCell,
  ] )

  const isInitialMountRef = useRef( true )

  useEffect( () => {
    const isInitial = isInitialMountRef.current
    if ( isInitial ) isInitialMountRef.current = false
    fetchItems( isInitial )

    let eventSource: EventSource | null = null
    if ( sseEvents.length > 0 ) {
      eventSource = new EventSource( '/api/events' )
      eventSource.onmessage = ( event ) => {
        try {
          const payload = JSON.parse( event.data )
          if ( sseEvents.includes( payload.type ) ) {
            fetchItems( false )
          }
        } catch ( err ) {
          console.error( 'SSE parse error:', err )
        }
      }
    }

    const pollInterval = setInterval( () => {
      if ( isEditingCell() ) return
      if ( pendingDataRef.current ) {
        applyPendingData()
      } else {
        fetchItems( false )
      }
    }, 2500 )

    const handleEditEnd = () => {
      setTimeout( () => {
        if ( !isEditingCell() && pendingDataRef.current ) {
          applyPendingData()
        }
      }, 100 )
    }

    const handleFocusOut = ( e: FocusEvent ) => {
      const target = e.target as HTMLElement | null
      if ( target && target.tagName === 'INPUT' && target.closest( 'td' ) ) {
        setTimeout( () => {
          if ( !isEditingCell() && pendingDataRef.current ) {
            applyPendingData()
          }
        }, 200 )
      }
    }

    window.addEventListener( 'crm-cell-edit-end', handleEditEnd )
    document.addEventListener( 'focusout', handleFocusOut )

    return () => {
      if ( eventSource ) eventSource.close()
      clearInterval( pollInterval )
      window.removeEventListener( 'crm-cell-edit-end', handleEditEnd )
      document.removeEventListener( 'focusout', handleFocusOut )
    }
  }, [ fetchItems, sseEvents, isEditingCell, applyPendingData ] )

  const toggleContacted = async ( id: string, currentStatus: boolean ) => {
    try {
      setItems( prev =>
        prev.map( item => ( item.id === id ? { ...item, contacted: !currentStatus } : item ) )
      )

      await fetch( apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { id, contacted: !currentStatus } ),
      } )
    } catch ( error ) {
      console.error( 'Failed to toggle contacted status:', error )
      setItems( prev =>
        prev.map( item => ( item.id === id ? { ...item, contacted: currentStatus } : item ) )
      )
    }
  }

  const handleDelete = async ( id: string, name?: string ) => {
    if ( !confirm( `Delete "${ name || 'this item' }"?` ) ) return
    try {
      const res = await fetch( `${ apiEndpoint }?id=${ id }`, { method: 'DELETE' } )
      if ( res.ok ) fetchItems( false )
    } catch ( err ) {
      console.error( 'Failed to delete record:', err )
    }
  }

  const handleClearAll = async () => {
    const isPrimaryActive = primaryFilterConfig && primaryFilterValue !== 'all'
    const message = clearAllConfirmMessage || ( isPrimaryActive
      ? `Are you sure you want to clear records for "${ primaryFilterValue }"? This cannot be undone.`
      : 'Are you sure you want to clear all records? This cannot be undone.' )

    if ( !confirm( message ) ) return

    setIsClearing( true )
    try {
      const query = isPrimaryActive
        ? `${ primaryFilterConfig.paramName }=${ encodeURIComponent( primaryFilterValue ) }`
        : 'all=true'
      const res = await fetch( `${ apiEndpoint }?${ query }`, { method: 'DELETE' } )
      if ( res.ok ) {
        if ( isPrimaryActive ) setPrimaryFilterValue( 'all' )
        fetchItems( false )
      }
    } catch ( err ) {
      console.error( 'Failed to clear records:', err )
    } finally {
      setIsClearing( false )
    }
  }

  const handleExportCsv = () => {
    if ( items.length === 0 ) return
    const escape = ( v: unknown ) => ( v !== null && v !== undefined ? `"${ String( v ).replace( /"/g, '""' ) }"` : '""' )
    const rows = items.map( item => csvRowMapper( item ).map( escape ).join( ',' ) )
    const csvContent = '\uFEFF' + [ csvHeaders.join( ',' ), ...rows ].join( '\n' )
    const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } )
    const url = URL.createObjectURL( blob )
    const a = document.createElement( 'a' )
    a.href = url
    a.download = `${ csvFilenamePrefix }-${ new Date().toISOString().slice( 0, 10 ) }.csv`
    a.click()
    URL.revokeObjectURL( url )
  }

  const primaryFilterOptionsFormatted = useMemo( () => {
    if ( !primaryFilterConfig ) return []
    return [
      { label: `${ primaryFilterConfig.allLabel } (${ total })`, value: 'all' },
      ...primaryFilterOptions.map( opt => ( {
        label: primaryFilterConfig.getOptionLabel
          ? primaryFilterConfig.getOptionLabel( opt )
          : `${ opt.name } (${ opt.count })`,
        value: opt.name,
      } ) ),
    ]
  }, [ primaryFilterConfig, primaryFilterOptions, total ] )

  return (
    <div className="min-h-screen bg-background">
      {/* Universal Navigation Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-8xl mx-auto px-8 py-4 flex items-center justify-between">
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
                className={ `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeNav === 'contacts'
                    ? 'font-semibold bg-muted/60 text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }` }
              >
                Maps Contacts
              </button>
              <button
                onClick={ () => router.push( '/in-cosmetics' ) }
                className={ `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeNav === 'in-cosmetics'
                    ? 'font-semibold bg-muted/60 text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }` }
              >
                In-Cosmetics Global
              </button>
              <button
                onClick={ () => router.push( '/alla-bolag' ) }
                className={ `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeNav === 'alla-bolag'
                    ? 'font-semibold bg-muted/60 text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }` }
              >
                Alla Bolag
              </button>
              <button
                onClick={ () => router.push( '/kitebeach' ) }
                className={ `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeNav === 'kitebeach'
                    ? 'font-semibold bg-muted/60 text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }` }
              >
                Kite Beach
              </button>
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

      {/* Main Container */}
      <main className="max-w-8xl mx-auto px-8 py-8">
        <div className="space-y-6">
          {/* Header & Stats Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-foreground">{ title }</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
                  Live Sync
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{ subtitle }</p>
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

          {/* Unified DataTable Component */}
          <DataTable<T>
            tableId={ tableId || activeNav || itemsKey }
            columns={ columns }
            data={ items }
            loading={ loading }
            emptyMessage={ emptyMessage }
            total={ total }
            contactedCount={ contactedCount }
            pendingCount={ pendingCount }
            search={ search }
            onSearchChange={ ( val ) => {
              setSearch( val )
              setPage( 1 )
            } }
            searchPlaceholder="Global search..."
            primaryFilter={ primaryFilterConfig ? {
              value: primaryFilterValue,
              onChange: ( val ) => {
                setPrimaryFilterValue( val )
                setPage( 1 )
              },
              options: primaryFilterOptionsFormatted,
            } : undefined }
            contactedFilter={ enabledQuickFilters.pending !== false ? {
              value: contactedFilter,
              onChange: ( val ) => {
                setContactedFilter( val )
                setPage( 1 )
              },
            } : undefined }
            quickFilters={ {
              hasEmail: enabledQuickFilters.email ? {
                value: hasEmail,
                onChange: ( val ) => {
                  setHasEmail( val )
                  setPage( 1 )
                },
              } : undefined,
              hasPhone: enabledQuickFilters.phone ? {
                value: hasPhone,
                onChange: ( val ) => {
                  setHasPhone( val )
                  setPage( 1 )
                },
              } : undefined,
              hasWebsite: enabledQuickFilters.website ? {
                value: hasWebsite,
                onChange: ( val ) => {
                  setHasWebsite( val )
                  setPage( 1 )
                },
              } : undefined,
              hasMaps: enabledQuickFilters.maps ? {
                value: hasMaps,
                onChange: ( val ) => {
                  setHasMaps( val )
                  setPage( 1 )
                },
              } : undefined,
            } }
            columnFilters={ columnFilters }
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
