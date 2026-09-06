'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

function ContactsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([])
  const [untaggedCount, setUntaggedCount] = useState(0)
  const [totalContacts, setTotalContacts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState<boolean>(
    searchParams.get('pending') === 'true' || searchParams.get('contacted') === 'false'
  )
  const [tagFilter, setTagFilter] = useState<string>(
    searchParams.get('tag') || 'all'
  )
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchContacts = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(onlyPending ? { contacted: 'false' } : {}),
        ...(tagFilter !== 'all' ? { tag: tagFilter } : {}),
        ...(search ? { search } : {}),
      })

      const response = await fetch(`/api/contacts?${params}`)
      const data = await response.json()
      setContacts(data.contacts || [])
      setAvailableTags(data.tags || [])
      setUntaggedCount(data.untaggedCount || 0)
      setTotalContacts(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [onlyPending, tagFilter, page, search])

  // Initial fetch and real-time SSE listener
  useEffect(() => {
    fetchContacts(true)

    const eventSource = new EventSource('/api/events')
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'CONTACTS_UPDATED' || payload.type === 'CONTACTS_DELETED') {
          fetchContacts(false)
        }
      } catch (err) {
        console.error('Failed to parse SSE payload:', err)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchContacts(false)
      }
    }

    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchContacts(false)
      }
    }, 2500)

    const onFocus = () => fetchContacts(false)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      eventSource.close()
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchContacts])

  const toggleContacted = async (id: string, currentStatus: boolean) => {
    try {
      await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, contacted: !currentStatus }),
      })
      fetchContacts()
    } catch (error) {
      console.error('Failed to update contact:', error)
    }
  }

  const handleClearContacts = async () => {
    const isSpecificRun = tagFilter !== 'all'
    const promptMsg = isSpecificRun
      ? tagFilter === '__untagged__'
        ? 'Are you sure you want to delete all untagged contacts?'
        : `Are you sure you want to delete all contacts from the run "${tagFilter}"?`
      : 'Are you sure you want to clear all contacts from the database? This action cannot be undone.'

    if (!window.confirm(promptMsg)) return

    setIsClearing(true)
    try {
      const url = isSpecificRun
        ? `/api/contacts?tag=${encodeURIComponent(tagFilter)}`
        : '/api/contacts?all=true'

      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        if (isSpecificRun) setTagFilter('all')
        setPage(1)
        fetchContacts()
      }
    } catch (err) {
      console.error('Failed to clear contacts:', err)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/')}
              className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              XYZ
            </button>
            <nav className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-muted/60 text-foreground border border-border">
                Maps Contacts
              </span>
              <button
                onClick={() => router.push('/in-cosmetics')}
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                In-Cosmetics Global
              </button>
            </nav>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="space-y-6">
          {/* Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 items-stretch sm:items-center">
              <input
                type="text"
                placeholder="Search by name, phone, or category..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="flex-1 px-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm"
              />
              <label className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg cursor-pointer select-none text-sm text-foreground hover:bg-muted/30 transition-colors shrink-0">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => {
                    setOnlyPending(e.target.checked)
                    setPage(1)
                  }}
                  className="w-4 h-4 cursor-pointer accent-primary"
                />
                <span>Pending only</span>
              </label>
              <select
                value={tagFilter}
                onChange={(e) => {
                  setTagFilter(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-foreground/40 transition-colors text-sm max-w-[240px] truncate"
              >
                <option value="all">All Runs ({totalContacts})</option>
                {availableTags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
                {untaggedCount > 0 && (
                  <option value="__untagged__">
                    Untagged ({untaggedCount})
                  </option>
                )}
              </select>
            </div>

            <button
              onClick={handleClearContacts}
              disabled={isClearing || contacts.length === 0}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
              title={tagFilter === 'all' ? 'Delete all contacts' : `Delete run "${tagFilter}"`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>
                {isClearing
                  ? 'Deleting...'
                  : tagFilter === 'all'
                  ? 'Clear Database'
                  : 'Delete this Run'}
              </span>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No contacts found.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Website
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                      Contacted
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {contact.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {contact.tag && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 rounded border border-purple-100 dark:border-purple-800">
                                {contact.tag}
                              </span>
                            )}
                            {contact.address && (
                              <span className="text-xs text-muted-foreground">
                                {contact.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {contact.phone ? (
                          <div className="flex flex-col gap-1">
                            <a
                              href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open WhatsApp chat"
                              className="text-primary hover:underline flex items-center gap-1 truncate"
                            >
                              <svg
                                className="w-4 h-4 text-emerald-600 shrink-0"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                              <span>{contact.phone}</span>
                            </a>
                            <a
                              href={`https://t.me/+${contact.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open Telegram chat"
                              className="text-sky-500 hover:text-sky-600 hover:underline flex items-center gap-1 truncate text-xs"
                            >
                              <svg
                                className="w-3.5 h-3.5 shrink-0"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.946z" />
                              </svg>
                              <span>Telegram</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {contact.website ? (
                          <a
                            href={contact.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs flex items-center gap-1 truncate max-w-[180px]"
                            title={contact.website}
                          >
                            <span>🌐</span>
                            <span className="truncate">{contact.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-primary hover:underline text-xs flex items-center gap-1 truncate max-w-[180px]"
                            title={contact.email}
                          >
                            <span>✉</span>
                            <span className="truncate">{contact.email}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {contact.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {contact.rating ? (
                          <span className="flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-foreground">
                              {contact.rating}
                            </span>
                            {contact.reviews && (
                              <span className="text-muted-foreground text-xs">
                                ({contact.reviews})
                              </span>
                            )}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={contact.contacted}
                          onChange={() =>
                            toggleContacted(contact.id, contact.contacted)
                          }
                          className="w-5 h-5 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={`/api/contacts/${contact.id}/generate-pdf`}
                          download
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 transition-opacity"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading contacts...</div>}>
      <ContactsContent />
    </Suspense>
  )
}
