'use client'

import React, { useState, useEffect } from 'react'

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

  const activeQuickFilterCount = [
    contactedFilter ? contactedFilter.value !== 'all' : quickFilters?.onlyPending?.value === true,
    quickFilters?.hasEmail?.value !== null && quickFilters?.hasEmail?.value !== undefined,
    quickFilters?.hasPhone?.value !== null && quickFilters?.hasPhone?.value !== undefined,
    quickFilters?.hasWebsite?.value !== null && quickFilters?.hasWebsite?.value !== undefined,
    quickFilters?.hasMaps?.value !== null && quickFilters?.hasMaps?.value !== undefined,
  ].filter( Boolean ).length

  const activeColumnFilterCount = Object.values( columnFilters ).filter(
    v => v && v.trim() && v !== 'all'
  ).length

  const totalActiveFilters =
    ( search.trim() ? 1 : 0 ) +
    ( primaryFilter && primaryFilter.value !== 'all' ? 1 : 0 ) +
    activeQuickFilterCount +
    activeColumnFilterCount

  return (
    <div className="space-y-4">
      {/* Top Filter & Actions Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 items-stretch sm:items-center">
            <DebouncedInput
              type="text"
              placeholder={ searchPlaceholder }
              value={ search }
              onChange={ onSearchChange }
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm"
            />

            { primaryFilter && (
              <select
                value={ primaryFilter.value }
                onChange={ ( e ) => primaryFilter.onChange( e.target.value ) }
                className="px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm max-w-[220px] truncate"
              >
                { primaryFilter.options.map( ( opt ) => (
                  <option key={ opt.value } value={ opt.value }>
                    { opt.label }
                  </option>
                ) ) }
              </select>
            ) }
          </div>

          <div className="flex items-center gap-2 shrink-0">
            { onExportCsv && (
              <button
                type="button"
                onClick={ onExportCsv }
                disabled={ data.length === 0 }
                className="px-4 py-2 bg-muted/60 hover:bg-muted text-foreground border border-border rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="Export currently loaded records to CSV"
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

        {/* Quick Filter Pills Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
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
              className="px-2.5 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-md transition-colors font-medium"
            >
              Clear Filters ({ totalActiveFilters })
            </button>
          ) }
        </div>
      </div>

      {/* Generated Table */}
      { ( () => {
        const totalColCount = columns.length + ( onToggleContacted ? 1 : 0 ) + ( onDeleteItem ? 1 : 0 )
        return (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr>
                  { columns.map( ( col ) => (
                    <th
                      key={ col.id }
                      className={ `px-4 py-3 text-sm font-semibold text-foreground ${ col.headerClassName || '' }` }
                    >
                      { col.header }
                    </th>
                  ) ) }
                  { onToggleContacted && (
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-[90px]">
                      Contacted
                    </th>
                  ) }
                  { onDeleteItem && (
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-[70px]">
                      Actions
                    </th>
                  ) }
                </tr>

                {/* Dynamic Column Filters Row */}
                { showColumnFilters && (
                  <tr className="border-t border-border/60 bg-muted/20">
                    { columns.map( ( col ) => (
                      <th key={ `filter-${ col.id }` } className="p-2 font-normal">
                        { col.filter ? (
                          col.filter.type === 'select' ? (
                            <select
                              value={ columnFilters[ col.id ] || 'all' }
                              onChange={ ( e ) => onColumnFilterChange( col.id, e.target.value ) }
                              className="w-full px-2 py-1 bg-background border border-border rounded outline-none focus:border-foreground/40 text-xs text-foreground truncate"
                            >
                              <option value="all">All</option>
                              { col.filter.options?.map( ( opt ) => (
                                <option key={ opt.value } value={ opt.value }>
                                  { opt.label }
                                </option>
                              ) ) }
                            </select>
                          ) : (
                            <DebouncedInput
                              type="text"
                              placeholder={ col.filter.placeholder || `Filter ${ col.header.toLowerCase() }...` }
                              value={ columnFilters[ col.id ] || '' }
                              onChange={ ( val ) => onColumnFilterChange( col.id, val ) }
                              className="w-full px-2 py-1 bg-background border border-border rounded outline-none focus:border-foreground/40 text-xs text-foreground placeholder:text-muted-foreground/60"
                            />
                          )
                        ) : (
                          <div className="text-center text-muted-foreground text-xs">—</div>
                        ) }
                      </th>
                    ) ) }
                    { onToggleContacted && (
                      <th className="p-2 font-normal text-center">
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
                    ) }
                    { onDeleteItem && (
                      <th className="p-2 text-center">
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
                    ) }
                  </tr>
                ) }
              </thead>
              <tbody className={ `divide-y divide-border ${ loading && data.length > 0 ? 'opacity-50 transition-opacity' : '' }` }>
                { loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={ totalColCount } className="text-center py-12 text-muted-foreground">
                      Loading records...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={ totalColCount } className="text-center py-12 text-muted-foreground">
                      { emptyMessage }
                    </td>
                  </tr>
                ) : (
                  data.map( ( item ) => (
                    <tr key={ item.id } className="hover:bg-muted/30 transition-colors align-top">
                      { columns.map( ( col ) => (
                        <td key={ `${ item.id }-${ col.id }` } className={ `px-4 py-3 ${ col.className || '' }` }>
                          { col.cell( item ) }
                        </td>
                      ) ) }

                      { onToggleContacted && (
                        <td className="px-4 py-3 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={ Boolean( item.contacted ) }
                            onChange={ () => onToggleContacted( item.id, Boolean( item.contacted ) ) }
                            className="w-5 h-5 cursor-pointer accent-primary"
                          />
                        </td>
                      ) }

                      { onDeleteItem && (
                        <td className="px-4 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={ () => onDeleteItem( item.id, item ) }
                            className="px-2 py-1 text-xs text-muted-foreground hover:text-red-600 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete record"
                          >
                            Delete
                          </button>
                        </td>
                      ) }
                    </tr>
                  ) )
                ) }
              </tbody>
            </table>
          </div>
        )
      } )() }

      {/* Pagination */}
      { totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Page { page } of { totalPages } ({ total } total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={ () => onPageChange( p => Math.max( 1, ( typeof p === 'number' ? p : page ) - 1 ) ) }
              disabled={ page <= 1 }
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={ () => onPageChange( p => Math.min( totalPages, ( typeof p === 'number' ? p : page ) + 1 ) ) }
              disabled={ page >= totalPages }
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      ) }
    </div>
  )
}
