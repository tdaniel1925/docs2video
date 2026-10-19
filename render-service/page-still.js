// A presentation's library thumbnail: which pages may be drawn (server.js /page-still).
// Only our own stored presentations — the public videos bucket's presentations/
// folder on our Supabase — never an arbitrary address (no fetching the open web
// on a caller's say-so).

/** True for https://<our supabase host>/storage/v1/object/public/videos/presentations/<uuid>.html (any ?query). */
function isOurPresentationUrl(raw, supabaseUrl) {
  try {
    const u = new URL(String(raw))
    const base = new URL(String(supabaseUrl || ''))
    return u.protocol === 'https:' && u.host === base.host
      && /^\/storage\/v1\/object\/public\/videos\/presentations\/[0-9a-f-]{36}\.html$/i.test(u.pathname)
  } catch { return false }
}

module.exports = { isOurPresentationUrl }
