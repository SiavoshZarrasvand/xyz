'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef as TanStackColumnDef,
  VisibilityState,
  ColumnOrderState,
} from '@tanstack/react-table'

export interface ColumnDef<T> {
  id: string
  header: string
  className?: string
  headerClassName?: string
  filter?: {
    type: 'text' | 'select'
    placeholder?: string
    options?: { label: string; value: string }[]
  }
  cell: ( item: T ) => React.ReactNode
}

export type ContactedFilterStatus = 'all' | 'contacted' | 'pending'

export interface DataTableProps<T extends { id: string; contacted?: boolean }> {
  tableId?: string
  columns: ColumnDef<T>[]
  data: T[]
  loading: boolean
  emptyMessage?: string

  // Stats
  total: number
  contactedCount?: number
  pendingCount?: number

  // Search
  search: string
  onSearchChange: ( search: string ) => void
  searchPlaceholder?: string

  // Primary dropdown (e.g. City / Tag / Country)
  primaryFilter?: {
    value: string
    onChange: ( value: string ) => void
    options: { label: string; value: string }[]
  }

  // Contacted status segmented toggle: 'all' | 'contacted' | 'pending'
  contactedFilter?: {
    value: ContactedFilterStatus
    onChange: ( status: ContactedFilterStatus ) => void
  }

  // Quick presence filters
  quickFilters?: {
    hasEmail?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
    hasPhone?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
    hasWebsite?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
    hasMaps?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
    onlyPending?: { value: boolean; onChange: ( v: boolean ) => void }
  }

  // Column filters
  columnFilters: Record<string, string>
  onColumnFilterChange: ( columnId: string, value: string ) => void
  onClearAllFilters: () => void

  // Toolbar Actions
  onExportCsv?: () => void
  onClearAll?: () => void
  clearAllLabel?: string
  isClearing?: boolean

  // Row callbacks
  onToggleContacted?: ( id: string, currentStatus: boolean ) => void
  onDeleteItem?: ( id: string, item: T ) => void

  // Pagination
  page: number
  totalPages: number
  onPageChange: ( page: number | ( ( prev: number ) => number ) ) => void
}

function DebouncedInput ( {
  value: initialValue,
  onChange,
  debounceMs = 250,
  ...props
}: {
  value: string
  onChange: ( value: string ) => void
  debounceMs?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> ) {
  const [ value, setValue ] = useState( initialValue )

  useEffect( () => {
    setValue( initialValue )
  }, [ initialValue ] )

  useEffect( () => {
    const timer = setTimeout( () => {
      if ( value !== initialValue ) {
        onChange( value )
      }
    }, debounceMs )
    return () => clearTimeout( timer )
  }, [ value, debounceMs, initialValue, onChange ] )

  return (
    <input
      { ...props }
      value={ value }
      onChange={ ( e ) => setValue( e.target.value ) }
    />
  )
}

export function DataTable<T extends { id: string; contacted?: boolean }> ( {
  tableId = 'default',
  columns,
  data,
  loading,
  emptyMessage = 'No records match your filters.',
  total,
  contactedCount,
  pendingCount,
  search,
  onSearchChange,
  searchPlaceholder = 'Global search...',
  primaryFilter,
  contactedFilter,
  quickFilters,
  columnFilters,
  onColumnFilterChange,
  onClearAllFilters,
  onExportCsv,
  onClearAll,
  clearAllLabel = 'Clear Database',
  isClearing = false,
  onToggleContacted,
  onDeleteItem,
  page,
  totalPages,
  onPageChange,
}: DataTableProps<T> ) {
  const [ showColumnFilters, setShowColumnFilters ] = useState( false )
  const [ showColumnMenu, setShowColumnMenu ] = useState( false )
  const columnMenuRef = useRef<HTMLDivElement>( null )

  // Drag-and-drop column reordering state
  const [ draggedColId, setDraggedColId ] = useState<string | null>( null )
  const [ dragOverColId, setDragOverColId ] = useState<string | null>( null )

  // Close column menu on outside click
  useEffect( () => {
    const handleOutsideClick = ( e: MouseEvent ) => {
      if ( columnMenuRef.current && !columnMenuRef.current.contains( e.target as Node ) ) {
        setShowColumnMenu( false )
      }
    }
    if ( showColumnMenu ) {
      document.addEventListener( 'mousedown', handleOutsideClick )
      return () => document.removeEventListener( 'mousedown', handleOutsideClick )
    }
  }, [ showColumnMenu ] )

  // Build TanStack column definitions
  const tanstackColumns = useMemo<TanStackColumnDef<T, unknown>[]>( () => {
    const cols: TanStackColumnDef<T, unknown>[] = columns.map( ( col ) => ( {
      id: col.id,
      header: col.header,
      cell: ( info ) => col.cell( info.row.original ),
      meta: {
        filter: col.filter,
        className: col.className,
        headerClassName: col.headerClassName,
        label: col.header,
      },
      enableHiding: true,
    } ) )

    if ( onToggleContacted ) {
      cols.push( {
        id: 'contacted',
        header: 'Contacted',
        cell: ( info ) => (
          <input
            type="checkbox"
            checked={ info.row.original.contacted || false }
            onChange={ () => onToggleContacted( info.row.original.id, info.row.original.contacted || false ) }
            className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer accent-primary"
            title="Toggle contacted status"
          />
        ),
        meta: {
          className: 'text-center',
          headerClassName: 'text-center w-[90px]',
          label: 'Contacted',
        },
        enableHiding: true,
      } )
    }

    if ( onDeleteItem ) {
      cols.push( {
        id: 'actions',
        header: 'Actions',
        cell: ( info ) => (
          <button
            type="button"
            onClick={ () => onDeleteItem( info.row.original.id, info.row.original ) }
            className="text-xs text-red-500 hover:text-red-700 p-1 hover:bg-red-500/10 rounded transition-colors"
            title="Delete record"
          >
            Delete
          </button>
        ),
        meta: {
          className: 'text-center',
          headerClassName: 'text-center w-[70px]',
          label: 'Actions',
        },
        enableHiding: false,
      } )
    }

    return cols
  }, [ columns, onToggleContacted, onDeleteItem ] )

  const initialColumnOrder = useMemo(
    () => tanstackColumns.map( ( c ) => c.id! ),
    [ tanstackColumns ]
  )

  const [ columnVisibility, setColumnVisibility ] = useState<VisibilityState>( {} )
  const [ columnOrder, setColumnOrder ] = useState<ColumnOrderState>( initialColumnOrder )

  // Load persisted layout (visibility + order) from localStorage on mount
  useEffect( () => {
    if ( typeof window === 'undefined' ) return
    try {
      const storageKey = `xyz_table_layout_${ tableId }`
      const saved = localStorage.getItem( storageKey )
      if ( saved ) {
        const parsed = JSON.parse( saved )
        if ( parsed.visibility && typeof parsed.visibility === 'object' ) {
          setColumnVisibility( parsed.visibility )
        }
        if ( Array.isArray( parsed.order ) && parsed.order.length > 0 ) {
          // Verify saved order contains known columns and append any new columns
          const knownSet = new Set( initialColumnOrder )
          const validOrder = parsed.order.filter( ( id: string ) => knownSet.has( id ) )
          initialColumnOrder.forEach( ( id ) => {
            if ( !validOrder.includes( id ) ) validOrder.push( id )
          } )
          setColumnOrder( validOrder )
        }
      } else {
        setColumnOrder( initialColumnOrder )
      }
    } catch ( err ) {
      console.warn( 'Failed to load table layout:', err )
    }
  }, [ tableId, initialColumnOrder ] )

  // Persist layout changes to localStorage
  const saveLayoutToStorage = ( newVisibility: VisibilityState, newOrder: ColumnOrderState ) => {
    if ( typeof window === 'undefined' ) return
    try {
      const storageKey = `xyz_table_layout_${ tableId }`
      localStorage.setItem(
        storageKey,
        JSON.stringify( {
          visibility: newVisibility,
          order: newOrder,
        } )
      )
    } catch ( err ) {
      console.warn( 'Failed to save table layout:', err )
    }
  }

  const handleVisibilityChange = ( updaterOrValue: VisibilityState | ( ( prev: VisibilityState ) => VisibilityState ) ) => {
    setColumnVisibility( ( prev ) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue( prev ) : updaterOrValue
      saveLayoutToStorage( next, columnOrder )
      return next
    } )
  }

  const handleOrderChange = ( updaterOrValue: ColumnOrderState | ( ( prev: ColumnOrderState ) => ColumnOrderState ) ) => {
    setColumnOrder( ( prev ) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue( prev ) : updaterOrValue
      saveLayoutToStorage( columnVisibility, next )
      return next
    } )
  }

  // Reset columns visibility and order to default
  const handleResetLayout = () => {
    if ( typeof window !== 'undefined' ) {
      localStorage.removeItem( `xyz_table_layout_${ tableId }` )
    }
    setColumnVisibility( {} )
    setColumnOrder( initialColumnOrder )
  }

  // Reorder helper to swap or shift columns
  const reorderColumns = ( sourceColId: string, targetColId: string ) => {
    if ( sourceColId === targetColId ) return
    const currentOrder = table.getAllLeafColumns().map( ( c ) => c.id )
    const fromIdx = currentOrder.indexOf( sourceColId )
    const toIdx = currentOrder.indexOf( targetColId )
    if ( fromIdx === -1 || toIdx === -1 ) return

    const newOrder = [ ...currentOrder ]
    newOrder.splice( fromIdx, 1 )
    newOrder.splice( toIdx, 0, sourceColId )
    handleOrderChange( newOrder )
  }

  const moveColumn = ( colId: string, direction: 'up' | 'down' ) => {
    const currentOrder = table.getAllLeafColumns().map( ( c ) => c.id )
    const idx = currentOrder.indexOf( colId )
    if ( idx === -1 ) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if ( targetIdx < 0 || targetIdx >= currentOrder.length ) return

    const newOrder = [ ...currentOrder ]
    const [ moved ] = newOrder.splice( idx, 1 )
    newOrder.splice( targetIdx, 0, moved )
    handleOrderChange( newOrder )
  }

  // Initialise TanStack table instance
  const table = useReactTable( {
    data,
    columns: tanstackColumns,
    getRowId: ( row ) => row.id,
    state: {
      columnVisibility,
      columnOrder,
    },
    onColumnVisibilityChange: handleVisibilityChange,
    onColumnOrderChange: handleOrderChange,
    getCoreRowModel: getCoreRowModel(),
  } )

  // Filter stats calculations
  const activeColumnFilterCount = Object.keys( columnFilters ).filter( k => Boolean( columnFilters[ k ] && columnFilters[ k ].trim() ) ).length
  let activeQuickFilterCount = 0
  if ( contactedFilter && contactedFilter.value !== 'all' ) activeQuickFilterCount++
  if ( !contactedFilter && quickFilters?.onlyPending?.value ) activeQuickFilterCount++
  if ( quickFilters?.hasEmail && quickFilters.hasEmail.value !== null && quickFilters.hasEmail.value !== undefined ) activeQuickFilterCount++
  if ( quickFilters?.hasPhone && quickFilters.hasPhone.value !== null && quickFilters.hasPhone.value !== undefined ) activeQuickFilterCount++
  if ( quickFilters?.hasWebsite && quickFilters.hasWebsite.value !== null && quickFilters.hasWebsite.value !== undefined ) activeQuickFilterCount++
  if ( quickFilters?.hasMaps && quickFilters.hasMaps.value !== null && quickFilters.hasMaps.value !== undefined ) activeQuickFilterCount++
  if ( primaryFilter && primaryFilter.value && primaryFilter.value !== 'all' ) activeQuickFilterCount++

  const totalActiveFilters = activeColumnFilterCount + activeQuickFilterCount
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const allLeafColumns = table.getAllLeafColumns()

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Main Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
            {/* Primary Filter Dropdown (e.g. City / Tag / Country) */}
            { primaryFilter && (
              <div className="w-[180px]">
                <select
                  value={ primaryFilter.value }
                  onChange={ ( e ) => primaryFilter.onChange( e.target.value ) }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium text-foreground outline-none focus:border-foreground/40 transition-colors"
                >
                  { primaryFilter.options.map( ( opt ) => (
                    <option key={ opt.value } value={ opt.value }>
                      { opt.label }
                    </option>
                  ) ) }
                </select>
              </div>
            ) }

            {/* Global Search Input with instant debounce */}
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <DebouncedInput
                type="text"
                placeholder={ searchPlaceholder }
                value={ search }
                onChange={ onSearchChange }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
              />
            </div>

            {/* Live Stats Badges */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
              <span>Total: <strong className="text-foreground">{ total.toLocaleString() }</strong></span>
              { contactedCount !== undefined && (
                <>
                  <span>•</span>
                  <span>Contacted: <strong className="text-emerald-600 dark:text-emerald-400">{ contactedCount.toLocaleString() }</strong></span>
                </>
              ) }
              { pendingCount !== undefined && (
                <>
                  <span>•</span>
                  <span>Pending: <strong className="text-amber-600 dark:text-amber-400">{ pendingCount.toLocaleString() }</strong></span>
                </>
              ) }
            </div>
          </div>

          <div className="flex items-center gap-2">
            { onExportCsv && (
              <button
                type="button"
                onClick={ onExportCsv }
                disabled={ data.length === 0 }
                className="px-4 py-2 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                Export CSV
              </button>
            ) }

            { onClearAll && (
              <button
                type="button"
                onClick={ onClearAll }
                disabled={ isClearing || data.length === 0 }
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                { isClearing ? 'Clearing...' : clearAllLabel }
              </button>
            ) }
          </div>
        </div>

        {/* Quick Filter Pills and Column Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            { contactedFilter && (
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs shrink-0">
                <button
                  type="button"
                  onClick={ () => contactedFilter.onChange( 'all' ) }
                  className={ `px-2.5 py-1 rounded-md transition-colors font-medium ${
                    contactedFilter.value === 'all'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }` }
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={ () => contactedFilter.onChange( 'contacted' ) }
                  className={ `px-2.5 py-1 rounded-md transition-colors font-medium ${
                    contactedFilter.value === 'contacted'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }` }
                >
                  Contacted
                </button>
                <button
                  type="button"
                  onClick={ () => contactedFilter.onChange( 'pending' ) }
                  className={ `px-2.5 py-1 rounded-md transition-colors font-medium ${
                    contactedFilter.value === 'pending'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }` }
                >
                  Not Contacted
                </button>
              </div>
            ) }

            <span className="text-xs text-muted-foreground font-medium mr-1">Filters:</span>

            { quickFilters?.hasEmail && (
              <button
                type="button"
                onClick={ () => quickFilters.hasEmail?.onChange( quickFilters.hasEmail.value === true ? null : true ) }
                className={ `px-3 py-1 text-xs rounded-full border transition-colors ${
                  quickFilters.hasEmail.value === true
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
                }` }
              >
                With Email
              </button>
            ) }

            { quickFilters?.hasPhone && (
              <button
                type="button"
                onClick={ () => quickFilters.hasPhone?.onChange( quickFilters.hasPhone.value === true ? null : true ) }
                className={ `px-3 py-1 text-xs rounded-full border transition-colors ${
                  quickFilters.hasPhone.value === true
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
                }` }
              >
                With Phone
              </button>
            ) }

            { quickFilters?.hasWebsite && (
              <button
                type="button"
                onClick={ () => quickFilters.hasWebsite?.onChange( quickFilters.hasWebsite.value === true ? null : true ) }
                className={ `px-3 py-1 text-xs rounded-full border transition-colors ${
                  quickFilters.hasWebsite.value === true
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
                }` }
              >
                With Website
              </button>
            ) }

            { quickFilters?.hasMaps && (
              <button
                type="button"
                onClick={ () => quickFilters.hasMaps?.onChange( quickFilters.hasMaps.value === true ? null : true ) }
                className={ `px-3 py-1 text-xs rounded-full border transition-colors ${
                  quickFilters.hasMaps.value === true
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
                }` }
              >
                With Maps
              </button>
            ) }

            { !contactedFilter && quickFilters?.onlyPending && (
              <button
                type="button"
                onClick={ () => quickFilters.onlyPending?.onChange( !quickFilters.onlyPending.value ) }
                className={ `px-3 py-1 text-xs rounded-full border transition-colors ${
                  quickFilters.onlyPending.value
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
                }` }
              >
                Pending Only
              </button>
            ) }

            <div className="h-4 w-px bg-border mx-1" />

            <button
              type="button"
              onClick={ () => setShowColumnFilters( prev => !prev ) }
              className={ `px-3 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                showColumnFilters || activeColumnFilterCount > 0
                  ? 'bg-muted text-foreground border-foreground/30 font-medium'
                  : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
              }` }
            >
              <span>Column Filters</span>
              { activeColumnFilterCount > 0 && (
                <span className="px-1.5 py-0.2 bg-primary text-primary-foreground text-[10px] rounded-full font-bold">
                  { activeColumnFilterCount }
                </span>
              ) }
            </button>

            { totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={ onClearAllFilters }
                className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg border border-border/70 transition-colors font-medium flex items-center gap-1.5"
                title="Reset all active filters"
              >
                <span>✕</span>
                <span>Clear Filters ({ totalActiveFilters })</span>
              </button>
            ) }
          </div>

          {/* TanStack Table Columns Management Dropdown */}
          <div className="relative" ref={ columnMenuRef }>
            <button
              type="button"
              onClick={ () => setShowColumnMenu( prev => !prev ) }
              className={ `px-3 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                showColumnMenu
                  ? 'bg-muted text-foreground border-foreground/30 font-medium'
                  : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40'
              }` }
              title="Manage visible columns and ordering"
            >
              <span>Columns</span>
              <span className="text-[10px] opacity-75">
                ({ visibleLeafColumns.length }/{ allLeafColumns.length })
              </span>
            </button>

            { showColumnMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-background text-foreground border border-border rounded-lg shadow-xl z-50 p-2.5 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-border font-medium">
                  <span>Manage Columns</span>
                  <button
                    type="button"
                    onClick={ handleResetLayout }
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    title="Reset column visibility and order"
                  >
                    Reset Layout
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">
                  Toggle visibility or use arrows to re-order. You can also drag headers directly.
                </p>

                <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-border/40 pt-1">
                  { allLeafColumns.map( ( col, idx ) => {
                    const meta = col.columnDef.meta as { label?: string } | undefined
                    const label = meta?.label || col.id
                    const isVisible = col.getIsVisible()
                    const canHide = col.getCanHide()

                    return (
                      <div
                        key={ col.id }
                        className="flex items-center justify-between py-1.5 px-1 hover:bg-muted/40 rounded transition-colors group"
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                          <input
                            type="checkbox"
                            checked={ isVisible }
                            disabled={ !canHide }
                            onChange={ col.getToggleVisibilityHandler() }
                            className="w-3.5 h-3.5 rounded text-primary focus:ring-0 cursor-pointer accent-primary disabled:opacity-50"
                          />
                          <span className={ `truncate ${ !isVisible ? 'text-muted-foreground line-through' : 'font-medium text-foreground' }` }>
                            { label }
                          </span>
                        </label>

                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={ idx === 0 }
                            onClick={ () => moveColumn( col.id, 'up' ) }
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                            title="Move earlier"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={ idx === allLeafColumns.length - 1 }
                            onClick={ () => moveColumn( col.id, 'down' ) }
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                            title="Move later"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    )
                  } ) }
                </div>
              </div>
            ) }
          </div>
        </div>
      </div>

      {/* TanStack Generated Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-muted/50">
            { table.getHeaderGroups().map( ( headerGroup ) => (
              <React.Fragment key={ headerGroup.id }>
                {/* Header Row with HTML5 Drag-and-Drop Reordering */}
                <tr>
                  { headerGroup.headers.map( ( header ) => {
                    const meta = header.column.columnDef.meta as {
                      headerClassName?: string
                      className?: string
                    } | undefined
                    const colId = header.column.id
                    const isDragging = draggedColId === colId
                    const isDragOver = dragOverColId === colId

                    return (
                      <th
                        key={ header.id }
                        draggable={ header.column.getCanHide() }
                        onDragStart={ ( e ) => {
                          e.dataTransfer.setData( 'text/plain', colId )
                          setDraggedColId( colId )
                        } }
                        onDragOver={ ( e ) => {
                          e.preventDefault()
                          if ( dragOverColId !== colId ) setDragOverColId( colId )
                        } }
                        onDragLeave={ () => {
                          if ( dragOverColId === colId ) setDragOverColId( null )
                        } }
                        onDrop={ ( e ) => {
                          e.preventDefault()
                          const sourceId = e.dataTransfer.getData( 'text/plain' )
                          setDraggedColId( null )
                          setDragOverColId( null )
                          if ( sourceId && sourceId !== colId ) {
                            reorderColumns( sourceId, colId )
                          }
                        } }
                        onDragEnd={ () => {
                          setDraggedColId( null )
                          setDragOverColId( null )
                        } }
                        className={ `px-4 py-3 text-sm font-semibold text-foreground select-none transition-colors ${
                          header.column.getCanHide() ? 'cursor-grab active:cursor-grabbing hover:bg-muted/80' : ''
                        } ${ isDragging ? 'opacity-40' : '' } ${
                          isDragOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : ''
                        } ${ meta?.headerClassName || '' }` }
                        title={ header.column.getCanHide() ? 'Drag to reorder column' : undefined }
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{ flexRender( header.column.columnDef.header, header.getContext() ) }</span>
                        </div>
                      </th>
                    )
                  } ) }
                </tr>

                {/* Dynamic Column Filters Row positioned directly under visible headers */}
                { showColumnFilters && (
                  <tr className="border-t border-border/60 bg-muted/20">
                    { headerGroup.headers.map( ( header ) => {
                      const colId = header.column.id
                      const meta = header.column.columnDef.meta as {
                        filter?: {
                          type: 'text' | 'select'
                          placeholder?: string
                          options?: { label: string; value: string }[]
                        }
                        label?: string
                      } | undefined

                      if ( colId === 'contacted' ) {
                        return (
                          <th key={ `filter-${ colId }` } className="p-2 font-normal text-center">
                            <select
                              value={ contactedFilter ? contactedFilter.value : quickFilters?.onlyPending?.value ? 'pending' : 'all' }
                              onChange={ ( e ) => {
                                const val = e.target.value as ContactedFilterStatus
                                if ( contactedFilter ) {
                                  contactedFilter.onChange( val )
                                } else {
                                  quickFilters?.onlyPending?.onChange( val === 'pending' )
                                }
                              } }
                              className="w-full px-1.5 py-1 bg-background border border-border rounded outline-none focus:border-foreground/40 text-xs text-foreground"
                            >
                              <option value="all">All</option>
                              <option value="contacted">Contacted</option>
                              <option value="pending">Not Contacted</option>
                            </select>
                          </th>
                        )
                      }

                      if ( colId === 'actions' ) {
                        return (
                          <th key={ `filter-${ colId }` } className="p-2 text-center">
                            { totalActiveFilters > 0 && (
                              <button
                                type="button"
                                onClick={ onClearAllFilters }
                                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors"
                                title="Reset all filters"
                              >
                                Reset
                              </button>
                            ) }
                          </th>
                        )
                      }

                      return (
                        <th key={ `filter-${ colId }` } className="p-2 font-normal">
                          { meta?.filter ? (
                            meta.filter.type === 'select' ? (
                              <select
                                value={ columnFilters[ colId ] || 'all' }
                                onChange={ ( e ) => onColumnFilterChange( colId, e.target.value ) }
                                className="w-full px-2 py-1 bg-background border border-border rounded outline-none focus:border-foreground/40 text-xs text-foreground truncate"
                              >
                                <option value="all">All</option>
                                { meta.filter.options?.map( ( opt ) => (
                                  <option key={ opt.value } value={ opt.value }>
                                    { opt.label }
                                  </option>
                                ) ) }
                              </select>
                            ) : (
                              <DebouncedInput
                                type="text"
                                placeholder={ meta.filter.placeholder || `Filter ${ ( meta.label || colId ).toLowerCase() }...` }
                                value={ columnFilters[ colId ] || '' }
                                onChange={ ( val ) => onColumnFilterChange( colId, val ) }
                                className="w-full px-2 py-1 bg-background border border-border rounded outline-none focus:border-foreground/40 text-xs text-foreground placeholder:text-muted-foreground/60"
                              />
                            )
                          ) : (
                            <div className="text-center text-muted-foreground text-xs">—</div>
                          )}
                        </th>
                      )
                    } ) }
                  </tr>
                )}
              </React.Fragment>
            ) ) }
          </thead>

          <tbody className={ `divide-y divide-border ${ loading && data.length > 0 ? 'opacity-50 transition-opacity' : '' }` }>
            { loading && data.length === 0 ? (
              <tr>
                <td colSpan={ visibleLeafColumns.length || 1 } className="text-center py-12 text-muted-foreground">
                  Loading records...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={ visibleLeafColumns.length || 1 } className="text-center py-12 text-muted-foreground">
                  { emptyMessage }
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map( ( row ) => (
                <tr key={ row.id } className="hover:bg-muted/30 transition-colors">
                  { row.getVisibleCells().map( ( cell ) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined
                    return (
                      <td
                        key={ cell.id }
                        className={ `px-4 py-3 text-sm ${ meta?.className || '' }` }
                      >
                        { flexRender( cell.column.columnDef.cell, cell.getContext() ) }
                      </td>
                    )
                  } ) }
                </tr>
              ) )
            ) }
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground pt-2">
        <div>
          Showing page <span className="font-semibold text-foreground">{ page }</span> of{' '}
          <span className="font-semibold text-foreground">{ totalPages }</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={ () => onPageChange( prev => Math.max( prev - 1, 1 ) ) }
            disabled={ page <= 1 || loading }
            className="px-3 py-1 bg-background border border-border rounded-lg hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-xs"
          >
            Previous
          </button>

          { Array.from( { length: Math.min( 5, totalPages ) }, ( _, i ) => {
            let pageNum = page
            if ( totalPages <= 5 ) {
              pageNum = i + 1
            } else if ( page <= 3 ) {
              pageNum = i + 1
            } else if ( page >= totalPages - 2 ) {
              pageNum = totalPages - 4 + i
            } else {
              pageNum = page - 2 + i
            }

            return (
              <button
                key={ pageNum }
                type="button"
                onClick={ () => onPageChange( pageNum ) }
                disabled={ loading }
                className={ `w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  pageNum === page
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'bg-background border border-border text-foreground hover:bg-muted'
                }` }
              >
                { pageNum }
              </button>
            )
          } ) }

          <button
            type="button"
            onClick={ () => onPageChange( prev => Math.min( prev + 1, totalPages ) ) }
            disabled={ page >= totalPages || loading }
            className="px-3 py-1 bg-background border border-border rounded-lg hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
