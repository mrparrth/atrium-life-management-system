// Parses [[wiki-link]] syntax in markdown source.
// Resolves to existing notes by case-insensitive title match.
// Renders as a router-link to /notes/:id, or a "missing" pill if not found.

export function findWikiTargets(body) {
  // returns array of unique titles found inside [[...]]
  const set = new Set()
  const re = /\[\[([^\]\n]+)\]\]/g
  let m
  while ((m = re.exec(body || '')) !== null) {
    const t = m[1].trim()
    if (t) set.add(t)
  }
  return Array.from(set)
}

export function resolveTitle(title, notes) {
  if (!title) return null
  const t = title.trim().toLowerCase()
  return notes.find(n => (n.title || '').trim().toLowerCase() === t) || null
}

// Pre-process markdown body — replace [[Title]] with anchor placeholders
// so `marked` keeps them intact. We escape them as HTML tokens that we
// post-process after render.
export function wikilinkPreprocess(body, notes) {
  if (!body) return ''
  return body.replace(/\[\[([^\]\n]+)\]\]/g, (_, raw) => {
    const title = raw.trim()
    const target = resolveTitle(title, notes)
    if (target) {
      return `<a class="wikilink" data-note-id="${target.id}" href="#/notes/${target.id}">${escapeHtml(title)}</a>`
    }
    return `<span class="wikilink wikilink-missing" title="No matching note">${escapeHtml(title)}</span>`
  })
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// For a given note, return notes that link TO it via [[title]]
export function backlinksOf(note, notes) {
  if (!note) return []
  const myTitle = (note.title || '').trim().toLowerCase()
  if (!myTitle) return []
  return notes.filter(n => {
    if (n.id === note.id) return false
    const titles = findWikiTargets(n.body).map(t => t.trim().toLowerCase())
    return titles.includes(myTitle)
  })
}
