/**
 * A tiny in-memory stand-in for the Supabase client, for tests that run REAL
 * route code. Filters really filter (eq / neq / in / is / lt / gt / lte / gte /
 * like, plus the simple `or(a.lt.X,and(b.is.null,c.lt.X))` form the restart
 * route uses), so a test can prove that a write did — or did not — touch a row.
 *
 * Not a full PostgREST: just enough of the chain the app uses. Every write is
 * logged in `db.log` so tests can assert "nothing was written".
 */

type Row = Record<string, any>
type Filter = (r: Row) => boolean

export interface FakeDb {
  tables: Record<string, Row[]>
  log: string[]
  /** Make a table's next operations fail with this error (until cleared). */
  failOn: Record<string, { op?: 'select' | 'insert' | 'update' | 'upsert' | 'delete'; error: { message: string; code?: string } } | undefined>
  rpc: Record<string, (args: any) => { data: any; error: any }>
  storageRemoved: string[]
}

export function makeDb(tables: Record<string, Row[]> = {}): FakeDb {
  return { tables, log: [], failOn: {}, rpc: {}, storageRemoved: [] }
}

function getPath(r: Row, col: string): any {
  // draft_data->>source  /  draft_data->source
  const m = col.match(/^([a-z_]+)->>?([a-zA-Z_]+)$/)
  if (m) {
    const v = r[m[1]]?.[m[2]]
    return v === undefined ? null : v
  }
  return r[col]
}

function cmp(op: string, a: any, b: any): boolean {
  if (op === 'is') return b === null || b === 'null' ? a === null || a === undefined : a === b
  if (op === 'eq') return String(a) === String(b)
  if (op === 'neq') return String(a) !== String(b)
  const A = typeof a === 'string' && !isNaN(Date.parse(a)) && isNaN(Number(a)) ? Date.parse(a) : Number(a)
  const B = typeof b === 'string' && !isNaN(Date.parse(b)) && isNaN(Number(b)) ? Date.parse(b) : Number(b)
  if (a === null || a === undefined) return false
  if (op === 'lt') return A < B
  if (op === 'gt') return A > B
  if (op === 'lte') return A <= B
  if (op === 'gte') return A >= B
  return false
}

/** Parse "a.lt.X,and(b.is.null,c.lt.X)" into a filter (top level = OR). */
function parseOr(expr: string): Filter {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of expr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur) parts.push(cur)
  const one = (p: string): Filter => {
    const andM = p.match(/^and\((.*)\)$/)
    if (andM) {
      const subs = andM[1].split(',').map(one)
      return (r) => subs.every((f) => f(r))
    }
    const [col, op, ...rest] = p.split('.')
    const val = rest.join('.')
    return (r) => cmp(op, getPath(r, col), val === 'null' ? null : val)
  }
  const fs = parts.map(one)
  return (r) => fs.some((f) => f(r))
}

export function fakeClient(db: FakeDb) {
  const from = (table: string) => {
    db.tables[table] = db.tables[table] || []
    const filters: Filter[] = []
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    let payload: any = null
    let wantRows = false
    let limitN: number | null = null
    let countMode = false
    let onConflict: string | null = null

    const run = (mode: 'many' | 'single' | 'maybe') => {
      const fail = db.failOn[table]
      if (fail && (!fail.op || fail.op === op)) return { data: null, error: fail.error, count: null }
      const rows = db.tables[table]
      if (op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload]
        for (const p of list) {
          const pk = p.fingerprint !== undefined ? 'fingerprint' : p.event_id !== undefined ? 'event_id' : null
          if (pk && rows.some((r) => r[pk] === p[pk])) return { data: null, error: { message: 'duplicate key', code: '23505' }, count: null }
        }
        for (const p of list) rows.push({ ...p })
        db.log.push(`insert ${table}`)
        return { data: wantRows ? list : null, error: null, count: null }
      }
      if (op === 'upsert') {
        const key = onConflict || 'id'
        const list = Array.isArray(payload) ? payload : [payload]
        for (const p of list) {
          const hit = rows.find((r) => r[key] === p[key])
          if (hit) Object.assign(hit, p); else rows.push({ ...p })
        }
        db.log.push(`upsert ${table}`)
        return { data: null, error: null, count: null }
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        for (const r of matched) Object.assign(r, payload)
        db.log.push(`update ${table} (${matched.length})`)
        return { data: wantRows ? matched.map((r) => ({ ...r })) : null, error: null, count: null }
      }
      if (op === 'delete') {
        db.tables[table] = rows.filter((r) => !matched.includes(r))
        db.log.push(`delete ${table} (${matched.length})`)
        return { data: null, error: null, count: null }
      }
      if (limitN !== null) matched = matched.slice(0, limitN)
      if (countMode) return { data: null, error: null, count: matched.length }
      if (mode === 'single') return matched.length === 1 ? { data: { ...matched[0] }, error: null } : { data: null, error: { message: 'not exactly one row', code: 'PGRST116' } }
      if (mode === 'maybe') return { data: matched[0] ? { ...matched[0] } : null, error: null }
      return { data: matched.map((r) => ({ ...r })), error: null, count: matched.length }
    }

    const q: any = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => { if (op !== 'select') wantRows = true; if (opts?.count) countMode = true; return q },
      insert: (p: any) => { op = 'insert'; payload = p; return q },
      update: (p: any) => { op = 'update'; payload = p; return q },
      upsert: (p: any, o?: { onConflict?: string }) => { op = 'upsert'; payload = p; onConflict = o?.onConflict ?? null; return q },
      delete: () => { op = 'delete'; return q },
      eq: (c: string, v: any) => { filters.push((r) => cmp('eq', getPath(r, c), v)); return q },
      neq: (c: string, v: any) => { filters.push((r) => cmp('neq', getPath(r, c), v)); return q },
      in: (c: string, vs: any[]) => { filters.push((r) => vs.map(String).includes(String(getPath(r, c)))); return q },
      is: (c: string, v: any) => { filters.push((r) => cmp('is', getPath(r, c), v)); return q },
      lt: (c: string, v: any) => { filters.push((r) => cmp('lt', getPath(r, c), v)); return q },
      gt: (c: string, v: any) => { filters.push((r) => cmp('gt', getPath(r, c), v)); return q },
      lte: (c: string, v: any) => { filters.push((r) => cmp('lte', getPath(r, c), v)); return q },
      gte: (c: string, v: any) => { filters.push((r) => cmp('gte', getPath(r, c), v)); return q },
      like: (c: string, pat: string) => { const re = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); filters.push((r) => re.test(String(getPath(r, c) ?? ''))); return q },
      not: (c: string, o: string, v: any) => { filters.push((r) => !cmp(o, getPath(r, c), v)); return q },
      or: (expr: string) => { filters.push(parseOr(expr)); return q },
      order: () => q,
      limit: (n: number) => { limitN = n; return q },
      single: async () => run('single'),
      maybeSingle: async () => run('maybe'),
      then: (ok: (v: any) => any, bad?: (e: any) => any) => Promise.resolve(run('many')).then(ok, bad),
    }
    return q
  }
  return {
    from,
    rpc: async (name: string, args: any) => {
      const h = db.rpc[name]
      if (!h) return { data: null, error: { message: `function ${name} does not exist` } }
      return h(args)
    },
    storage: {
      from: (_bucket: string) => ({
        remove: async (paths: string[]) => { db.storageRemoved.push(...paths); return { data: null, error: null } },
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://store.test/${p}` } }),
        upload: async () => ({ data: null, error: null }),
      }),
    },
  }
}
