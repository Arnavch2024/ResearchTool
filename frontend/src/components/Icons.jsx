import React from 'react'

export function Icon({ d, size = 14, stroke = 1.75, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {d}
    </svg>
  )
}

export const Mark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 19V7.2c0-.7.4-1.2 1-1.2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="17.5" cy="16.5" r="2.5" fill="currentColor"/>
  </svg>
)

export const IcoPaper = (p) => <Icon {...p} d={<><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></>} />
export const IcoSearch = (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>} />
export const IcoCode = (p) => <Icon {...p} d={<><path d="M9 8l-5 4 5 4M15 8l5 4-5 4"/></>} />
export const IcoBox = (p) => <Icon {...p} d={<><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></>} />
export const IcoNodes = (p) => <Icon {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4.5V14"/></>} />
export const IcoWrench = (p) => <Icon {...p} d={<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7z"/>} />
export const IcoSend = (p) => <Icon {...p} d={<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>} />
export const IcoClose = (p) => <Icon {...p} d={<><path d="M6 6l12 12M18 6L6 18"/></>} />
export const IcoUpload = (p) => <Icon {...p} d={<><path d="M12 16V5M8 9l4-4 4 4"/><path d="M4 19h16"/></>} />
export const IcoUser = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19"/></>} />
export const IcoBot = (p) => <Icon {...p} d={<><rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V5M9 13h.01M15 13h.01"/></>} />
export const IcoExpand = (p) => <Icon {...p} d={<><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></>} />
export const IcoExt = (p) => <Icon {...p} d={<><path d="M14 4h6v6M10 14L20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></>} />
export const IcoCheck = (p) => <Icon {...p} d={<path d="M5 13l4 4 10-10"/>} />
