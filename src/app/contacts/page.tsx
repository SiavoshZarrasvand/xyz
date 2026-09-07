'use client'

import { Suspense, useMemo } from 'react'
import { DirectoryView } from '@/components/DirectoryView'
import { ColumnDef } from '@/components/DataTable'

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

function ContactsPageContent () {
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
    <DirectoryView<Contact>
      title="Google Maps Contacts"
      subtitle="Local business contacts extracted from Google Maps searches"
      activeNav="contacts"
      apiEndpoint="/api/contacts"
      itemsKey="contacts"
      sseEvents={ [ 'CONTACTS_UPDATED', 'CONTACTS_DELETED' ] }
      columns={ columns }
      csvHeaders={ [ 'Name', 'Phone', 'Website', 'Email', 'Category', 'Rating', 'Reviews', 'Address', 'Tag', 'Contacted' ] }
      csvRowMapper={ ( c ) => [ c.name, c.phone, c.website, c.email, c.category, c.rating, c.reviews, c.address, c.tag, c.contacted ? 'Yes' : 'No' ] }
      csvFilenamePrefix="maps-contacts"
      primaryFilterConfig={ {
        paramName: 'tag',
        responseKey: 'tags',
        allLabel: 'All Runs',
      } }
      enabledQuickFilters={ { email: true, phone: true, website: true, pending: true } }
      emptyMessage="No contacts match your filters. Run Google Maps scraper or adjust filters."
    />
  )
}

export default function ContactsPage () {
  return (
    <Suspense fallback={ <div className="min-h-screen p-8 text-center text-muted-foreground">Loading Contacts...</div> }>
      <ContactsPageContent />
    </Suspense>
  )
}
