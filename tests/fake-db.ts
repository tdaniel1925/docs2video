// A tiny in-memory stand-in for the Supabase client, enough for the texting
// tests: select (with count/head), insert, update, upsert, delete, the usual
// filters, order/limit, maybeSingle/single, unique keys and missing tables.
// Not a general fake — add to it only what a test needs.

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean

export interface FakeDbOptions {
  /** Tables that "don't exist" (answer PGRST205, like a missing migration). */
  missing?: string[]
  /** Unique keys per table, e.g. { hot_alerts: [['user_id','video_id']] }. */
  unique?: Record<string, string[][]>
}

let idSeq = 0
const nextId = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`

function field(r: Row, col: string): unknown {
  if (col.includes('->>')) {
    const [a, b] = col.split('->>')
    const o = r[a] as Record<string, unknown> | null | undefined
    return o ? o[b] : undefined
  }
  return r[col]
}

export function makeFakeDb(seed: Record<string, Row[]> = {}, opts: FakeDbOptions = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }))
  const t = (name: string) => (tables[name] ??= [])

  function builder(name: string) {
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    let payload: Row[] = []
    let patch: Row = {}
    let onConflict: string[] = []
    let countMode = false
    let head = false
    let returning = false
    const filters: Filter[] = []
    let orderBy: { col: string; asc: boolean } | null = null
    let lim: number | null = null

    const violates = (row: Row, ignore?: Row): boolean => {
      const keys = opts.unique?.[name] ?? []
      return keys.some((key) => t(name).some((r) => r !== ignore && key.every((k) => r[k] != null && r[k] === row[k])))
    }

    function run(): { data: unknown; error: { code: string; message: string } | null; count?: number | null } {
      if (opts.missing?.includes(name)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${name}'` }, count: null }
      const match = () => t(name).filter((r) => filters.every((f) => f(r)))
      if (op === 'insert') {
        const out: Row[] = []
        for (const p of payload) {
          const row: Row = { id: nextId(), created_at: new Date().toISOString(), ...p }
          if (violates(row)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
          t(name).push(row); out.push(row)
        }
        return { data: returning ? out : null, error: null }
      }
      if (op === 'upsert') {
        for (const p of payload) {
          const existing = t(name).find((r) => onConflict.every((k) => r[k] === p[k]))
          if (existing) Object.assign(existing, p)
          else t(name).push({ id: nextId(), created_at: new Date().toISOString(), ...p })
        }
        return { data: null, error: null }
      }
      if (op === 'update') {
        const rows = match()
        for (const r of rows) Object.assign(r, patch)
        return { data: returning ? rows : null, error: null }
      }
      if (op === 'delete') {
        const rows = match()
        tables[name] = t(name).filter((r) => !rows.includes(r))
        return { data: null, error: null }
      }
      let rows = match()
      if (orderBy) {
        const { col, asc } = orderBy
        rows = [...rows].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (asc ? 1 : -1))
      }
      const count = rows.length
      if (lim != null) rows = rows.slice(0, lim)
      return { data: head ? null : rows, error: null, count: countMode ? count : null }
    }

    const b = {
      select(_cols?: string, o?: { count?: string; head?: boolean }) {
        if (op === 'select') { countMode = !!o?.count; head = !!o?.head } else returning = true
        return b
      },
      insert(v: Row | Row[]) { op = 'insert'; payload = Array.isArray(v) ? v : [v]; return b },
      upsert(v: Row | Row[], o?: { onConflict?: string }) { op = 'upsert'; payload = Array.isArray(v) ? v : [v]; onConflict = (o?.onConflict ?? 'id').split(','); return b },
      update(v: Row) { op = 'update'; patch = v; return b },
      delete() { op = 'delete'; return b },
      eq(c: string, v: unknown) { filters.push((r) => field(r, c) === v); return b },
      neq(c: string, v: unknown) { filters.push((r) => field(r, c) !== v); return b },
      gt(c: string, v: number | string) { filters.push((r) => (field(r, c) as number | string) > v); return b },
      gte(c: string, v: string) { filters.push((r) => String(field(r, c) ?? '') >= v); return b },
      lte(c: string, v: string) { filters.push((r) => String(field(r, c) ?? '') <= v); return b },
      in(c: string, v: unknown[]) { filters.push((r) => v.includes(field(r, c))); return b },
      order(c: string, o?: { ascending?: boolean }) { orderBy = { col: c, asc: o?.ascending !== false }; return b },
      limit(n: number) { lim = n; return b },
      async maybeSingle() {
        const r = run()
        if (r.error) return r
        const d = Array.isArray(r.data) ? r.data : []
        return { data: d[0] ?? null, error: null }
      },
      async single() {
        const r = run()
        if (r.error) return r
        const d = Array.isArray(r.data) ? r.data : []
        return d.length ? { data: d[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        try { resolve(run()) } catch (e) { reject?.(e) }
      },
    }
    return b
  }

  return {
    tables,
    rows: (name: string) => t(name),
    client: { from: (name: string) => builder(name) } as unknown as import('@supabase/supabase-js').SupabaseClient,
  }
}
