// Priority derivation from Important + Urgent
export const PRIORITY = {
  critical:    { key: 'critical',    label: 'Critical',    sub: 'Important · Urgent',         tone: 'pri-critical' },
  strategic:   { key: 'strategic',   label: 'Strategic',   sub: 'Important · Not urgent',     tone: 'pri-strategic' },
  interruptive:{ key: 'interruptive',label: 'Interruptive',sub: 'Urgent · Not important',     tone: 'pri-interruptive' },
  backlog:     { key: 'backlog',     label: 'Backlog',     sub: 'Neither important nor urgent', tone: 'pri-backlog' },
}

export function derivePriority(important, urgent) {
  if (important && urgent) return PRIORITY.critical
  if (important && !urgent) return PRIORITY.strategic
  if (!important && urgent) return PRIORITY.interruptive
  return PRIORITY.backlog
}
