// Phone number classification and link generation
// Detects mobile telephone numbers (e.g. Swedish 07x / +467x, and international mobile formats)
// and produces WhatsApp outreach links (https://wa.me/...) or standard tel: URIs for fixed landlines.

export interface PhoneInfo {
  raw: string
  formatted: string
  isMobile: boolean
  href: string
  type: 'whatsapp' | 'tel'
  whatsappUrl: string | null
  telUrl: string
}

export function parsePhoneNumber ( raw: string ): PhoneInfo {
  const trimmed = ( raw || '' ).trim()
  const digits = trimmed.replace( /\D/g, '' )

  let isMobile = false
  let waDigits = ''

  // Swedish mobile patterns:
  // - Starts with 07 (070, 072, 073, 076, 079) and has 9 to 11 digits
  // - Starts with +46 7, 0046 7, or 467 and has 9 to 11 digits
  if ( trimmed.startsWith( '+46' ) || trimmed.startsWith( '0046' ) || digits.startsWith( '467' ) ) {
    const after46 = digits.startsWith( '0046' )
      ? digits.slice( 4 )
      : digits.startsWith( '46' )
      ? digits.slice( 2 )
      : digits
    if ( after46.startsWith( '7' ) && after46.length >= 8 && after46.length <= 10 ) {
      isMobile = true
      waDigits = `46${ after46 }`
    }
  } else if ( digits.startsWith( '07' ) && digits.length >= 9 && digits.length <= 11 ) {
    isMobile = true
    waDigits = `46${ digits.slice( 1 ) }`
  } else if ( trimmed.startsWith( '+' ) ) {
    // Common international mobile formats
    if (
      digits.startsWith( '447' ) || // UK mobile (07xxx)
      digits.startsWith( '346' ) || digits.startsWith( '347' ) || // Spain mobile (6xx, 7xx)
      digits.startsWith( '336' ) || digits.startsWith( '337' ) || // France mobile (06, 07)
      digits.startsWith( '4915' ) || digits.startsWith( '4916' ) || digits.startsWith( '4917' ) // Germany mobile
    ) {
      isMobile = true
      waDigits = digits
    }
  }

  const telUrl = `tel:${ trimmed.startsWith( '+' ) ? '+' : '' }${ digits }`
  const whatsappUrl = isMobile && waDigits ? `https://wa.me/${ waDigits }` : null

  return {
    raw: trimmed,
    formatted: trimmed,
    isMobile,
    href: isMobile && whatsappUrl ? whatsappUrl : telUrl,
    type: isMobile ? 'whatsapp' : 'tel',
    whatsappUrl,
    telUrl,
  }
}
