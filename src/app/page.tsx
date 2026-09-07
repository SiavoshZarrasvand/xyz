'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { FileUpload } from '@/components/FileUpload'

interface ToolStats {
  total: number
  contacted: number
  pending: number
}

interface StatsResponse {
  maps?: ToolStats
  inCosmetics?: ToolStats
  allaBolag?: ToolStats
  total?: number
  contacted?: number
  notContacted?: number
}

export default function Home () {
  const router = useRouter()
  const [ stats, setStats ] = useState<StatsResponse | null>( null )
  const [ showUpload, setShowUpload ] = useState( false )
  const [ uploadResult, setUploadResult ] = useState<{
    totalProcessed: number
    newContacts: number
    updatedContacts: number
  } | null>( null )

  const fetchStats = async () => {
    try {
      const response = await fetch( '/api/stats' )
      const data = await response.json()
      setStats( data )
    } catch ( error ) {
      console.error( 'Failed to fetch stats:', error )
    }
  }

  useEffect( () => {
    fetchStats()
  }, [] )

  const handleUploadComplete = ( result: {
    totalProcessed: number
    newContacts: number
    updatedContacts: number
  } ) => {
    setUploadResult( result )
    fetchStats()
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              XYZ
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Extraction Hub
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Manifest V3 • Real-Time Local Sync
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-8 py-12 w-full">
        <div className="space-y-10">
          {/* Welcome & Overview */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Extractors & Workspaces
            </h1>
            <p className="text-sm text-muted-foreground">
              Select a dedicated scraper database or tool workspace below to view records, monitor live sync streams, and manage outreach.
            </p>
          </div>

          {/* Extractor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Google Maps Data Extractor */}
            <div
              onClick={ () => router.push( '/google-maps' ) }
              className="p-6 rounded-xl border border-border bg-background/60 hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  📍
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>Google Maps Extractor</span>
                    <span className="opacity-0 group-hover:opacity-100 text-sm transition-opacity">→</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Business listings, verified telephone numbers, websites, categories, ratings, and direct WhatsApp/Telegram outreach links.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    { stats?.maps?.total ?? stats?.total ?? 0 }
                  </span>
                  <span className="text-muted-foreground">contacts</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-green-600 dark:text-green-400">
                    { stats?.maps?.contacted ?? stats?.contacted ?? 0 } contacted
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: In-Cosmetics Global Extractor */}
            <div
              onClick={ () => router.push( '/in-cosmetics' ) }
              className="p-6 rounded-xl border border-border bg-background/60 hover:bg-muted/40 hover:border-rose-500/40 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  🧴
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-rose-600 transition-colors flex items-center gap-1.5">
                    <span>In-Cosmetics Global</span>
                    <span className="opacity-0 group-hover:opacity-100 text-sm transition-opacity">→</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Exhibitor profiles, stand booth numbers, company descriptions, "Why visit our stand" pitches, emails, and phone channels.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    { stats?.inCosmetics?.total ?? 0 }
                  </span>
                  <span className="text-muted-foreground">exhibitors</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-green-600 dark:text-green-400">
                    { stats?.inCosmetics?.contacted ?? 0 } contacted
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Alla Bolag Business Extractor */}
            <div
              onClick={ () => router.push( '/alla-bolag' ) }
              className="p-6 rounded-xl border border-border bg-background/60 hover:bg-muted/40 hover:border-amber-500/40 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  🇸🇪
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
                    <span>Alla Bolag Extractor</span>
                    <span className="opacity-0 group-hover:opacity-100 text-sm transition-opacity">→</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Swedish enterprise registry from allabolag.se with Org.nr, direct telefon, street addresses, postcodes, and cities.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    { stats?.allaBolag?.total ?? 0 }
                  </span>
                  <span className="text-muted-foreground">companies</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-green-600 dark:text-green-400">
                    { stats?.allaBolag?.contacted ?? 0 } contacted
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional CSV Upload Drawer */}
          <div className="pt-6 border-t border-border">
            <button
              onClick={ () => setShowUpload( prev => !prev ) }
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 font-medium"
            >
              <span>{ showUpload ? '▼' : '▶' }</span>
              <span>Legacy CSV Import Tool</span>
            </button>

            { showUpload && (
              <div className="mt-4 p-6 border border-border rounded-xl bg-muted/20 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Import Google Maps CSV</h3>
                <FileUpload onUploadComplete={ handleUploadComplete } />

                { uploadResult && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-700 dark:text-green-400">
                    Processed { uploadResult.totalProcessed } contacts ({ uploadResult.newContacts } new, { uploadResult.updatedContacts } updated).
                  </div>
                ) }
              </div>
            ) }
          </div>
        </div>
      </main>
    </div>
  )
}
