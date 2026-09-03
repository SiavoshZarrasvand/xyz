'use client'

import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/FileUpload'
import { useState, useEffect } from 'react'

interface Stats {
  total: number
  contacted: number
  notContacted: number
}

export default function Home() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    totalProcessed: number
    newContacts: number
    updatedContacts: number
  } | null>(null)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleUploadComplete = (result: {
    totalProcessed: number
    newContacts: number
    updatedContacts: number
  }) => {
    setUploadResult(result)
    fetchStats()
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            XYZ
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-8 py-12 w-full">
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-lg border border-border bg-background/50 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground mb-1">
                Total Contacts
              </p>
              <p className="text-3xl font-bold text-foreground">
                {stats?.total ?? 0}
              </p>
            </div>
            <div className="p-6 rounded-lg border border-border bg-background/50 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground mb-1">Contacted</p>
              <p className="text-3xl font-bold text-green-600">
                {stats?.contacted ?? 0}
              </p>
            </div>
            <div className="p-6 rounded-lg border border-border bg-background/50 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground mb-1">Pending</p>
              <p className="text-3xl font-bold text-orange-600">
                {stats?.notContacted ?? 0}
              </p>
            </div>
          </div>

          {/* Upload Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Upload Contacts
            </h2>
            <FileUpload onUploadComplete={handleUploadComplete} />

            {uploadResult && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                  Upload successful!
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    • Processed: {uploadResult.totalProcessed} contacts
                  </p>
                  <p>• New contacts: {uploadResult.newContacts}</p>
                  <p>• Updated contacts: {uploadResult.updatedContacts}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/contacts')}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
            >
              View All Contacts
            </button>
            <button
              onClick={() => router.push('/contacts?pending=true')}
              className="px-5 py-2.5 bg-background border border-border rounded-lg font-medium hover:bg-muted/50 transition-colors text-sm text-foreground"
            >
              View Pending Contacts
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
