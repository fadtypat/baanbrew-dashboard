// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot,
} from "recharts";
import { AnalyticsShell, Card, Pending, Insight, MAIN, PURPLE, RAMP, MUTED, INK, thaiDay } from "./ui.jsx";
import { AXIS_TICK, GRID_COLOR, TOOLTIP_STYLE } from "../components/theme.ts";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest, weeklyView, weeklyBacktest } from "../lib/analytics/forecast.js";
import { addDays } from "../lab3/time.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };
const weekRange = (monday) => `${shortDay(monday)} – ${shortDay(addDays(monday, 6))}`;
const fmtPct = (v) => (v == null ? "–" : `${v.toFixed(1)}%`);

/** กลุ่มปุ่มแบบ pill เหมือนปุ่มเลือกในหน้าอื่น */
function Pills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap rounded-full bg-stone-100 p-0.5 text-xs font-medium">
      {options.map(([key, label]) => (
        <button key={String(key)} type="button" onClick={() => onChange(key)} aria-pressed={value === key}
                className={`rounded-full px-3 py-1 ${value === key ? "bg-white text-[#c02d74] shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>{label}</button>
      ))}
    </div>
  );
}

function ForecastCard({ daily, branch, setBranch }) {
  const [view, setView] = useState("daily"); // daily | weekly
  const result = useMemo(() => tryRun(() => {
    const series = toSeries(daily, branch);
    const bt = backtest(series, HORIZON);
    const fc = seasonalForecast(series, HORIZON);
    const recent = series.slice(-56);
    const last = recent[recent.length - 1];
    const chart = [
      ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
      ...fc.map((f) => ({ date: f.date, forecast: f.forecast, band: [f.forecast * (1 - bt.band), f.forecast * (1 + bt.band)] })),
    ];
    chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue }; // ต่อเส้นให้ไม่ขาด
    const next7 = fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0);

    // รายสัปดาห์ (จันทร์–อาทิตย์): ใช้ยอดจริง 9 สัปดาห์ล่าสุด + คาดการณ์ 28 วัน เฉพาะสัปดาห์ที่ข้อมูลครบ 7 วัน
    const wkRows = weeklyView(series.slice(-63), fc);
    const lastActual = wkRows.map((w) => w.actual !== undefined).lastIndexOf(true);
    if (lastActual >= 0 && wkRows[lastActual].forecast === undefined) {
      wkRows[lastActual] = { ...wkRows[lastActual], forecast: wkRows[lastActual].actual }; // ต่อเส้นให้ไม่ขาด
    }
    const nextWeek = wkRows.find((w) => w.actual === undefined && w.forecast !== undefined);
    const wkBt = weeklyBacktest(bt.test);
    const inBand = bt.test.filter((t) => t.actual >= t.seasonal * (1 - bt.band) && t.actual <= t.seasonal * (1 + bt.band)).length;
    return {
      bt, chart, next7, lastDate: last.date, inBand,
      weekly: { rows: wkRows, lastWeek: lastActual >= 0 ? wkRows[lastActual].week : null, nextWeek, bt: wkBt },
    };
  }), [daily, branch]);

  const r = result.value;
  const weekly = view === "weekly";
  return (
    <Card title="พยากรณ์ยอดขาย 28 วัน"
          sub={weekly ? "รวมเป็นรายสัปดาห์ จันทร์–อาทิตย์ · แสดงเฉพาะสัปดาห์ที่มีข้อมูลครบ 7 วัน"
                      : "ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"}
          right={<div className="flex flex-wrap items-center gap-2">
            <Pills options={[["daily", "รายวัน"], ["weekly", "รายสัปดาห์"]]} value={view} onChange={setView} />
            <Pills options={[[null, "รวม"], ...BRANCHES.map((b) => [b, b])]} value={branch} onChange={setBranch} />
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : weekly ? (
        <WeeklyBody r={r} branch={branch} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
            <Stat label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} note="วิธีดูวันในสัปดาห์" />
            <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} note="ตัวเปรียบเทียบ" muted />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={AXIS_TICK} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_STYLE} labelFormatter={thaiDay} formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine x={r.lastDate} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />
                <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill={RAMP[1]} isAnimationActive={false} />
                <Line name="ยอดจริง" dataKey="actual" stroke={PURPLE} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight>
            {r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
              ? `${branch ?? "ภาพรวม"}: การดูวันในสัปดาห์ช่วยลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
              : `${branch ?? "ภาพรวม"}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%) ${branch ? "" : "เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน"}`}
            {" "}ใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
          </Insight>
          <BandNote bt={r.bt} inBand={r.inBand} />
        </>
      )}
    </Card>
  );
}

/** อธิบายว่าแถบ "ช่วงคาดการณ์" ในกราฟมาจากอะไร */
function BandNote({ bt, inBand }) {
  const pctBand = (bt.band * 100).toFixed(0);
  return (
    <div className="mt-3 rounded-xl border border-[#ece4f6] p-3 text-xs leading-relaxed text-stone-500">
      <p className="font-medium text-stone-600">แถบ “ช่วงคาดการณ์” คำนวณจากอะไร</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
        <li>ย้อนทดสอบ: ซ่อน {HORIZON} วันสุดท้าย พยากรณ์ด้วยวิธีเดียวกัน แล้วเทียบกับยอดจริงรายวัน</li>
        <li>วัด % ความคลาดเคลื่อนของแต่ละวัน = (ยอดจริง − คาดการณ์) ÷ ยอดจริง (ข้ามวันที่ยอดจริงเป็น 0)</li>
        <li>แถบ = ยอดคาดการณ์ × (1 ± <b>1.28 × ส่วนเบี่ยงเบนมาตรฐาน</b> ของ % ที่วัดได้) ได้ ±{pctBand}% ของยอดคาดการณ์ในแต่ละวัน (1.28 คือค่าที่ครอบคลุมราว 80% เมื่อความคลาดเคลื่อนกระจายแบบระฆังคว่ำ)</li>
      </ol>
      <p className="mt-1">
        ในช่วงย้อนทดสอบ ยอดจริงอยู่ในแถบ {inBand} จาก {bt.test.length} วัน (ใช้ข้อมูลชุดเดียวกับที่ใช้คำนวณแถบ จึงดูดีกว่าการใช้งานจริงเล็กน้อย) ·
        แถบนี้ใช้สัดส่วนเดียวกันทุกวัน จึงไม่รวมวันหยุดหรือเหตุการณ์พิเศษ และไม่ใช่ช่วงความเชื่อมั่นทางสถิติเต็มรูปแบบ
      </p>
    </div>
  );
}

const PREP_TOP = 10;

/** ควรเตรียมของเท่าไร: ยอดคาดการณ์ 7 วัน × สัดส่วนยอดขายของแต่ละเมนูกลุ่ม A */
function PrepCard({ daily, abc, branch }) {
  const [all, setAll] = useState(false);
  const result = useMemo(() => tryRun(() => {
    const fc = seasonalForecast(toSeries(daily, branch), 7);
    return { next7: fc.reduce((s, f) => s + f.forecast, 0), from: fc[0].date, to: fc[fc.length - 1].date };
  }), [daily, branch]);

  if (abc.error) return <Card title="ควรเตรียมของเท่าไร"><Pending lab="Lab 4.2" error={abc.error} /></Card>;
  if (result.error) return <Card title="ควรเตรียมของเท่าไร"><Pending lab="Lab 4.4" error={result.error} /></Card>;

  const { next7, from, to } = result.value;
  const menus = abc.items.filter((i) => i.cls === "A"); // เรียงตามยอดขายมากไปน้อยอยู่แล้ว
  const shareA = menus.reduce((s, i) => s + i.share, 0);
  const shown = all ? menus : menus.slice(0, PREP_TOP);
  return (
    <Card title="ควรเตรียมของเท่าไร"
          sub={`ยอดคาดการณ์ 7 วัน (${shortDay(from)} – ${shortDay(to)}) × สัดส่วนยอดขายของเมนูกลุ่ม A · ${branch ?? "ทุกสาขารวม"}`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="ยอดคาดการณ์ 7 วัน" value={fmtBaht(next7)} />
        <Stat label={`เมนูกลุ่ม A ${menus.length} เมนู ทำยอดรวม`} value={fmtBaht(next7 * shareA)} note={`${(shareA * 100).toFixed(1)}% ของยอดขาย`} />
        <Stat label="เมนูที่ควรเตรียมมากสุด" value={menus[0]?.name ?? "–"} note={menus[0] ? `ราว ${fmtBaht(next7 * menus[0].share)}` : ""} />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-[#2d2a3e] text-left text-xs text-white">
            <tr><th className="rounded-l-lg px-3 py-2.5 font-medium">#</th><th className="font-medium">เมนู</th><th className="font-medium">หมวด</th>
              <th className="text-right font-medium">สัดส่วนยอดขาย</th><th className="rounded-r-lg px-3 text-right font-medium">ยอดที่ควรเตรียมรองรับ 7 วัน</th></tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.product_id} className="border-t border-stone-100">
                <td className="px-3 py-2.5 text-stone-400">{i.rank}</td>
                <td className="font-medium">{i.name}</td>
                <td className="text-stone-500">{i.category}</td>
                <td className="text-right tabular-nums">{(i.share * 100).toFixed(1)}%</td>
                <td className="px-3 text-right tabular-nums">{fmtBaht(next7 * i.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {menus.length > PREP_TOP && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 rounded-lg px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100">
          {all ? `แสดงแค่ ${PREP_TOP} อันดับแรก` : `แสดงทั้ง ${menus.length} เมนู`}
        </button>
      )}
      <Insight>
        ตัวเลขเป็น <b>ยอดขายเป็นบาท</b> ไม่ใช่จำนวนแก้ว/ชิ้นหรือกิโลวัตถุดิบ เพราะผลวิเคราะห์ยังไม่เก็บราคาต่อหน่วยและสูตรของแต่ละเมนู ถ้าจะแปลงเป็นของที่ต้องซื้อ ให้หารด้วยราคาเมนู แล้วคูณสูตร ·
        สัดส่วนคิดจากยอดขายทุกสาขาตลอดช่วงข้อมูล{branch ? ` ไม่ได้แยกเฉพาะสาขา${branch}` : ""} และเป็นการประมาณจากค่าเฉลี่ย ควรเผื่อช่วงวันที่ขายดีด้วย
      </Insight>
    </Card>
  );
}

/** มุมมองรายสัปดาห์: ยอดจริงและยอดคาดการณ์รวมเป็นสัปดาห์ + MAPE รายสัปดาห์เทียบรายวัน */
function WeeklyBody({ r, branch }) {
  const { rows, lastWeek, nextWeek, bt: wk } = r.weekly;
  const daily = r.bt;
  const who = branch ?? "ภาพรวม";
  const better = wk.mapeSeasonal != null && wk.mapeSeasonal < daily.mapeSeasonal;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={nextWeek ? `คาดการณ์สัปดาห์หน้า (${weekRange(nextWeek.week)})` : "คาดการณ์สัปดาห์หน้า"}
              value={nextWeek ? fmtBaht(nextWeek.forecast) : "–"} />
        <Stat label="MAPE รายสัปดาห์ · วิธีดูวันในสัปดาห์" value={fmtPct(wk.mapeSeasonal)} note={`รายวัน ${fmtPct(daily.mapeSeasonal)}`} />
        <Stat label="MAPE รายสัปดาห์ · ค่าเฉลี่ยเส้นตรง" value={fmtPct(wk.mapeFlat)} note={`รายวัน ${fmtPct(daily.mapeFlat)}`} muted />
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="week" tickFormatter={shortDay} minTickGap={24} tick={AXIS_TICK} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={AXIS_TICK} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(w) => `สัปดาห์ ${weekRange(w)}`} formatter={(v, n) => [fmtBaht(v), n]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            {lastWeek && <ReferenceLine x={lastWeek} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />}
            <Line name="ยอดจริงรายสัปดาห์" dataKey="actual" stroke={PURPLE} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line name="คาดการณ์รายสัปดาห์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Insight>
        {wk.mapeSeasonal == null
          ? `${who}: ช่วงย้อนทดสอบมีสัปดาห์จันทร์–อาทิตย์ครบไม่ถึง 1 สัปดาห์ จึงยังคิด MAPE รายสัปดาห์ไม่ได้`
          : `${who}: คิดจาก ${wk.weeks.length} สัปดาห์เต็มในช่วงย้อนทดสอบ ความคลาดเคลื่อนรายสัปดาห์ ${fmtPct(wk.mapeSeasonal)} เทียบกับรายวัน ${fmtPct(daily.mapeSeasonal)} ${better
              ? "ต่ำลงเพราะวันที่ขายเกินกับวันที่ขายขาดในสัปดาห์เดียวกันหักล้างกัน"
              : "ไม่ได้ต่ำลง แปลว่าความคลาดเคลื่อนไม่ได้มาจากความผันผวนรายวันอย่างเดียว"} · จุดข้อมูลน้อย (ไม่เกิน 4 สัปดาห์) ใช้เป็นแนวโน้ม ไม่ใช่ข้อสรุปตายตัว`}
      </Insight>
    </>
  );
}

function Stat({ label, value, note, muted }) {
  return (
    <div className="rounded-xl bg-[#faf5ff] p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${muted ? "text-stone-500" : ""}`}>{value}</div>
      {note && <div className="text-xs text-stone-400">{note}</div>}
    </div>
  );
}

const FOCUS_DAYS = 28; // ±4 สัปดาห์รอบวันที่เลือก
const LOW_COLOR = "#dc2626"; // ต่ำกว่าปกติ = แดง
const HIGH_COLOR = "#f97316"; // สูงกว่าปกติ = ส้ม

/** กราฟของสาขาที่คลิก ±28 วันรอบวันนั้น: ยอดจริง เทียบค่าปกติ (expected จาก scoreAnomalies) */
function FocusChart({ daily, all, focus, onClose }) {
  const data = useMemo(() => {
    const expected = new Map(all.filter((a) => a.branch === focus.branch).map((a) => [a.date, a.expected]));
    const from = addDays(focus.date, -FOCUS_DAYS);
    const to = addDays(focus.date, FOCUS_DAYS);
    return toSeries(daily, focus.branch)
      .filter((d) => d.date >= from && d.date <= to)
      .map((d) => ({ date: d.date, actual: d.revenue, expected: expected.get(d.date) })); // ต้นช่วงอาจยังไม่มีค่าปกติ (ข้อมูลย้อนหลังไม่ถึง 4 สัปดาห์)
  }, [daily, all, focus]);
  const color = focus.change < 0 ? LOW_COLOR : HIGH_COLOR;
  return (
    <div className="mt-4 rounded-xl border border-[#ece4f6] p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">สาขา{focus.branch} · {thaiDay(focus.date)} ±{FOCUS_DAYS} วัน</h3>
          <p className="text-xs text-stone-400">
            ยอดจริง {fmtBaht(focus.actual)} เทียบค่าปกติ {fmtBaht(focus.expected)} ·{" "}
            <span style={{ color }} className="font-medium">
              {focus.change < 0 ? `ต่ำกว่าปกติ ${Math.round(-focus.change * 100)}%` : `สูงกว่าปกติ ${Math.round(focus.change * 100)}%`}
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิดกราฟ"
                className="rounded-lg px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100">ปิด</button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={32} tick={AXIS_TICK} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={AXIS_TICK} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={thaiDay} formatter={(v, n) => [fmtBaht(v), n]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine x={focus.date} stroke={MUTED} strokeDasharray="3 3" />
            <Line name="ยอดจริง" dataKey="actual" stroke={PURPLE} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="ค่าปกติ" dataKey="expected" stroke={INK} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
            <ReferenceDot x={focus.date} y={focus.actual} r={7} fill={color} stroke="#fff" strokeWidth={2} ifOverflow="extendDomain" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  return (
    <Card title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="bg-[#2d2a3e] text-left text-xs text-white">
            <tr><th className="rounded-l-lg px-3 py-2.5 font-medium">#</th><th className="font-medium">วันที่</th><th className="font-medium">สาขา</th>
              <th className="text-right font-medium">ยอดจริง</th><th className="text-right font-medium">ปกติ</th><th className="rounded-r-lg pl-4 font-medium">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              return (
                <tr key={a.date + a.branch} onClick={() => setFocus(sel ? null : a)}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-[#faf5ff] ${sel ? "bg-pink-50/60" : ""}`}>
                  <td className="px-3 py-2.5 text-stone-400">{i + 1}</td>
                  <td>{thaiDay(a.date)} <span className="text-stone-400">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td>{a.branch}</td>
                  <td className="text-right">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-stone-500">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    {a.change < 0
                      ? <span className="font-medium text-red-700">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                      : <span className="font-medium text-amber-700">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {focus && <FocusChart daily={daily} all={all} focus={focus} onClose={() => setFocus(null)} />}
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.slice(0, 3).map((h) => `${h.holiday} (${h.branch})`).join(", ")}</>}
      </Insight>
    </Card>
  );
}

export default function ForecastTab({ source }) {
  const state = useAnalytics(source);
  const [branch, setBranch] = useState(null); // ใช้ร่วมกันระหว่างการ์ดพยากรณ์และการ์ดเตรียมของ
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์ & ผิดปกติ">
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-4 sm:space-y-6">
          {d.meta.alerts?.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} branch={branch} setBranch={setBranch} />
          <PrepCard daily={d.daily.rows} abc={d.abc} branch={branch} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
