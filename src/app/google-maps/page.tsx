'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GoogleMapsRedirect () {
  const router = useRouter()

  useEffect( () => {
    router.replace( '/contacts' )
  }, [ router ] )

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Redirecting to Google Maps Contacts...
    </div>
  )
}
