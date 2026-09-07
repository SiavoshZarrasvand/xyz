'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InCosmeticRedirect () {
  const router = useRouter()

  useEffect( () => {
    router.replace( '/in-cosmetics' )
  }, [ router ] )

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Redirecting to In-Cosmetics Global...
    </div>
  )
}
