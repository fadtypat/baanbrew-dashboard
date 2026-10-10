// Lab 4.1–4.2 · ลูกค้าและเมนู: RFM, Cohort, ABC
import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, Cell, ReferenceLine,
} from "recharts";
import { AnalyticsShell, Card, Pending, Insight, RAMP, MAIN, MUTED, INK, pct, thaiMonth } from "./ui.jsx";
import { AXIS_TICK, GRID_COLOR, TOOLTIP_STYLE } from "../components/theme.ts";
import { useAnalytics } from "./useAnalytics.js";
import { SEGMENTS } from "../lib/analytics/rfm.js";
import { fmtBaht } from "../lib/metrics.js";

const SEG_TH = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

// ---------------- RFM ----------------
function RfmCard({ rfm, onPick, picked }) {
  if (rfm.error) return <Card title="RFM · กลุ่มลูกค้า"><Pending lab="Lab 4.1" error={rfm.error} /></Card>;
  const data = rfm.segments.map((s) => ({ ...s, label: SEG_TH[s.segment].th }));
  const ch = rfm.segments.find((s) => s.segment === "Champions");
  const risk = rfm.segments.find((s) => s.segment === "At Risk");
  return (
    <Card title="RFM · กลุ่มลูกค้าสมาชิก" sub="สัดส่วนจำนวนลูกค้า เทียบกับสัดส่วนยอดซื้อ">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis type="number" tickFormatter={(v) => pct(v)} domain={[0, 0.45]} tick={AXIS_TICK} />
            <YAxis type="category" dataKey="label" width={96} tick={{ ...AXIS_TICK, fontSize: 13 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => [pct(v, 1), n]} cursor={{ fill: "#faf5ff" }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar name="% ลูกค้า" dataKey="customerShare" fill={MUTED} radius={[0, 4, 4, 0]} isAnimationActive={false}
                 onClick={(d) => onPick?.(d.payload?.segment ?? d.segment)} style={{ cursor: "pointer" }} />
            <Bar name="% ยอดซื้อ" dataKey="revenueShare" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}
                 onClick={(d) => onPick?.(d.payload?.segment ?? d.segment)} style={{ cursor: "pointer" }}>
              {data.map((d) => <Cell key={d.segment} fill={picked && picked !== d.segment ? RAMP[2] : MAIN} />)}
              <LabelList dataKey="revenueShare" position="right" formatter={(v) => pct(v)} style={{ fontSize: 12, fill: INK }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Insight>
        ลูกค้าชั้นยอด {ch.customers.toLocaleString()} คน ({pct(ch.customerShare)} ของสมาชิก) ทำยอด {pct(ch.revenueShare)} ·
        กลุ่มเสี่ยงหาย {risk.customers.toLocaleString()} คน ยังถือยอด {pct(risk.revenueShare)} เป็นเป้าหมายแรกของแคมเปญดึงกลับ
      </Insight>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[#2d2a3e] text-left text-xs text-white"><tr><th className="rounded-l-lg px-3 py-2.5 font-medium">กลุ่ม</th><th className="px-3 text-right font-medium">ลูกค้า</th><th className="px-3 text-right font-medium">ยอดซื้อ</th><th className="rounded-r-lg px-3 font-medium">ควรทำอะไร</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.segment} onClick={() => onPick?.(d.segment)}
                  className={`cursor-pointer border-t border-stone-100 hover:bg-[#faf5ff] ${picked === d.segment ? "bg-pink-50/60" : ""}`}>
                <td className="px-3 py-2.5">{d.label} <span className="text-stone-400">{d.segment}</span></td>
                <td className="px-3 text-right tabular-nums">{d.customers.toLocaleString()}</td>
                <td className="px-3 text-right tabular-nums">{fmtBaht(d.revenue)}</td>
                <td className="px-3 text-stone-600">{SEG_TH[d.segment].action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------- รายชื่อลูกค้าในกลุ่มที่คลิก ----------------
const TOP_N = 15;
const CSV_HEADER = ["รหัสลูกค้า", "ไม่ได้มา (วัน)", "จำนวนบิล", "ยอดซื้อรวม (บาท)", "R", "F", "M", "กลุ่ม"];
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** ดาวน์โหลดลูกค้าทั้งกลุ่มเป็น CSV · ใส่ BOM (﻿) หน้าไฟล์ให้ Excel อ่านภาษาไทยได้ */
function downloadCsv(segment, members) {
  const lines = [CSV_HEADER, ...members.map((c) => [c.id, c.R, c.F, c.M, c.r, c.f, c.m, c.segment])];
  const blob = new Blob(["﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `rfm-${segment.replace(/\s+/g, "-")}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

function SegmentCustomersCard({ customers, segment, onClose }) {
  const info = SEG_TH[segment];
  // เรียงตามยอดซื้อรวมมากไปน้อย (ไม่แก้ array เดิม)
  const members = customers.filter((c) => c.segment === segment).sort((a, b) => b.M - a.M);
  return (
    <Card title={`ลูกค้ากลุ่ม ${info.th}`} sub={`${members.length.toLocaleString()} คน · แสดง ${TOP_N} คนแรกที่ยอดซื้อสูงสุด · ${info.action}`}
          right={<div className="flex gap-2">
            <button type="button" onClick={() => downloadCsv(segment, members)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#c02d74] ring-1 ring-pink-200 hover:bg-pink-50">ดาวน์โหลด CSV</button>
            <button type="button" onClick={onClose} aria-label="ปิดรายชื่อลูกค้า"
                    className="rounded-lg px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100">ปิด</button>
          </div>}>
      {members.length === 0 ? <p className="text-sm text-stone-500">ไม่มีลูกค้าในกลุ่มนี้</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-[#2d2a3e] text-left text-xs text-white">
              <tr><th className="rounded-l-lg px-3 py-2.5 font-medium">รหัสลูกค้า</th><th className="px-3 text-right font-medium">ไม่ได้มา (วัน)</th>
                <th className="px-3 text-right font-medium">จำนวนบิล</th><th className="px-3 text-right font-medium">ยอดซื้อ</th>
                <th className="rounded-r-lg px-3 text-center font-medium">R-F-M</th></tr>
            </thead>
            <tbody>
              {members.slice(0, TOP_N).map((c) => (
                <tr key={c.id} className="border-t border-stone-100">
                  <td className="px-3 py-2.5 font-medium">{c.id}</td>
                  <td className="px-3 text-right tabular-nums">{c.R.toLocaleString()}</td>
                  <td className="px-3 text-right tabular-nums">{c.F.toLocaleString()}</td>
                  <td className="px-3 text-right tabular-nums">{fmtBaht(c.M)}</td>
                  <td className="px-3 text-center tabular-nums text-stone-600">{c.r}-{c.f}-{c.m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------- Cohort ----------------
function CohortCard({ cohort }) {
  if (cohort.error) return <Card title="Cohort · การกลับมาซื้อซ้ำ"><Pending lab="Lab 4.2" error={cohort.error} /></Card>;
  const MAXK = 12;
  const shade = (v) => RAMP[Math.min(5, Math.floor(v * 6))];
  const avg1 = (() => {
    const xs = cohort.cohorts.filter((c) => c.retention.length > 2).map((c) => c.retention[1]);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  })();
  return (
    <Card title="Cohort · การกลับมาซื้อซ้ำ" sub="แถว = เดือนแรกที่ซื้อ · คอลัมน์ = เดือนที่เท่าไรหลังจากนั้น · ช่องลายขีด = เดือนล่าสุดที่ข้อมูลยังไม่ครบ">
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px] text-xs tabular-nums" style={{ gridTemplateColumns: `72px 44px repeat(${MAXK + 1}, 40px)` }}>
          <div className="font-medium text-stone-500">เดือนแรก</div><div className="text-right font-medium text-stone-500">คน</div>
          {Array.from({ length: MAXK + 1 }, (_, k) => <div key={k} className="text-center font-medium text-stone-500">{k}</div>)}
          {cohort.cohorts.map((c) => (
            <Row key={c.cohort} c={c} MAXK={MAXK} shade={shade} partial={cohort.lastMonthPartial} />
          ))}
        </div>
      </div>
      <Insight>
        โดยเฉลี่ยลูกค้าใหม่กลับมาซื้อในเดือนถัดไป {pct(avg1)} · ช่องแนวทแยงล่างขวาดูต่ำผิดปกติเพราะ{thaiMonth(cohort.lastMonth)}มีข้อมูล{" "}
        {cohort.daysInLastMonth} จาก {cohort.daysInMonth} วัน (กับดักเดียวกับกราฟ 4 ใน Lab 2.2)
      </Insight>
    </Card>
  );
}
function Row({ c, MAXK, shade, partial }) {
  const last = c.retention.length - 1;
  return (
    <>
      <div className="py-1">{thaiMonth(c.cohort)}</div>
      <div className="py-1 text-right text-stone-500">{c.size}</div>
      {Array.from({ length: MAXK + 1 }, (_, k) => {
        const v = c.retention[k];
        if (v === undefined) return <div key={k} />;
        const isPartial = partial && k === last && k > 0;
        return (
          <div key={k} title={`${thaiMonth(c.cohort)} เดือนที่ ${k}: ${pct(v, 1)}${isPartial ? " (เดือนไม่ครบ)" : ""}`}
               className="flex h-7 items-center justify-center rounded-[3px]"
               style={{
                 background: isPartial ? `repeating-linear-gradient(45deg, ${shade(v)}, ${shade(v)} 4px, #fff 4px, #fff 6px)` : shade(v),
                 color: v >= 0.5 ? "#fff" : INK,
               }}>
            {k === 0 ? "" : Math.round(v * 100)}
          </div>
        );
      })}
    </>
  );
}

// ---------------- ABC ----------------
function AbcCard({ abc }) {
  if (abc.error) return <Card title="Pareto · ABC ของเมนู"><Pending lab="Lab 4.2" error={abc.error} /></Card>;
  const items = abc.items;
  const nA = items.filter((i) => i.cls === "A").length;
  const C = items.filter((i) => i.cls === "C");
  const fill = { A: MAIN, B: RAMP[2], C: "#d6d3d1" };
  return (
    <Card title="Pareto · ABC ของเมนู" sub="แท่ง = สัดส่วนยอดขายแต่ละเมนู · เส้น = ยอดสะสม · แกนเดียวกันเป็น %">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="rank" tick={{ ...AXIS_TICK, fontSize: 11 }} interval={4} label={{ value: "อันดับเมนู", position: "insideBottomRight", offset: -2, fontSize: 12 }} />
            <YAxis tickFormatter={(v) => pct(v)} domain={[0, 1]} width={44} tick={AXIS_TICK} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(r) => { const it = items[r - 1]; return `#${r} ${it.name} · กลุ่ม ${it.cls}`; }}
                     formatter={(v, n) => [pct(v, 1), n]} />
            <ReferenceLine y={0.8} stroke={MUTED} strokeDasharray="4 4" label={{ value: "80%", position: "right", fontSize: 11, fill: INK }} />
            <Bar name="สัดส่วนยอดขาย" dataKey="share" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {items.map((i) => <Cell key={i.product_id} fill={fill[i.cls]} />)}
            </Bar>
            <Line name="ยอดสะสม" dataKey="cumShare" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-600">
        {["A", "B", "C"].map((k) => (
          <span key={k}><i className="mr-1.5 inline-block h-3 w-3 rounded-sm align-[-1px]" style={{ background: fill[k] }} />
            กลุ่ม {k} {items.filter((i) => i.cls === k).length} เมนู</span>
        ))}
      </div>
      <Insight>
        {nA} เมนูจาก {items.length} ทำยอด 80% · กลุ่ม C ({C.map((i) => i.name).join(", ")}) รวมกันแค่ {pct(C.reduce((s, i) => s + i.share, 0), 1)} ควรทบทวนก่อนเพิ่มเมนูใหม่
      </Insight>
    </Card>
  );
}

export default function CustomersTab({ source }) {
  const state = useAnalytics(source);
  const [picked, setPicked] = useState(null);
  return (
    <AnalyticsShell source={source} state={state} title="ลูกค้า & เมนู">
      {(d) => (
        <div className="space-y-4 sm:space-y-6">
          <RfmCard rfm={d.rfm} picked={picked} onPick={(s) => setPicked((p) => (p === s ? null : s))} />
          {picked && !d.rfm.error && <SegmentCustomersCard customers={d.rfm.customers} segment={picked} onClose={() => setPicked(null)} />}
          <CohortCard cohort={d.cohort} />
          <AbcCard abc={d.abc} />
        </div>
      )}
    </AnalyticsShell>
  );
}
