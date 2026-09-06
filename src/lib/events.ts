import { EventEmitter } from 'node:events'

// Global event emitter for in-process broadcast across API routes and SSE streams
const globalForEvents = globalThis as unknown as {
  crmEvents?: EventEmitter
}

export const crmEvents = globalForEvents.crmEvents || new EventEmitter()
crmEvents.setMaxListeners( 100 )

if ( process.env.NODE_ENV !== 'production' ) {
  globalForEvents.crmEvents = crmEvents
}

export type CRMEvent =
  | { type: 'CONNECTED'; timestamp: number }
  | { type: 'CONTACTS_UPDATED'; total: number; timestamp: number }
  | { type: 'CONTACTS_DELETED'; count: number; timestamp: number }

export function broadcastCrmEvent ( event: CRMEvent ) {
  crmEvents.emit( 'event', event )
}
