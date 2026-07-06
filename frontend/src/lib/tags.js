export const PASTEL_PALETTES = [
  { bg: 'rgba(244, 63, 94, 0.08)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.2)' },
  { bg: 'rgba(217, 70, 239, 0.08)', text: '#c026d3', border: 'rgba(217, 70, 239, 0.2)' },
  { bg: 'rgba(124, 58, 237, 0.08)', text: '#7c3aed', border: 'rgba(124, 58, 237, 0.2)' },
  { bg: 'rgba(59, 130, 246, 0.08)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.2)' },
  { bg: 'rgba(14, 165, 233, 0.08)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.2)' },
  { bg: 'rgba(45, 212, 191, 0.08)', text: '#0d9488', border: 'rgba(45, 212, 191, 0.2)' },
  { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' },
  { bg: 'rgba(245, 158, 11, 0.08)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' },
  { bg: 'rgba(249, 115, 22, 0.08)', text: '#ea580c', border: 'rgba(249, 115, 22, 0.2)' },
]

export function getTagColorDeterministic(tag) {
  const norm = tag.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % PASTEL_PALETTES.length
  return PASTEL_PALETTES[index]
}

export function getTagStyle(tag, customColorsMap = {}) {
  const norm = tag.trim().toLowerCase()
  const colorObj = customColorsMap[norm] || getTagColorDeterministic(norm)
  return {
    backgroundColor: colorObj.bg,
    color: colorObj.text,
    borderColor: colorObj.border
  }
}
