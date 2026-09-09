'use client'

import React, { useState, useEffect, useRef } from 'react'

interface EditableWebsiteCellProps {
  id: string
  website: string | null | undefined
  apiEndpoint?: string
  onSave?: ( id: string, website: string | null ) => Promise<void>
}

export function EditableWebsiteCell ( {
  id,
  website,
  apiEndpoint = '/api/alla-bolag',
  onSave,
}: EditableWebsiteCellProps ) {
  const [ isEditing, setIsEditing ] = useState( false )
  const [ currentWebsite, setCurrentWebsite ] = useState( website || '' )
  const [ draftWebsite, setDraftWebsite ] = useState( website || '' )
  const [ isSaving, setIsSaving ] = useState( false )
  const inputRef = useRef<HTMLInputElement>( null )

  const prevIdRef = useRef( id )
  useEffect( () => {
    if ( prevIdRef.current !== id ) {
      prevIdRef.current = id
      setIsEditing( false )
      setCurrentWebsite( website || '' )
      setDraftWebsite( website || '' )
      return
    }
    setCurrentWebsite( website || '' )
    if ( !isEditing ) {
      setDraftWebsite( website || '' )
    }
  }, [ id, website, isEditing ] )

  useEffect( () => {
    if ( isEditing && inputRef.current ) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [ isEditing ] )

  const handleStartEditing = () => {
    setDraftWebsite( currentWebsite )
    setIsEditing( true )
    if ( typeof window !== 'undefined' ) {
      window.dispatchEvent( new CustomEvent( 'crm-cell-edit-start' ) )
    }
  }

  const handleCancel = () => {
    setDraftWebsite( currentWebsite )
    setIsEditing( false )
    if ( typeof window !== 'undefined' ) {
      window.dispatchEvent( new CustomEvent( 'crm-cell-edit-end' ) )
    }
  }

  const handleCommit = async () => {
    let trimmed = draftWebsite.trim()
    let finalValue: string | null = null

    if ( trimmed.length > 0 ) {
      // Normalise URL protocol if user entered naked domain (e.g. example.com)
      if ( !/^https?:\/\//i.test( trimmed ) && trimmed.includes( '.' ) ) {
        trimmed = `https://${ trimmed }`
      }
      finalValue = trimmed
    }

    setIsSaving( true )
    try {
      if ( onSave ) {
        await onSave( id, finalValue )
      } else {
        const res = await fetch( apiEndpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify( { id, website: finalValue } ),
        } )
        if ( !res.ok ) {
          throw new Error( `Failed to save website: HTTP ${ res.status }` )
        }
      }

      setCurrentWebsite( finalValue || '' )
      setIsEditing( false )
      if ( typeof window !== 'undefined' ) {
        window.dispatchEvent( new CustomEvent( 'crm-cell-edit-end' ) )
      }
    } catch ( err ) {
      console.error( 'Error saving website:', err )
      alert( 'Could not save website. Please try again.' )
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
          type="text"
          data-editing-cell="true"
          value={ draftWebsite }
          disabled={ isSaving }
          onChange={ ( e ) => setDraftWebsite( e.target.value ) }
          onKeyDown={ handleKeyDown }
          placeholder="https://example.com"
          className="w-[140px] px-1.5 py-0.5 text-xs rounded border border-border bg-background text-foreground outline-none focus:border-foreground/40 disabled:opacity-50 font-sans"
        />
        <button
          type="button"
          onClick={ handleCommit }
          disabled={ isSaving }
          className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium text-[11px] hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          title="Save website"
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

  if ( !currentWebsite ) {
    return (
      <div className="group/add inline-block text-xs">
        <button
          type="button"
          onClick={ handleStartEditing }
          className="text-xs text-muted-foreground/70 hover:text-foreground px-1.5 py-0.5 rounded border border-dashed border-border/80 hover:border-border hover:bg-muted/40 transition-colors"
          title="Add website"
        >
          + Add
        </button>
      </div>
    )
  }

  const href = currentWebsite.startsWith( 'http' ) ? currentWebsite : `https://${ currentWebsite }`
  const displayLabel = currentWebsite.replace( /^https?:\/\/(www\.)?/, '' ).replace( /\/$/, '' )

  return (
    <div className="flex items-center gap-1.5 text-xs group/web">
      <a
        href={ href }
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline truncate block max-w-[130px]"
        title={ currentWebsite }
      >
        { displayLabel }
      </a>
      <span className="text-muted-foreground/60 text-[10px] shrink-0">↗</span>

      <button
        type="button"
        onClick={ handleStartEditing }
        className="text-[11px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/web:opacity-100 shrink-0"
        title="Edit website"
      >
        Edit
      </button>
    </div>
  )
}
