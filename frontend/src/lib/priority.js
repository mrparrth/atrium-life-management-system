// Priority derivation from Important + Urgent
export const PRIORITY = {
  critical: { key: "critical", label: "1. Do Now", sub: "Important · Urgent", tone: "pri-critical" },
  strategic: { key: "strategic", label: "2. Deep Work", sub: "Important · Not urgent", tone: "pri-strategic" },
  interruptive: {
    key: "interruptive",
    label: "3. Reactive",
    sub: "Urgent · Not important",
    tone: "pri-interruptive",
  },
  backlog: { key: "backlog", label: "4. Low", sub: "Neither important nor urgent", tone: "pri-backlog" },
};

export function derivePriority(important, urgent) {
  if (important && urgent) return PRIORITY.critical;
  if (important && !urgent) return PRIORITY.strategic;
  if (!important && urgent) return PRIORITY.interruptive;
  return PRIORITY.backlog;
}
