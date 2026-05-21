'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../_lib/supabase/client'
import type { Brand } from '../../_lib/types'

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null) // brand id or 'bulk'

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('brands')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setBrands(data as Brand[])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('brands').delete().eq('id', id)
    setBrands(prev => prev.filter(b => b.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    setDeleting(null)
    setConfirmDelete(null)
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    setBulkDeleting(true)
    const supabase = createClient()
    for (const id of selectedIds) {
      await supabase.from('brands').delete().eq('id', id)
    }
    setBrands(prev => prev.filter(b => !selectedIds.has(b.id)))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    setConfirmDelete(null)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === brands.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(brands.map(b => b.id)))
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner" /></div>
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your brands</h1>
          <p>Save your colors and logos. Apply with one click on every output.</p>
        </div>
        <Link href="/brands/new" className="btn btn-primary btn-lg">+ New brand</Link>
      </div>

      {!brands.length ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No brands yet</p>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>Create a brand to customize your presentation colors and logo</p>
          <Link href="/brands/new" className="btn btn-primary">Create your first brand</Link>
        </div>
      ) : (
        <>
          {/* Bulk actions bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="section-eyebrow" style={{ margin: 0 }}>Saved brands ({brands.length})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {brands.length > 1 && (
                <button
                  onClick={toggleSelectAll}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}
                >
                  {selectedIds.size === brands.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
              {selectedIds.size > 0 && confirmDelete !== 'bulk' && (
                <button
                  onClick={() => setConfirmDelete('bulk')}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                    cursor: 'pointer',
                  }}
                >
                  {`Delete ${selectedIds.size} selected`}
                </button>
              )}
              {confirmDelete === 'bulk' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>Delete {selectedIds.size} brand{selectedIds.size > 1 ? 's' : ''}?</span>
                  <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#b91c1c', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {bulkDeleting ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(null)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="brands-grid">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="brand-card"
                style={{
                  position: 'relative',
                  border: selectedIds.has(brand.id) ? '2px solid var(--mint)' : undefined,
                }}
              >
                {/* Select checkbox */}
                {brands.length > 1 && (
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleSelect(brand.id) }}
                    style={{
                      position: 'absolute', top: 8, left: 8, width: 22, height: 22,
                      borderRadius: 6, border: selectedIds.has(brand.id) ? '2px solid var(--mint)' : '2px solid var(--border)',
                      background: selectedIds.has(brand.id) ? 'var(--mint)' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', zIndex: 2, fontSize: 12, color: 'white', fontWeight: 700,
                    }}
                  >
                    {selectedIds.has(brand.id) && '\u2713'}
                  </div>
                )}

                {/* Delete button / inline confirm */}
                {confirmDelete === brand.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: 6, right: 6, zIndex: 3,
                      background: 'white', borderRadius: 8, padding: '6px 10px',
                      border: '1px solid #fca5a5', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#b91c1c', fontWeight: 600 }}>Delete?</span>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(brand.id) }}
                      disabled={deleting === brand.id}
                      style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#b91c1c', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {deleting === brand.id ? '...' : 'Yes'}
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(null) }}
                      style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)' }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(brand.id) }}
                    style={{
                      position: 'absolute', top: 8, right: 8, width: 26, height: 26,
                      borderRadius: '50%', border: '1px solid var(--border-light)',
                      background: 'white', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', zIndex: 2,
                      fontSize: 14, color: 'var(--ink-light)', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.borderColor = '#fca5a5' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'var(--ink-light)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
                    title="Delete brand"
                  >
                    {'\u00D7'}
                  </button>
                )}

                {/* Brand card content — clickable link */}
                <Link
                  href={`/brands/${brand.id}`}
                  style={{ textDecoration: 'none', color: 'var(--ink)', display: 'block' }}
                >
                  <div className="brand-avatar" style={{ backgroundColor: brand.primary_color, color: brand.text_color }}>
                    {(brand.logo_file_url || brand.logo_url) ? (
                      <img src={brand.logo_file_url || brand.logo_url!} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                    ) : (
                      brand.name[0]
                    )}
                  </div>
                  <div className="b-name">{brand.name}</div>
                  {brand.is_default ? (
                    <div className="default-badge">{'\u2713'} Default</div>
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
