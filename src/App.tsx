import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  formatThaiDate,
  kpis,
  withMovingAverage,
  parseSales,
  salesByBranch,
  type SaleRow,
} from './lib/metrics.js'

const LINE_COLOR = '#b45309' // amber-700 — เส้นค่าเฉลี่ย 7 วัน
const DAILY_COLOR = '#d6d3d1' // stone-300 — เส้นรายวันแบบจาง
const BAR_COLOR = '#d97706' // amber-600
const AXIS_TICK = { fill: '#78716c', fontSize: 12 } // stone-500
const GRID_COLOR = '#e7e5e4' // stone-200

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

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5">
      <p className="text-xs text-stone-500 sm:text-sm">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-stone-900 sm:mt-2 sm:text-2xl lg:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-stone-400 sm:text-xs">{hint}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-stone-800 sm:mb-4 sm:text-base">{title}</h2>
      <div className="h-64 sm:h-80">{children}</div>
    </section>
  )
}

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

  if (error) {
    return <div className="flex min-h-screen items-center justify-center bg-amber-50 text-red-700">{error}</div>
  }
  if (!rows || !summary) {
    return <div className="flex min-h-screen items-center justify-center bg-amber-50 text-stone-500">กำลังโหลดข้อมูล…</div>
  }

  const tick = { ...AXIS_TICK, fontSize: isMobile ? 11 : 12 }
  const yAxisWidth = isMobile ? 48 : 64
  const chartMargin = isMobile ? { top: 4, right: 8, bottom: 0, left: 0 } : { top: 8, right: 16, bottom: 0, left: 8 }

  const range = daily.length ? `${formatThaiDate(daily[0].date)} – ${formatThaiDate(daily[daily.length - 1].date)}` : ''

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-amber-800 sm:text-3xl">บ้านบรู Dashboard</h1>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">ข้อมูลยอดขาย {range}</p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard label="ยอดขายรวม" value={formatBaht(summary.totalSales)} />
          <KpiCard label="จำนวนบิล" value={formatNumber(summary.orderCount)} hint="นับ order_id ไม่ซ้ำ" />
          <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(summary.averageOrderValue)} />
          <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatNumber(summary.uniqueMembers)} hint="ไม่รวมลูกค้าทั่วไป" />
        </div>

        <ChartCard title="ยอดขายรายวัน และค่าเฉลี่ยเคลื่อนที่ 7 วัน">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={chartMargin}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatThaiDate(d, { year: 'short' })}
                tick={tick}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                minTickGap={isMobile ? 24 : 40}
              />
              <YAxis
                tickFormatter={formatBahtCompact}
                tick={tick}
                tickLine={false}
                axisLine={false}
                width={yAxisWidth}
              />
              <Tooltip
                formatter={(v, name) => [formatBaht(Number(v)), name]}
                labelFormatter={(d) => formatThaiDate(String(d))}
              />
              <Legend verticalAlign="top" align={isMobile ? 'left' : 'right'} height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="linear"
                dataKey="sales"
                name="ยอดขายรายวัน"
                stroke={DAILY_COLOR}
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 3, fill: '#a8a29e', stroke: '#fff' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="avg"
                name="ค่าเฉลี่ย 7 วัน"
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ยอดขายแยกสาขา (มากไปน้อย)">
          <ResponsiveContainer width="100%" height="100%">
            {isMobile ? (
              // มือถือ: แท่งแนวนอน ชื่อสาขาอยู่ด้านซ้าย อ่านได้ครบ ไม่ชนกัน
              <BarChart data={branches} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" tickFormatter={formatBahtCompact} tick={tick} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="branch"
                  tick={tick}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                  width={76}
                />
                <Tooltip formatter={(v) => [formatBaht(Number(v)), 'ยอดขาย']} cursor={{ fill: '#fef3c7' }} />
                <Bar dataKey="sales" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={32} isAnimationActive={false} />
              </BarChart>
            ) : (
              <BarChart data={branches} margin={chartMargin}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="branch" tick={tick} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
                <YAxis
                  tickFormatter={formatBahtCompact}
                  tick={tick}
                  tickLine={false}
                  axisLine={false}
                  width={yAxisWidth}
                />
                <Tooltip formatter={(v) => [formatBaht(Number(v)), 'ยอดขาย']} cursor={{ fill: '#fef3c7' }} />
                <Bar dataKey="sales" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={64} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

export default App
