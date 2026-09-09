'use client'

import React, { useState, useEffect, useRef } from 'react'

interface EditableEmailCellProps {
  id: string
  email: string | null | undefined
  apiEndpoint?: string
  onSave?: ( id: string, email: string | null ) => Promise<void>
  copiedId?: string | null
  onCopy?: ( text: string, id: string ) => void
}

export function EditableEmailCell ( {
  id,
  email,
  apiEndpoint = '/api/alla-bolag',
  onSave,
  copiedId,
  onCopy,
}: EditableEmailCellProps ) {
  const [ isEditing, setIsEditing ] = useState( false )
  const [ currentEmail, setCurrentEmail ] = useState( email || '' )
  const [ draftEmail, setDraftEmail ] = useState( email || '' )
  const [ isSaving, setIsSaving ] = useState( false )
  const inputRef = useRef<HTMLInputElement>( null )

  const prevIdRef = useRef( id )
  useEffect( () => {
    if ( prevIdRef.current !== id ) {
      prevIdRef.current = id
      setIsEditing( false )
      setCurrentEmail( email || '' )
      setDraftEmail( email || '' )
      return
    }
    setCurrentEmail( email || '' )
    if ( !isEditing ) {
      setDraftEmail( email || '' )
    }
  }, [ id, email, isEditing ] )

  useEffect( () => {
    if ( isEditing && inputRef.current ) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [ isEditing ] )

  const handleStartEditing = () => {
    setDraftEmail( currentEmail )
    setIsEditing( true )
    if ( typeof window !== 'undefined' ) {
      window.dispatchEvent( new CustomEvent( 'crm-cell-edit-start' ) )
    }
  }

  const handleCancel = () => {
    setDraftEmail( currentEmail )
    setIsEditing( false )
    if ( typeof window !== 'undefined' ) {
      window.dispatchEvent( new CustomEvent( 'crm-cell-edit-end' ) )
    }
  }

  const handleCommit = async () => {
    const trimmed = draftEmail.trim()
    const finalValue = trimmed.length > 0 ? trimmed : null

    setIsSaving( true )
    try {
      if ( onSave ) {
        await onSave( id, finalValue )
      } else {
        const res = await fetch( apiEndpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify( { id, email: finalValue } ),
        } )
        if ( !res.ok ) {
          throw new Error( `Failed to save email: HTTP ${ res.status }` )
        }
      }

      setCurrentEmail( finalValue || '' )
      setIsEditing( false )
      if ( typeof window !== 'undefined' ) {
        window.dispatchEvent( new CustomEvent( 'crm-cell-edit-end' ) )
      }
    } catch ( err ) {
      console.error( 'Error saving email:', err )
      alert( 'Could not save email. Please try again.' )
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
          type="email"
          data-editing-cell="true"
          value={ draftEmail }
          disabled={ isSaving }
          onChange={ ( e ) => setDraftEmail( e.target.value ) }
          onKeyDown={ handleKeyDown }
          placeholder="name@company.com"
          className="w-[130px] px-1.5 py-0.5 text-xs rounded border border-border bg-background text-foreground outline-none focus:border-foreground/40 disabled:opacity-50 font-sans"
        />
        <button
          type="button"
          onClick={ handleCommit }
          disabled={ isSaving }
          className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium text-[11px] hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          title="Save email"
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

  if ( !currentEmail ) {
    return (
      <div className="group/add inline-block text-xs">
        <button
          type="button"
          onClick={ handleStartEditing }
          className="text-xs text-muted-foreground/70 hover:text-foreground px-1.5 py-0.5 rounded border border-dashed border-border/80 hover:border-border hover:bg-muted/40 transition-colors"
          title="Add email address"
        >
          + Add
        </button>
      </div>
    )
  }

  const isCopied = copiedId === `email-${ id }`

  return (
    <div className="flex items-center gap-1.5 text-xs group/email">
      <a
        href={ `mailto:${ currentEmail }` }
        className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[130px]"
        title={ currentEmail }
      >
        { currentEmail }
      </a>

      <button
        type="button"
        onClick={ handleStartEditing }
        className="text-[11px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/email:opacity-100 shrink-0"
        title="Edit email address"
      >
        Edit
      </button>

      { onCopy && (
        <button
          type="button"
          onClick={ () => onCopy( currentEmail, `email-${ id }` ) }
          className="text-xs text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted transition-colors shrink-0"
          title="Copy to clipboard"
        >
          { isCopied ? 'Copied' : 'Copy' }
        </button>
      ) }
    </div>
  )
}
