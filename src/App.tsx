import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  dailySales,
  formatBaht,
  formatBahtCompact,
  formatNumber,
  formatPercent,
  formatThaiDate,
  kpis,
  parseSales,
  salesByBranch,
  salesByPaymentMethod,
  withMovingAverage,
  type SaleRow,
} from './lib/metrics.js'

// โทนสีหลัก: ชมพู → ม่วง → ฟ้า → ส้มเหลือง
const PINK = '#e0428f'
const PURPLE = '#7c4dff'
const BLUE = '#2f8fe0'
const AMBER = '#f0a020'
const TEAL = '#12a594'
const PAYMENT_COLORS = [PINK, PURPLE, BLUE, AMBER, TEAL] // ลำดับคงที่ ตามอันดับยอดขาย (5 วิธีชำระ)
const DAILY_COLOR = '#ddd3ea' // เส้นรายวันแบบจาง
const AXIS_TICK = { fill: '#9a93a8', fontSize: 12 }
const GRID_COLOR = '#efeaf5'
const TOOLTIP_STYLE = {
  contentStyle: {
    border: 'none',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(60, 30, 90, 0.15)',
    fontFamily: 'Prompt, sans-serif',
    fontSize: 13,
  },
}

// true เมื่อจอแคบกว่า breakpoint sm ของ Tailwind (640px) — ใช้ปรับค่าที่ Recharts ต้องรับเป็น prop
function useIsMobile(query = '(max-width: 639px)') {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/* ---------- ไอคอน (SVG inline) ---------- */

const ICONS = {
  sales: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  bill: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2zm3 6h6M9 12h6M9 16h4',
  avg: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  member: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
} as const

function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ---------- โครงหน้า ---------- */

function Logo() {
  return (
    <div className="flex items-center gap-2 text-white">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-lg">☕</span>
      <span className="text-lg font-semibold tracking-wide">บ้านบรู</span>
    </div>
  )
}

/* ---------- การ์ด ---------- */

function GradientTile({
  label,
  value,
  hint,
  icon,
  gradient,
}: {
  label: string
  value: string
  hint?: string
  icon: keyof typeof ICONS
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

function Card({
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

function LegendDot({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-stone-500">
      <span className={line ? 'h-0.5 w-4 rounded' : 'h-2.5 w-2.5 rounded-full'} style={{ background: color }} />
      {label}
    </span>
  )
}

/* ---------- หน้า Dashboard ---------- */

function App() {
  const [rows, setRows] = useState<SaleRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetch('/sales.csv')
      .then((res) => {
        if (!res.ok) throw new Error(`โหลด sales.csv ไม่สำเร็จ (${res.status})`)
        return res.text()
      })
      .then((text) => setRows(parseSales(text)))
      .catch((e: Error) => setError(e.message))
  }, [])

  const summary = useMemo(() => (rows ? kpis(rows) : null), [rows])
  const daily = useMemo(() => (rows ? withMovingAverage(dailySales(rows), 7) : []), [rows])
  const branches = useMemo(() => (rows ? salesByBranch(rows) : []), [rows])
  const payments = useMemo(() => (rows ? salesByPaymentMethod(rows) : []), [rows])
  // Recharts อ่านสีของแต่ละชิ้นจากฟิลด์ fill ในข้อมูล
  const paymentSlices = useMemo(
    () => payments.map((p, i) => ({ ...p, fill: PAYMENT_COLORS[i % PAYMENT_COLORS.length] })),
    [payments],
  )

  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-red-700">{error}</div>
  }
  if (!rows || !summary) {
    return <div className="flex min-h-screen items-center justify-center text-stone-500">กำลังโหลดข้อมูล…</div>
  }

  const range = daily.length ? `${formatThaiDate(daily[0].date)} – ${formatThaiDate(daily[daily.length - 1].date)}` : ''
  const tick = { ...AXIS_TICK, fontSize: isMobile ? 11 : 12 }
  const yAxisWidth = isMobile ? 48 : 64
  const chartMargin = isMobile ? { top: 4, right: 8, bottom: 0, left: 0 } : { top: 8, right: 16, bottom: 0, left: 8 }

  return (
    <div className="min-h-screen text-stone-800">
      <div>
        {/* แถบบน */}
        <header className="sticky top-0 z-10 bg-white/90 shadow-[0_2px_12px_rgba(60,30,90,0.05)] backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
            <div className="rounded-lg bg-gradient-to-r from-[#e0428f] to-[#7c4dff] px-3 py-1.5">
              <Logo />
            </div>
            <p className="text-right text-xs text-stone-400 sm:text-sm">{range}</p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:space-y-6 sm:px-8 sm:py-8">
          <div>
            <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">Dashboard</h1>
            <p className="text-xs text-stone-400 sm:text-sm">ภาพรวมยอดขายทุกสาขา</p>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            <GradientTile
              label="ยอดขายรวม"
              value={formatBaht(summary.totalSales)}
              icon="sales"
              gradient="bg-gradient-to-br from-[#f0508f] to-[#b83aae]"
            />
            <GradientTile
              label="จำนวนบิล"
              value={formatNumber(summary.orderCount)}
              hint="นับ order_id ไม่ซ้ำ"
              icon="bill"
              gradient="bg-gradient-to-br from-[#9a4cf0] to-[#5b2fd6]"
            />
            <GradientTile
              label="ยอดเฉลี่ยต่อบิล"
              value={formatBaht(summary.averageOrderValue)}
              icon="avg"
              gradient="bg-gradient-to-br from-[#3d95e8] to-[#3a5fd9]"
            />
            <GradientTile
              label="ลูกค้าสมาชิก"
              value={formatNumber(summary.uniqueMembers)}
              hint="ไม่ซ้ำ · ไม่รวมลูกค้าทั่วไป"
              icon="member"
              gradient="bg-gradient-to-br from-[#f2a43a] to-[#ec6a3c]"
            />
          </div>

          {/* ยอดขายรายวัน + วิธีชำระเงิน */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
            <Card
              title="ยอดขายรายวัน"
              subtitle="พร้อมค่าเฉลี่ยเคลื่อนที่ 7 วัน"
              className="xl:col-span-2"
              action={
                <div className="flex items-center gap-4">
                  <LegendDot color={PINK} label="ค่าเฉลี่ย 7 วัน" line />
                  <LegendDot color={DAILY_COLOR} label="ยอดขายรายวัน" line />
                </div>
              }
            >
              <div className="h-64 sm:h-80 xl:h-auto xl:min-h-80 xl:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={chartMargin}>
                    <defs>
                      <linearGradient id="avgStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={PINK} />
                        <stop offset="100%" stopColor={PURPLE} />
                      </linearGradient>
                      <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PINK} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => formatThaiDate(d, { year: 'short' })}
                      tick={tick}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={isMobile ? 24 : 40}
                    />
                    <YAxis tickFormatter={formatBahtCompact} tick={tick} tickLine={false} axisLine={false} width={yAxisWidth} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v, name) => [formatBaht(Number(v)), name]}
                      labelFormatter={(d) => formatThaiDate(String(d))}
                    />
                    <Line
                      type="linear"
                      dataKey="sales"
                      name="ยอดขายรายวัน"
                      stroke={DAILY_COLOR}
                      strokeWidth={1}
                      dot={false}
                      activeDot={{ r: 3, fill: '#b9acc9', stroke: '#fff' }}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg"
                      name="ค่าเฉลี่ย 7 วัน"
                      stroke="url(#avgStroke)"
                      strokeWidth={2.5}
                      fill="url(#avgFill)"
                      dot={false}
                      activeDot={{ r: 5, fill: PINK, stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="วิธีชำระเงิน" subtitle="สัดส่วนยอดขาย">
              <div className="relative mx-auto h-52 w-full max-w-[260px] sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [formatBaht(Number(v)), name]} />
                    <Pie
                      data={paymentSlices}
                      dataKey="sales"
                      nameKey="method"
                      innerRadius="68%"
                      outerRadius="100%"
                      paddingAngle={2}
                      cornerRadius={4}
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive={false}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-stone-400">ยอดขายรวม</span>
                  <span className="text-lg font-semibold tabular-nums">{formatBahtCompact(summary.totalSales)}</span>
                </div>
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                {payments.map((p, i) => (
                  <li key={p.method} className="min-w-0">
                    <p className="text-xl font-semibold tabular-nums">{formatPercent(p.share)}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-stone-500">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                      {p.method}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* ยอดขายแยกสาขา: กราฟ + ตาราง */}
          <Card title="ยอดขายแยกสาขา" subtitle="เรียงจากมากไปน้อย">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="h-64 sm:h-72 lg:col-span-3">
                <ResponsiveContainer width="100%" height="100%">
                  {isMobile ? (
                    // มือถือ: แท่งแนวนอน ชื่อสาขาอยู่ด้านซ้าย อ่านได้ครบ ไม่ชนกัน
                    <BarChart data={branches} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="barFillH" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={PURPLE} />
                          <stop offset="100%" stopColor={PINK} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                      <XAxis type="number" tickFormatter={formatBahtCompact} tick={tick} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="branch" tick={tick} tickLine={false} axisLine={false} width={76} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatBaht(Number(v)), 'ยอดขาย']} cursor={{ fill: '#faf5ff' }} />
                      <Bar dataKey="sales" fill="url(#barFillH)" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false} />
                    </BarChart>
                  ) : (
                    <BarChart data={branches} margin={chartMargin}>
                      <defs>
                        <linearGradient id="barFillV" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor={PURPLE} />
                          <stop offset="100%" stopColor={PINK} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="branch" tick={tick} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={formatBahtCompact} tick={tick} tickLine={false} axisLine={false} width={yAxisWidth} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatBaht(Number(v)), 'ยอดขาย']} cursor={{ fill: '#faf5ff' }} />
                      <Bar dataKey="sales" fill="url(#barFillV)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto lg:col-span-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#2d2a3e] text-left text-xs text-white">
                      <th className="rounded-l-lg px-3 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">สาขา</th>
                      <th className="px-3 py-2.5 text-right font-medium">ยอดขาย</th>
                      <th className="rounded-r-lg px-3 py-2.5 text-right font-medium">สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b, i) => (
                      <tr key={b.branch} className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-3 text-stone-400">{i + 1}</td>
                        <td className="px-3 py-3">{b.branch}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatBaht(b.sales)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="inline-block rounded-md bg-pink-50 px-2 py-0.5 text-xs font-medium tabular-nums text-[#c02d74]">
                            {formatPercent(b.share)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default App
