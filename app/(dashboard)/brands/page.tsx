import Link from 'next/link'
import { createClient } from '../../_lib/supabase/server'
import type { Brand } from '../../_lib/types'

export default async function BrandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: brands } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your brands</h1>
          <p>Save your colors and logos. Apply with one click on every output.</p>
        </div>
        <Link href="/brands/new" className="btn btn-primary btn-lg">+ New brand</Link>
      </div>

      {!brands?.length ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No brands yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Create a brand to customize your presentation colors and logo</p>
          <Link href="/brands/new" className="btn btn-primary">Create your first brand</Link>
        </div>
      ) : (
        <>
          <div className="section-eyebrow">Saved brands</div>
          <div style={{ height: 18 }} />
          <div className="brands-grid">
            {(brands as Brand[]).map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.id}`}
                className="brand-card"
                style={{ textDecoration: 'none', color: 'var(--ink)' }}
              >
                <div className="brand-avatar" style={{ backgroundColor: brand.primary_color, color: brand.text_color }}>
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  ) : (
                    brand.name[0]
                  )}
                </div>
                <div className="b-name">{brand.name}</div>
                {brand.is_default ? (
                  <div className="default-badge">&#10003; Default</div>
                ) : (
                  <div style={{ height: 24 }} />
                )}
                <div className="swatches" style={{ display: 'flex' }}>
                  {[brand.primary_color, brand.secondary_color, brand.accent_color, brand.background_color, brand.text_color].map(
                    (color, i) => (
                      <div
                        key={i}
                        className="swatch"
                        style={{
                          backgroundColor: color,
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          border: color?.toLowerCase() === '#ffffff' ? '1.5px solid var(--border)' : 'none',
                        }}
                      />
                    )
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
