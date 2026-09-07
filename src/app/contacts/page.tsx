'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable, ColumnDef } from '@/components/DataTable'

interface Contact {
  id: string
  name: string
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  category: string | null
  tag: string | null
  rating: number | null
  reviews: number | null
  googleMapsUrl: string | null
  contacted: boolean
  contactedAt: string | null
  createdAt: string
}

interface TagInfo {
  name: string
  count: number
}

function ContactsContent () {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ contacts, setContacts ] = useState<Contact[]>( [] )
  const [ availableTags, setAvailableTags ] = useState<TagInfo[]>( [] )
  const [ untaggedCount, setUntaggedCount ] = useState( 0 )
  const [ totalContacts, setTotalContacts ] = useState( 0 )
  const [ loading, setLoading ] = useState( true )
  const [ isClearing, setIsClearing ] = useState( false )
  const [ search, setSearch ] = useState( '' )
  const [ onlyPending, setOnlyPending ] = useState<boolean>(
    searchParams.get( 'pending' ) === 'true' || searchParams.get( 'contacted' ) === 'false'
  )
  const [ tagFilter, setTagFilter ] = useState<string>(
    searchParams.get( 'tag' ) || 'all'
  )
  const [ hasEmail, setHasEmail ] = useState<boolean | null>( null )
  const [ hasPhone, setHasPhone ] = useState<boolean | null>( null )
  const [ hasWebsite, setHasWebsite ] = useState<boolean | null>( null )
  const [ columnFilters, setColumnFilters ] = useState<Record<string, string>>( {} )

  const [ page, setPage ] = useState( 1 )
  const [ totalPages, setTotalPages ] = useState( 1 )

  const handleClearFilters = () => {
    setSearch( '' )
    setOnlyPending( false )
    setTagFilter( 'all' )
    setHasEmail( null )
    setHasPhone( null )
    setHasWebsite( null )
    setColumnFilters( {} )
    setPage( 1 )
  }

  const handleColumnFilterChange = ( columnId: string, value: string ) => {
    setColumnFilters( prev => ( { ...prev, [ columnId ]: value } ) )
    setPage( 1 )
  }

  const fetchContacts = useCallback( async ( isInitial = false ) => {
    if ( isInitial ) setLoading( true )
    try {
      const params = new URLSearchParams( {
        page: page.toString(),
        limit: '50',
        ...( onlyPending ? { contacted: 'false' } : {} ),
        ...( tagFilter !== 'all' ? { tag: tagFilter } : {} ),
        ...( search ? { search } : {} ),
        ...( hasEmail !== null ? { hasEmail: String( hasEmail ) } : {} ),
        ...( hasPhone !== null ? { hasPhone: String( hasPhone ) } : {} ),
        ...( hasWebsite !== null ? { hasWebsite: String( hasWebsite ) } : {} ),
        ...( columnFilters.name ? { name: columnFilters.name } : {} ),
        ...( columnFilters.phone ? { phone: columnFilters.phone } : {} ),
        ...( columnFilters.email ? { email: columnFilters.email } : {} ),
        ...( columnFilters.website ? { website: columnFilters.website } : {} ),
        ...( columnFilters.category ? { category: columnFilters.category } : {} ),
      } )

      const response = await fetch( `/api/contacts?${ params }` )
      const data = await response.json()
      setContacts( data.contacts || [] )
      setAvailableTags( data.tags || [] )
      setUntaggedCount( data.untaggedCount || 0 )
      setTotalContacts( data.pagination?.total || 0 )
      setTotalPages( data.pagination?.totalPages || 1 )
    } catch ( error ) {
      console.error( 'Failed to fetch contacts:', error )
    } finally {
      if ( isInitial ) setLoading( false )
    }
  }, [
    onlyPending,
    tagFilter,
    page,
    search,
    hasEmail,
    hasPhone,
    hasWebsite,
    columnFilters,
  ] )

  useEffect( () => {
    fetchContacts( true )

    const eventSource = new EventSource( '/api/events' )
    eventSource.onmessage = ( event ) => {
      try {
        const payload = JSON.parse( event.data )
        if ( payload.type === 'CONTACTS_UPDATED' || payload.type === 'CONTACTS_DELETED' ) {
          fetchContacts( false )
        }
      } catch ( err ) {
        console.error( 'Failed to parse SSE payload:', err )
      }
    }

    const pollInterval = setInterval( () => {
      fetchContacts( false )
    }, 2500 )

    return () => {
      eventSource.close()
      clearInterval( pollInterval )
    }
  }, [ fetchContacts ] )

  const toggleContacted = async ( id: string, currentStatus: boolean ) => {
    try {
      setContacts( prev =>
        prev.map( c => ( c.id === id ? { ...c, contacted: !currentStatus } : c ) )
      )

      await fetch( '/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { id, contacted: !currentStatus } ),
      } )
    } catch ( error ) {
      console.error( 'Failed to toggle contacted status:', error )
      setContacts( prev =>
        prev.map( c => ( c.id === id ? { ...c, contacted: currentStatus } : c ) )
      )
    }
  }

  const handleDeleteContact = async ( id: string, name: string ) => {
    if ( !confirm( `Are you sure you want to delete "${ name }"?` ) ) return
    try {
      const response = await fetch( `/api/contacts?id=${ id }`, { method: 'DELETE' } )
      if ( response.ok ) fetchContacts( false )
    } catch ( error ) {
      console.error( 'Failed to delete contact:', error )
    }
  }

  const handleClearContacts = async () => {
    const isTag = tagFilter !== 'all'
    const confirmMessage = isTag
      ? `Are you sure you want to delete all contacts with tag "${ tagFilter }"? This cannot be undone.`
      : 'Are you sure you want to delete ALL contacts? This cannot be undone.'

    if ( !confirm( confirmMessage ) ) return

    setIsClearing( true )
    try {
      const query = isTag ? `tag=${ encodeURIComponent( tagFilter ) }` : 'all=true'
      const response = await fetch( `/api/contacts?${ query }`, { method: 'DELETE' } )
      if ( response.ok ) {
        if ( isTag ) setTagFilter( 'all' )
        fetchContacts( false )
      }
    } catch ( error ) {
      console.error( 'Failed to clear contacts:', error )
    } finally {
      setIsClearing( false )
    }
  }

  const handleExportCsv = () => {
    if ( contacts.length === 0 ) return
    const headers = [ 'Name', 'Phone', 'Website', 'Email', 'Category', 'Rating', 'Reviews', 'Address', 'Tag', 'Contacted' ]
    const escape = ( v: unknown ) => ( v ? `"${ String( v ).replace( /"/g, '""' ) }"` : '""' )
    const rows = contacts.map( c => [
      escape( c.name ),
      escape( c.phone ),
      escape( c.website ),
      escape( c.email ),
      escape( c.category ),
      escape( c.rating ),
      escape( c.reviews ),
      escape( c.address ),
      escape( c.tag ),
      escape( c.contacted ? 'Yes' : 'No' ),
    ].join( ',' ) )
    const csvContent = '\uFEFF' + [ headers.join( ',' ), ...rows ].join( '\n' )
    const blob = new Blob( [ csvContent ], { type: 'text/csv;charset=utf-8;' } )
    const url = URL.createObjectURL( blob )
    const a = document.createElement( 'a' )
    a.href = url
    a.download = `maps-contacts-${ new Date().toISOString().slice( 0, 10 ) }.csv`
    a.click()
    URL.revokeObjectURL( url )
  }

  // Define schema-driven columns
  const columns: ColumnDef<Contact>[] = useMemo( () => [
    {
      id: 'name',
      header: 'Name',
      filter: { type: 'text', placeholder: 'Filter name...' },
      cell: ( contact ) => (
        <div className="flex flex-col">
          { contact.googleMapsUrl ? (
            <a
              href={ contact.googleMapsUrl }
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
              title="Open Google Maps listing"
            >
              <span>{ contact.name }</span>
              <span className="opacity-0 group-hover:opacity-100 text-xs">↗</span>
            </a>
          ) : (
            <span className="font-medium text-foreground">{ contact.name }</span>
          ) }
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            { contact.tag && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 rounded border border-purple-100 dark:border-purple-800">
                { contact.tag }
              </span>
            ) }
            { contact.address && (
              <span className="text-xs text-muted-foreground">{ contact.address }</span>
            ) }
          </div>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Phone',
      filter: { type: 'text', placeholder: 'Filter phone...' },
      cell: ( contact ) => (
        contact.phone ? (
          <div className="flex items-center gap-1.5 text-xs">
            <a
              href={ `tel:${ contact.phone.replace( /\D/g, '' ) }` }
              className="font-medium text-foreground hover:text-primary hover:underline truncate"
            >
              <span>📞 { contact.phone }</span>
            </a>
            <a
              href={ `https://wa.me/${ contact.phone.replace( /\D/g, '' ) }` }
              target="_blank"
              rel="noopener noreferrer"
              title="Open WhatsApp chat"
              className="text-emerald-600 hover:opacity-80 shrink-0"
            >
              💬
            </a>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'website',
      header: 'Website',
      filter: { type: 'text', placeholder: 'Filter website...' },
      cell: ( contact ) => (
        contact.website ? (
          <a
            href={ contact.website.startsWith( 'http' ) ? contact.website : `https://${ contact.website }` }
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block max-w-[180px]"
          >
            🌐 { contact.website.replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' ) }
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'email',
      header: 'Email',
      filter: { type: 'text', placeholder: 'Filter email...' },
      cell: ( contact ) => (
        contact.email ? (
          <a
            href={ `mailto:${ contact.email }` }
            className="text-xs text-primary hover:underline truncate block max-w-[180px]"
          >
            ✉️ { contact.email }
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'category',
      header: 'Category',
      filter: { type: 'text', placeholder: 'Filter category...' },
      cell: ( contact ) => (
        contact.category ? (
          <span className="text-xs text-muted-foreground">{ contact.category }</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ( contact ) => (
        contact.rating ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-amber-500 font-bold">★</span>
            <span className="font-semibold text-foreground">{ contact.rating.toFixed( 1 ) }</span>
            { contact.reviews !== null && (
              <span className="text-muted-foreground">({ contact.reviews })</span>
            ) }
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      ),
    },
  ], [] )

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
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-muted/60 text-foreground border border-border">
                Maps Contacts
              </span>
              <button
                onClick={ () => router.push( '/in-cosmetics' ) }
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                In-Cosmetics Global
              </button>
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
            ← Back to Home
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Google Maps Contacts</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Local business contacts extracted from Google Maps searches
              </p>
            </div>
            <div className="px-3.5 py-1.5 bg-background border border-border rounded-lg text-xs">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-bold text-foreground">{ totalContacts }</span>
            </div>
          </div>

          <DataTable<Contact>
            columns={ columns }
            data={ contacts }
            loading={ loading }
            emptyMessage="No contacts match your filters. Run Google Maps scraper or adjust filters."
            total={ totalContacts }
            search={ search }
            onSearchChange={ ( val ) => {
              setSearch( val )
              setPage( 1 )
            } }
            searchPlaceholder="Global search by name, phone, email, website, category..."
            primaryFilter={ {
              value: tagFilter,
              onChange: ( val ) => {
                setTagFilter( val )
                setPage( 1 )
              },
              options: [
                { label: `All Runs (${ totalContacts })`, value: 'all' },
                ...availableTags.map( t => ( { label: `${ t.name } (${ t.count })`, value: t.name } ) ),
                ...( untaggedCount > 0 ? [ { label: `Untagged (${ untaggedCount })`, value: '__untagged__' } ] : [] ),
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
            columnFilters={ columnFilters }
            onColumnFilterChange={ handleColumnFilterChange }
            onClearAllFilters={ handleClearFilters }
            onExportCsv={ handleExportCsv }
            onClearAll={ handleClearContacts }
            clearAllLabel={ tagFilter === 'all' ? 'Clear Database' : 'Delete this Run' }
            isClearing={ isClearing }
            onToggleContacted={ toggleContacted }
            onDeleteItem={ ( id, item ) => handleDeleteContact( id, item.name ) }
            page={ page }
            totalPages={ totalPages }
            onPageChange={ setPage }
          />
        </div>
      </main>
    </div>
  )
}

export default function ContactsPage () {
  return (
    <Suspense fallback={ <div className="min-h-screen p-8 text-center text-muted-foreground">Loading Contacts...</div> }>
      <ContactsContent />
    </Suspense>
  )
}
