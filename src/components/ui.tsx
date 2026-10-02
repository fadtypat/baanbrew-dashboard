// ชิ้นส่วน UI ที่ใช้ร่วมกันทุกแท็บของ Dashboard (สีและ hook อยู่ใน theme.ts)

/* ---------- ไอคอน (SVG inline) ---------- */

const ICONS = {
  sales: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  bill: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2zm3 6h6M9 12h6M9 16h4',
  avg: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  member: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  active: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  sleep: 'M12 6v6l4 2M12 22a10 10 0 100-20 10 10 0 000 20z',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ---------- การ์ด ---------- */

export function GradientTile({
  label,
  value,
  hint,
  icon,
  gradient,
}: {
  label: string
  value: string
  hint?: string
  icon: IconName
  gradient: string
}) {
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-2xl p-4 text-white shadow-lg sm:p-5 ${gradient}`}>
      {/* วงกลมตกแต่ง */}
      <span className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-10 right-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <p className="truncate text-xs font-medium text-white/90 sm:text-sm">{label}</p>
      </div>
      <p className="relative mt-3 truncate text-xl font-semibold tabular-nums drop-shadow-sm sm:text-2xl lg:text-3xl">
        {value}
      </p>
      {hint && <p className="relative mt-1 truncate text-[11px] text-white/80 sm:text-xs">{hint}</p>}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  action,
  className = '',
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`flex flex-col rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(60,30,90,0.06)] sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-stone-800 sm:text-base">{title}</h2>
          {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function LegendDot({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-stone-500">
      <span className={line ? 'h-0.5 w-4 rounded' : 'h-2.5 w-2.5 rounded-full'} style={{ background: color }} />
      {label}
    </span>
  )
}
