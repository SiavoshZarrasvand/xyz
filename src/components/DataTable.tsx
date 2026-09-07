'use client'

import React, { useState } from 'react'

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

  // Quick presence filters
  quickFilters?: {
    hasEmail?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
    hasPhone?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
    hasWebsite?: { value: boolean | null; onChange: ( v: boolean | null ) => void }
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

  // Filter out empty strings and 'all' placeholders from column filters
  const activeColumnFilterCount = Object.values( columnFilters ).filter(
    v => v && v.trim().length > 0 && v !== 'all'
  ).length

  const activeQuickFilterCount = [
    quickFilters?.hasEmail?.value !== null && quickFilters?.hasEmail?.value !== undefined,
    quickFilters?.hasPhone?.value !== null && quickFilters?.hasPhone?.value !== undefined,
    quickFilters?.hasWebsite?.value !== null && quickFilters?.hasWebsite?.value !== undefined,
    quickFilters?.onlyPending?.value === true,
  ].filter( Boolean ).length

  const isPrimaryActive = Boolean( primaryFilter && primaryFilter.value !== 'all' && primaryFilter.value !== '' )
  const isSearchActive = Boolean( search && search.trim().length > 0 )

  const totalActiveFilters = ( isSearchActive ? 1 : 0 ) +
    ( isPrimaryActive ? 1 : 0 ) +
    activeQuickFilterCount +
    activeColumnFilterCount

  return (
    <div className="space-y-4">
      {/* Top Filter & Actions Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 items-stretch sm:items-center">
            <input
              type="text"
              placeholder={ searchPlaceholder }
              value={ search }
              onChange={ ( e ) => onSearchChange( e.target.value ) }
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

          { quickFilters?.onlyPending && (
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
      { loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading records...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          { emptyMessage }
        </div>
      ) : (
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
                          <input
                            type="text"
                            placeholder={ col.filter.placeholder || `Filter ${ col.header.toLowerCase() }...` }
                            value={ columnFilters[ col.id ] || '' }
                            onChange={ ( e ) => onColumnFilterChange( col.id, e.target.value ) }
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
                        value={ quickFilters?.onlyPending?.value ? 'pending' : 'all' }
                        onChange={ ( e ) => quickFilters?.onlyPending?.onChange( e.target.value === 'pending' ) }
                        className="w-full px-1.5 py-1 bg-background border border-border rounded outline-none focus:border-foreground/40 text-xs text-foreground"
                      >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
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
            <tbody className="divide-y divide-border">
              { data.map( ( item ) => (
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
