import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  monthlySales,
  parseSales,
  prepareRows,
  salesByBranch,
  salesByPaymentMethod,
  withMovingAverage,
  type SaleRow,
} from './lib/metrics.js'
import Lab2Page from './lab2/Lab2Page.jsx'
import LiveTab from './lab3/LiveTab.jsx'
import MenuSalesCard from './overview/MenuSalesCard.tsx'
import CustomersPage from './customers/CustomersPage.tsx'
import { Card, GradientTile, LegendDot } from './components/ui.tsx'
import FilterBar from './components/FilterBar.tsx'
import type { DateRange } from './lib/customerMetrics.ts'
import { AMBER, AXIS_TICK, BLUE, GRID_COLOR, MUTED, PINK, PURPLE, TEAL, TOOLTIP_STYLE, useIsMobile } from './components/theme.ts'

type Product = { product_id: string; product_name: string; category: string; price: string; cost: string; launched_date: string }

// แท็บของหน้า เก็บใน URL hash (#lab2) เพื่อให้รีเฟรชแล้วยังอยู่แท็บเดิม
const TABS = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'customers', label: 'ข้อมูลลูกค้า' },
  { id: 'lab2', label: 'Lab 2.2 · ซ่อมกราฟ' },
  { id: 'live', label: 'ยอดขายสด' },
] as const
type TabId = (typeof TABS)[number]['id']
const tabFromHash = (): TabId => TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'overview'

const PAYMENT_COLORS = [PINK, PURPLE, BLUE, AMBER, TEAL] // ลำดับคงที่ ตามอันดับยอดขาย (5 วิธีชำระ)
const DAILY_COLOR = MUTED // เส้นรายวันแบบจาง
const PARTIAL_MONTH_COLOR = '#e6cfe6' // แท่งเดือนที่ข้อมูลไม่ครบเดือน

/* ---------- โครงหน้า ---------- */

function Logo() {
  return (
    <div className="flex items-center gap-2 text-white">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-lg">☕</span>
      <span className="text-lg font-semibold tracking-wide">บ้านบรู</span>
    </div>
  )
}

/* ---------- หน้า Dashboard ---------- */

function App() {
  const [rows, setRows] = useState<SaleRow[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>(tabFromHash)
  // ตัวกรองหน้าภาพรวม: ช่วงวันที่ (null = ทั้งหมด) และสาขา ('' = ทุกสาขา)
  const [picked, setPicked] = useState<DateRange | null>(null)
  const [branch, setBranch] = useState('')
  const [monthMetric, setMonthMetric] = useState<'sales' | 'perDay'>('sales') // กราฟรายเดือน: ยอดรวม / เฉลี่ยต่อวัน
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

  // products.csv ใช้แสดงชื่อเมนู/หมวดในการ์ดยอดขายแยกตามเมนู และหน้า Lab 2.2
  useEffect(() => {
    Papa.parse<Product>('/products.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: ({ data }) => setProducts(data),
      error: (e) => setError(`โหลด products.csv ไม่สำเร็จ (${e.message})`),
    })
  }, [])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // หน้า Lab 2.2 ต้องการแถวที่มี revenue / hour เพิ่ม
  const labRows = useMemo(() => (rows ? prepareRows(rows) : []), [rows])
  // ช่วงวันที่ที่มีข้อมูลขาย (วันที่เป็น 'YYYY-MM-DD' เทียบแบบข้อความได้)
  const bounds = useMemo<DateRange | null>(() => {
    if (!rows?.length) return null
    let from = rows[0].date
    let to = rows[0].date
    for (const r of rows) {
      if (r.date < from) from = r.date
      if (r.date > to) to = r.date
    }
    return { from, to }
  }, [rows])
  const range = picked ?? bounds
  const allBranches = useMemo(() => (rows ? salesByBranch(rows).map((b) => b.branch) : []), [rows])
  // dateRows = กรองแค่วันที่ (ใช้กับกราฟเทียบสาขา) · viewRows = กรองทั้งวันที่และสาขา (ใช้กับ KPI และกราฟอื่น)
  const dateRows = useMemo(
    () => (rows && range ? rows.filter((r) => r.date >= range.from && r.date <= range.to) : []),
    [rows, range],
  )
  const viewRows = useMemo(() => (branch ? dateRows.filter((r) => r.branch === branch) : dateRows), [dateRows, branch])
  const summary = useMemo(() => kpis(viewRows), [viewRows])
  const daily = useMemo(() => withMovingAverage(dailySales(viewRows), 7), [viewRows])
  const branches = useMemo(() => salesByBranch(dateRows), [dateRows])
  const payments = useMemo(() => salesByPaymentMethod(viewRows), [viewRows])
  const monthly = useMemo(() => (range ? monthlySales(viewRows, range) : []), [viewRows, range])
  // Recharts อ่านสีของแต่ละชิ้นจากฟิลด์ fill ในข้อมูล
  const paymentSlices = useMemo(
    () => payments.map((p, i) => ({ ...p, fill: PAYMENT_COLORS[i % PAYMENT_COLORS.length] })),
    [payments],
  )

  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-red-700">{error}</div>
  }
  if (!rows || !range || !bounds) {
    return <div className="flex min-h-screen items-center justify-center text-stone-500">กำลังโหลดข้อมูล…</div>
  }

  const dataRange = `${formatThaiDate(bounds.from)} – ${formatThaiDate(bounds.to)}`
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
            <p className="text-right text-xs text-stone-400 sm:text-sm">{dataRange}</p>
          </div>
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-8">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t.id ? 'border-[#e0428f] text-[#c02d74]' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </header>

        {tab === 'customers' ? (
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
            <CustomersPage rows={rows} />
          </main>
        ) : tab === 'live' ? (
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
            <LiveTab />
          </main>
        ) : tab === 'lab2' ? (
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
            <Lab2Page rows={labRows} products={products} />
          </main>
        ) : (
        <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:space-y-6 sm:px-8 sm:py-8">
          <div>
            <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">Dashboard</h1>
            <p className="text-xs text-stone-400 sm:text-sm">
              {branch ? `ยอดขายสาขา${branch}` : 'ภาพรวมยอดขายทุกสาขา'} · {formatThaiDate(range.from)} – {formatThaiDate(range.to)}
            </p>
          </div>

          <FilterBar
            range={range}
            bounds={bounds}
            onRangeChange={setPicked}
            branches={allBranches}
            branch={branch}
            onBranchChange={setBranch}
          />

          {viewRows.length === 0 ? (
            <p className="rounded-2xl bg-white py-16 text-center text-sm text-stone-500">ไม่มียอดขายในช่วงวันที่และสาขาที่เลือก</p>
          ) : (
          <>

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

          {/* ยอดขายรายเดือน */}
          <Card
            title="ยอดขายรายเดือน"
            subtitle={monthMetric === 'sales' ? 'ยอดขายรวมของแต่ละเดือน' : 'ยอดขายเฉลี่ยต่อวัน ใช้เทียบเดือนที่ไม่ครบเดือนได้'}
            action={
              <div className="flex items-center gap-3">
                {monthly.some((m) => m.partial) && <LegendDot color={PARTIAL_MONTH_COLOR} label="ไม่ครบเดือน" />}
                <div className="flex rounded-full bg-stone-100 p-0.5 text-xs font-medium">
                  {(
                    [
                      ['sales', 'ยอดรวม'],
                      ['perDay', 'เฉลี่ยต่อวัน'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMonthMetric(key)}
                      aria-pressed={monthMetric === key}
                      className={`rounded-full px-3 py-1 ${monthMetric === key ? 'bg-white text-[#c02d74] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={chartMargin}>
                  <defs>
                    <linearGradient id="monthFill" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor={PURPLE} />
                      <stop offset="100%" stopColor={PINK} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m: string) => formatThaiDate(`${m}-01`, { year: 'short' }).replace(/^1 /, '')}
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={isMobile ? 12 : 4}
                  />
                  <YAxis tickFormatter={formatBahtCompact} tick={tick} tickLine={false} axisLine={false} width={yAxisWidth} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    cursor={{ fill: '#faf5ff' }}
                    content={({ active, payload }) => {
                      const m = active && payload?.[0]?.payload
                      if (!m) return null
                      return (
                        <div className="rounded-[10px] bg-white px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(60,30,90,0.15)]">
                          <p className="font-medium text-stone-800">
                            {formatThaiDate(`${m.month}-01`).replace(/^1 /, '')}
                            {m.partial && <span className="text-stone-400"> · ไม่ครบเดือน ({m.days} วัน)</span>}
                          </p>
                          <p className="mt-1 tabular-nums text-stone-600">ยอดขาย {formatBaht(m.sales)}</p>
                          <p className="tabular-nums text-stone-600">เฉลี่ยต่อวัน {formatBaht(Math.round(m.perDay))}</p>
                          <p className="tabular-nums text-stone-600">จำนวนบิล {formatNumber(m.orders)}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey={monthMetric} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                    {monthly.map((m) => (
                      <Cell key={m.month} fill={m.partial ? PARTIAL_MONTH_COLOR : 'url(#monthFill)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {monthMetric === 'sales' && monthly.some((m) => m.partial) && (
              <p className="mt-3 text-xs text-stone-500">
                แท่งสีจาง = เดือนที่มีข้อมูลไม่ครบทั้งเดือน ยอดรวมจึงต่ำกว่าปกติ · กด “เฉลี่ยต่อวัน” เพื่อเทียบกับเดือนอื่นได้ตรงกว่า
              </p>
            )}
          </Card>

          <MenuSalesCard rows={viewRows} products={products} />

          {/* ยอดขายแยกสาขา: กราฟ + ตาราง */}
          <Card title="ยอดขายแยกสาขา" subtitle={branch ? `เทียบทุกสาขาในช่วงที่เลือก · ไฮไลต์${branch}` : 'เรียงจากมากไปน้อย'}>
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
                      <Bar dataKey="sales" fill="url(#barFillH)" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
                        {branches.map((b) => (
                          <Cell key={b.branch} fill={branch && b.branch !== branch ? MUTED : 'url(#barFillH)'} />
                        ))}
                      </Bar>
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
                      <Bar dataKey="sales" fill="url(#barFillV)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                        {branches.map((b) => (
                          <Cell key={b.branch} fill={branch && b.branch !== branch ? MUTED : 'url(#barFillV)'} />
                        ))}
                      </Bar>
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
                      <tr key={b.branch} className={`border-b border-stone-100 last:border-0 ${b.branch === branch ? 'bg-pink-50/60 font-medium' : ''}`}>
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
          </>
          )}
        </main>
        )}
      </div>
    </div>
  )
}

export default App
