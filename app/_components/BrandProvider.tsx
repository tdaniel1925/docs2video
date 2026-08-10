'use client'

// Makes the current storefront readable from CLIENT components.
//
// The host is only knowable on the server, so the root layout reads it once and
// hands it down through this context. Client components must NOT sniff
// window.location themselves: the server would render the default brand and the
// browser would render a different one, which is a hydration mismatch.
//
// The default is Docs2Video, so any client component rendered outside this
// provider behaves exactly as it always did.
import { createContext, useContext } from 'react'
import { DOCS2VIDEO, type Brand } from '../_lib/brand'

const BrandContext = createContext<Brand>(DOCS2VIDEO)

export function BrandProvider({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export function useBrand(): Brand {
  return useContext(BrandContext)
}
