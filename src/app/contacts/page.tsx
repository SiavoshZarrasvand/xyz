'use client'

import { Suspense, useMemo } from 'react'
import { DirectoryView } from '@/components/DirectoryView'
import { ColumnDef } from '@/components/DataTable'
import { PhoneCell } from '@/components/PhoneCell'
import { EditableEmailCell } from '@/components/EditableEmailCell'
import { EditableWebsiteCell } from '@/components/EditableWebsiteCell'

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
        <PhoneCell
          phone={ contact.phone }
          id={ contact.id }
          apiEndpoint="/api/contacts"
        />
      ),
    },
    {
      id: 'website',
      header: 'Website',
      filter: { type: 'text', placeholder: 'Filter website...' },
      cell: ( contact ) => (
        <EditableWebsiteCell
          id={ contact.id }
          website={ contact.website }
          apiEndpoint="/api/contacts"
        />
      ),
    },
    {
      id: 'email',
      header: 'Email',
      filter: { type: 'text', placeholder: 'Filter email...' },
      cell: ( contact ) => (
        <EditableEmailCell
          id={ contact.id }
          email={ contact.email }
          apiEndpoint="/api/contacts"
        />
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
