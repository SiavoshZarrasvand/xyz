'use client'

import React, { useState, useEffect, useRef } from 'react'
import { parsePhoneNumber } from '@/lib/phone'

interface PhoneCellProps {
  phone: string | null | undefined
  id: string
  apiEndpoint?: string
  onSave?: ( id: string, phone: string | null ) => Promise<void>
  copiedId?: string | null
  onCopy?: ( text: string, id: string ) => void
}

export function PhoneCell ( {
  phone,
  id,
  apiEndpoint = '/api/alla-bolag',
  onSave,
  copiedId,
  onCopy,
}: PhoneCellProps ) {
  const [ isEditing, setIsEditing ] = useState( false )
  const [ currentPhone, setCurrentPhone ] = useState( phone || '' )
  const [ draftPhone, setDraftPhone ] = useState( phone || '' )
  const [ isSaving, setIsSaving ] = useState( false )
  const inputRef = useRef<HTMLInputElement>( null )

  useEffect( () => {
    setCurrentPhone( phone || '' )
    if ( !isEditing ) {
      setDraftPhone( phone || '' )
    }
  }, [ phone, isEditing ] )

  useEffect( () => {
    if ( isEditing && inputRef.current ) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [ isEditing ] )

  const handleStartEditing = () => {
    setDraftPhone( currentPhone )
    setIsEditing( true )
  }

  const handleCancel = () => {
    setDraftPhone( currentPhone )
    setIsEditing( false )
  }

  const handleCommit = async () => {
    const trimmed = draftPhone.trim()
    const finalValue = trimmed.length > 0 ? trimmed : null

    setIsSaving( true )
    try {
      if ( onSave ) {
        await onSave( id, finalValue )
      } else {
        const res = await fetch( apiEndpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify( { id, phone: finalValue } ),
        } )
        if ( !res.ok ) {
          throw new Error( `Failed to save phone: HTTP ${ res.status }` )
        }
      }

      setCurrentPhone( finalValue || '' )
      setIsEditing( false )
    } catch ( err ) {
      console.error( 'Error saving phone:', err )
      alert( 'Could not save phone. Please try again.' )
    } finally {
      setIsSaving( false )
    }
  }

  const handleKeyDown = ( e: React.KeyboardEvent<HTMLInputElement> ) => {
    if ( e.key === 'Enter' ) {
      e.preventDefault()
      handleCommit()
    } else if ( e.key === 'Escape' ) {
      e.preventDefault()
      handleCancel()
    }
  }

  if ( isEditing ) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <input
          ref={ inputRef }
          type="tel"
          value={ draftPhone }
          disabled={ isSaving }
          onChange={ ( e ) => setDraftPhone( e.target.value ) }
          onKeyDown={ handleKeyDown }
          placeholder="070-123 45 67"
          className="w-[125px] px-1.5 py-0.5 text-xs rounded border border-border bg-background text-foreground outline-none focus:border-foreground/40 disabled:opacity-50 font-sans"
        />
        <button
          type="button"
          onClick={ handleCommit }
          disabled={ isSaving }
          className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium text-[11px] hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          title="Save phone number"
        >
          { isSaving ? '...' : 'Save' }
        </button>
        <button
          type="button"
          onClick={ handleCancel }
          disabled={ isSaving }
          className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground font-medium text-[11px] hover:bg-muted transition-colors shrink-0"
          title="Cancel"
        >
          Cancel
        </button>
      </div>
    )
  }

  if ( !currentPhone ) {
    return (
      <div className="group/add inline-block text-xs">
        <button
          type="button"
          onClick={ handleStartEditing }
          className="text-xs text-muted-foreground/70 hover:text-foreground px-1.5 py-0.5 rounded border border-dashed border-border/80 hover:border-border hover:bg-muted/40 transition-colors"
          title="Add phone number"
        >
          + Add
        </button>
      </div>
    )
  }

  const info = parsePhoneNumber( currentPhone )
  const isCopied = copiedId === `phone-${ id }`

  return (
    <div className="flex items-center gap-1.5 text-xs group/phone">
      <a
        href={ info.href }
        target={ info.isMobile ? '_blank' : undefined }
        rel={ info.isMobile ? 'noopener noreferrer' : undefined }
        className={ `font-medium truncate transition-colors ${
          info.isMobile
            ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline'
            : 'text-foreground hover:text-primary hover:underline'
        }` }
        title={ info.isMobile ? `Open WhatsApp chat with ${ info.formatted }` : `Call ${ info.formatted }` }
      >
        { info.formatted }
      </a>

      { info.isMobile && (
        <a
          href={ info.whatsappUrl! }
          target="_blank"
          rel="noopener noreferrer"
          title="Open WhatsApp chat"
          className="text-[10px] px-1 py-0.2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800 font-medium shrink-0 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
        >
          WA
        </a>
      ) }

      <button
        type="button"
        onClick={ handleStartEditing }
        className="text-[11px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/phone:opacity-100 shrink-0"
        title="Edit phone number"
      >
        Edit
      </button>

      { onCopy && (
        <button
          type="button"
          onClick={ () => onCopy( currentPhone, `phone-${ id }` ) }
          className="text-xs text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted transition-colors shrink-0"
          title="Copy to clipboard"
        >
          { isCopied ? 'Copied' : 'Copy' }
        </button>
      ) }
    </div>
  )
}
