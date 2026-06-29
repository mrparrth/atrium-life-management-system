import dayjs from 'dayjs'

export function daysSince(iso) {
  if (!iso) return Infinity
  return dayjs().diff(dayjs(iso), 'day')
}
export function isOverdue(iso) {
  if (!iso) return false
  return dayjs(iso).startOf('day').isBefore(dayjs().startOf('day'))
}
export function isToday(iso) {
  if (!iso) return false
  return dayjs(iso).isSame(dayjs(), 'day')
}
export function isWithinDays(iso, n) {
  if (!iso) return false
  const diff = dayjs(iso).startOf('day').diff(dayjs().startOf('day'), 'day')
  return diff >= 0 && diff <= n
}
export function fromNow(iso) {
  if (!iso) return ''
  const d = dayjs(iso)
  const now = dayjs()
  const diffMs = now.diff(d)
  
  if (diffMs < 0) return 'just now'
  
  const diffMins = now.diff(d, 'minute')
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  
  const diffHours = now.diff(d, 'hour')
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  
  const diffDays = now.diff(d, 'day')
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays/7)>1?'s':''} ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays/30)>1?'s':''} ago`
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays/365)>1?'s':''} ago`
}
export function inFuture(iso) {
  if (!iso) return ''
  const days = -daysSince(iso)
  if (days < 0) return fromNow(iso)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 7) return `in ${days} days`
  return dayjs(iso).format('MMM D')
}
export function formatDate(iso, fmt = 'MMM D') {
  if (!iso) return ''
  return dayjs(iso).format(fmt)
}
