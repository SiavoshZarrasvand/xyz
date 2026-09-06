import { NextRequest } from 'next/server'
import { crmEvents, CRMEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET ( request: NextRequest ) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream( {
    start ( controller ) {
      // Send initial connection event
      controller.enqueue( encoder.encode( `data: ${ JSON.stringify( { type: 'CONNECTED', timestamp: Date.now() } ) }\n\n` ) )

      const listener = ( event: CRMEvent ) => {
        try {
          controller.enqueue( encoder.encode( `data: ${ JSON.stringify( event ) }\n\n` ) )
        } catch {
          crmEvents.off( 'event', listener )
        }
      }

      crmEvents.on( 'event', listener )

      request.signal.addEventListener( 'abort', () => {
        crmEvents.off( 'event', listener )
      } )
    },
  } )

  return new Response( stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  } )
}
