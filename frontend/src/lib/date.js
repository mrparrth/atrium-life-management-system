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
  const days = daysSince(iso)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days/7)>1?'s':''} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days/30)>1?'s':''} ago`
  return `${Math.floor(days / 365)} year${Math.floor(days/365)>1?'s':''} ago`
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
