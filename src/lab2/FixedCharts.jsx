// Lab 2.2 · กราฟที่ซ่อมแล้ว — เทียบกับ BadChart1 … BadChart5 ใน BadCharts.jsx
// หลักที่ใช้ทุกกราฟ: สีหลักสีเดียว, แกนเริ่มที่ 0, เรียงตามค่า, ตัวเลขมี ฿ และจุลภาค,
// มีประโยคสรุป 1 บรรทัดที่คำนวณจากข้อมูลจริงเหนือกราฟ
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import { revenueByProduct, monthlyRevenue, branchPerformance, weeklyRevenue, daysInMonth, thaiMonth } from "./lab2Metrics.js";
import { fmtBaht, fmtShortBaht, fmtNum } from "../lib/metrics.js";

const MAIN = "#2563eb"; // สีหลัก (blue-600)
const MAIN_LIGHT = "#bfdbfe"; // สีเดียวกันแบบจาง ใช้กับข้อมูลที่ "ไม่ครบ" (blue-200)
const GRID = "#e7e5e4";
const TICK = { fill: "#78716c", fontSize: 12 };
const pct = (x) => `${(x * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
const thaiDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

/** กรอบของทุกกราฟ: ประโยคสรุป 1 บรรทัด + พื้นที่กราฟที่เหลือ */
function Frame({ summary, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 truncate text-sm font-medium text-stone-800" title={summary}>{summary}</p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * กราฟ 1: เมนูที่ทำเงินสูงสุด 10 อันดับ — แท่งแนวนอนเรียงมากไปน้อย
 * ทำไม: คำถามคือ "เมนูไหนทำเงินมากสุด" = การจัดอันดับ แท่งยาวเทียบกันง่ายกว่ามุมของ pie
 * 40 ชิ้น ชื่อเมนูอ่านได้ที่แกน ไม่ต้องจับคู่สีกับ legend
 */
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  const top = all.slice(0, 10);
  const topShare = top.reduce((s, d) => s + d.share, 0);
  const summary = top.length
    ? `อันดับ 1 คือ ${top[0].name} ${fmtBaht(top[0].revenue)} (${pct(top[0].share)}) · 10 อันดับแรกรวมกัน ${pct(topShare)} ของยอดขายจาก ${fmtNum(all.length)} เมนู`
    : "ไม่มีข้อมูล";
  return (
    <Frame summary={summary}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={fmtShortBaht} tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={TICK} axisLine={false} tickLine={false} interval={0} />
        <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]} cursor={{ fill: "#f5f5f4" }} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="right" formatter={fmtBaht} fill="#44403c" fontSize={11} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 2: ยอดขายรวมแยกสาขา — แท่งแนวตั้ง แกน Y เริ่มที่ 0 เรียงมากไปน้อย สีเดียว
 * ทำไม: คำถามคือ "ต่างกันมากแค่ไหน" ความยาวแท่งต้องเป็นสัดส่วนกับค่าจริง แกนจึงต้องเริ่มที่ 0
 * (BadChart2 เริ่มที่ 500,000 ทำให้ต่างกันเกินจริง) และสาขาไม่ใช่ข้อมูลที่ต้องแยกด้วยสี
 */
export function FixedChart2({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.revenue - a.revenue), [rows]);
  const hi = data[0];
  const lo = data[data.length - 1];
  const summary = data.length > 1
    ? `${hi.branch}ขายได้สูงสุด ${fmtBaht(hi.revenue)} = ${(hi.revenue / lo.revenue).toLocaleString("th-TH", { maximumFractionDigits: 1 })} เท่าของ${lo.branch} (${fmtBaht(lo.revenue)}) ซึ่งต่ำสุด`
    : "ไม่มีข้อมูลพอเทียบ";
  return (
    <Frame summary={summary}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="branch" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis domain={[0, "auto"]} tickFormatter={fmtShortBaht} tick={TICK} axisLine={false} tickLine={false} width={64} />
        <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขายรวม"]} cursor={{ fill: "#f5f5f4" }} />
        <Bar dataKey="revenue" fill={MAIN} radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="top" formatter={fmtShortBaht} fill="#44403c" fontSize={11} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 3: ยอดขายรายสัปดาห์ (เฉพาะสัปดาห์ที่ครบ 7 วัน) — เส้นบาง ไม่มีจุด วันที่ภาษาไทยแบบเว้นระยะ
 * ทำไม: คำถามคือ "โตขึ้นหรือลดลง" = แนวโน้ม รวมเป็นรายสัปดาห์ตัดความผันผวนรายวัน (วันธรรมดา/เสาร์อาทิตย์)
 * ออกไปเหลือแค่ทิศทาง และตัดสัปดาห์ต้น/ท้ายที่ไม่ครบออก ไม่ให้ดูเหมือนยอดตก
 */
export function FixedChart3({ rows }) {
  const data = useMemo(() => weeklyRevenue(rows), [rows]);
  const n = Math.min(8, Math.floor(data.length / 2)); // เทียบช่วงต้นกับช่วงท้าย ช่วงละ n สัปดาห์
  const avg = (arr) => arr.reduce((s, d) => s + d.revenue, 0) / arr.length;
  let summary = "ข้อมูลยังไม่พอดูแนวโน้ม";
  if (n > 0) {
    const first = avg(data.slice(0, n));
    const last = avg(data.slice(-n));
    const change = last / first - 1;
    summary = `${n} สัปดาห์ล่าสุดขายเฉลี่ย ${fmtBaht(last)}/สัปดาห์ ${change >= 0 ? "โตขึ้น" : "ลดลง"} ${pct(Math.abs(change))} จาก ${n} สัปดาห์แรก (${fmtBaht(first)}/สัปดาห์)`;
  }
  return (
    <Frame summary={summary}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tickFormatter={thaiDate} tick={TICK} axisLine={false} tickLine={false} minTickGap={48} />
        <YAxis domain={[0, "auto"]} tickFormatter={fmtShortBaht} tick={TICK} axisLine={false} tickLine={false} width={64} />
        <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขายทั้งสัปดาห์"]} labelFormatter={(w) => `สัปดาห์เริ่ม ${thaiDate(w)}`} />
        <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart>
    </Frame>
  );
}

/**
 * กราฟ 4: ยอดขายเฉลี่ยต่อวันรายเดือน — เดือนที่ข้อมูลไม่ครบใช้สีเดียวกันแบบจาง และบอกจำนวนวันที่มีข้อมูล
 * ทำไม: เดือนแต่ละเดือนมีจำนวนวันที่มีข้อมูลไม่เท่ากัน ยอดรวมจึงเทียบกันไม่ได้ ยอดเฉลี่ยต่อวันเทียบได้ทุกเดือน
 * และตอบคำถาม "ยอดตกจริงไหม" ได้ตรง ๆ แทนการติดป้าย "ยอดตก!" ให้เดือนที่แค่ข้อมูลยังมาไม่ครบ
 */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(rows).map((m) => ({ ...m, complete: m.days === daysInMonth(m.month) })),
    [rows]
  );
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  let summary = "ไม่มีข้อมูล";
  if (last && prev) {
    const change = last.perDay / prev.perDay - 1;
    summary = `${thaiMonth(last.month)} มีข้อมูล ${last.days} จาก ${daysInMonth(last.month)} วัน · เฉลี่ย ${fmtBaht(last.perDay)}/วัน ${change >= 0 ? "สูงกว่า" : "ต่ำกว่า"}${thaiMonth(prev.month)} ${pct(Math.abs(change))} (${fmtBaht(prev.perDay)}/วัน)`;
  }
  return (
    <Frame summary={summary}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={thaiMonth} tick={{ ...TICK, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={8} />
        <YAxis domain={[0, "auto"]} tickFormatter={fmtShortBaht} tick={TICK} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          formatter={(v, _name, item) => [
            `${fmtBaht(v)}/วัน${item.payload.complete ? "" : ` (ข้อมูล ${item.payload.days}/${daysInMonth(item.payload.month)} วัน)`}`,
            "ยอดเฉลี่ยต่อวัน",
          ]}
          labelFormatter={thaiMonth}
          cursor={{ fill: "#f5f5f4" }}
        />
        <Bar
          dataKey="perDay"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
          shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={3} fill={p.payload.complete ? MAIN : MAIN_LIGHT} />}
        />
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 5: ยอดขายเฉลี่ยต่อวันที่เปิดขาย แยกสาขา — แท่งแนวนอนเรียงมากไปน้อย พร้อมจำนวนวันที่เปิดขาย
 * ทำไม: สาขาเปิดไม่พร้อมกัน ยอดรวมจึงลงโทษสาขาที่เพิ่งเปิด ยอดต่อวันเทียบกันได้ยุติธรรมกว่า
 * ไม่ติดป้าย "แย่ที่สุด" เพราะยอดขายยังขึ้นกับทำเลและประเภทสาขา ไม่ได้วัดฝีมือผู้จัดการอย่างเดียว
 */
export function FixedChart5({ rows }) {
  const data = useMemo(
    () => branchPerformance(rows).sort((a, b) => b.perDay - a.perDay).map((b) => ({ ...b, label: `${b.branch} (${fmtNum(b.days)} วัน)` })),
    [rows]
  );
  const hi = data[0];
  const lo = data[data.length - 1];
  const minDays = Math.min(...data.map((d) => d.days));
  const maxDays = Math.max(...data.map((d) => d.days));
  const summary = data.length > 1
    ? `ต่อวัน: ${hi.branch}สูงสุด ${fmtBaht(hi.perDay)} · ${lo.branch}ต่ำสุด ${fmtBaht(lo.perDay)} · เปิดขาย ${fmtNum(minDays)}–${fmtNum(maxDays)} วัน`
    : "ไม่มีข้อมูลพอเทียบ";
  return (
    <Frame summary={summary}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, "auto"]} tickFormatter={fmtBaht} tick={TICK} axisLine={false} tickLine={false} tickCount={5} />
        <YAxis type="category" dataKey="label" width={140} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, _name, item) => [`${fmtBaht(v)}/วัน (รวม ${fmtBaht(item.payload.revenue)})`, "ยอดเฉลี่ยต่อวัน"]}
          cursor={{ fill: "#f5f5f4" }}
        />
        <Bar dataKey="perDay" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="perDay" position="right" formatter={fmtBaht} fill="#44403c" fontSize={11} />
        </Bar>
      </BarChart>
    </Frame>
  );
}
