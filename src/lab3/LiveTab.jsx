// Lab 3.2 · Dashboard ยอดขายแบบ real-time จาก Firestore (Prompt 3.2B)
// ฟัง collection "sales" ด้วย onSnapshot · คำนวณทุกอย่างด้วย metrics.js จาก Lab 1
// Lab 3.3 · ต้องล็อกอินด้วย Google ก่อน Dashboard จึงจะเริ่มอ่านข้อมูล (Prompt 3.3A)
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, db, googleProvider, isConfigured } from "./firebase.js";
import { addDays, todayBangkok } from "./time.js";
import { BRANCHES } from "./saleModel.js";
import { computeKpis, dailyRevenue, fmtBaht, fmtNum, fmtShortBaht, formatThaiDate, prepareRows, revenueByBranch } from "../lib/metrics.js";
import KpiCard from "../components/KpiCard.jsx";
import SaleForm from "./SaleForm.jsx";
import { AXIS_TICK, GRID_COLOR, PINK, TOOLTIP_STYLE } from "../components/theme.ts";

const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7d", label: "7 วัน", days: 7 },
  { id: "30d", label: "30 วัน", days: 30 },
];
const HIGHLIGHT_MS = 4000;
const RECENT_COUNT = 8;

const ERROR_TEXT = {
  "permission-denied": "ไม่มีสิทธิ์อ่านข้อมูลยอดขาย (Security Rules ไม่อนุญาต) ลองเข้าสู่ระบบหรือตรวจ firestore.rules",
  unauthenticated: "ต้องเข้าสู่ระบบก่อนจึงจะดูยอดขายได้",
  "failed-precondition": "Firestore ต้องการ index สำหรับ query นี้ ดูลิงก์สร้าง index ใน Console ของเบราว์เซอร์",
  unavailable: "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
  "resource-exhausted": "ใช้โควตาการอ่านของ Firestore วันนี้หมดแล้ว",
};
const thaiError = (e) => ERROR_TEXT[e.code] ?? `เกิดข้อผิดพลาด: ${e.message}`;

const AUTH_ERROR_TEXT = {
  "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาตให้ล็อกอิน เพิ่มโดเมนใน Firebase Console → Authentication → Settings → Authorized domains",
  "auth/operation-not-allowed": "ยังไม่ได้เปิดการล็อกอินด้วย Google เปิดใน Firebase Console → Authentication → Sign-in method → Google",
  "auth/configuration-not-found": "โปรเจกต์ยังไม่ได้เปิดใช้ Authentication ไปที่ Firebase Console → Authentication → Get started แล้วเปิด Google ใน Sign-in method",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่",
  "auth/popup-closed-by-user": "หน้าต่างล็อกอินถูกปิดก่อนเข้าสู่ระบบเสร็จ ลองใหม่อีกครั้ง",
};
const thaiAuthError = (e) => AUTH_ERROR_TEXT[e.code] ?? `เข้าสู่ระบบไม่สำเร็จ: ${e.message}`;

/** ประตูล็อกอิน: ยังไม่ล็อกอิน = ไม่ mount Dashboard จึงไม่มี onSnapshot เกิดขึ้นเลย */
export default function LiveTab() {
  const [user, setUser] = useState(undefined); // undefined = กำลังตรวจ · null = ยังไม่ล็อกอิน
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), []);

  async function signIn() {
    setAuthError("");
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setAuthError(thaiAuthError(e));
    } finally {
      setSigningIn(false);
    }
  }

  if (!isConfigured) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-stone-200">
        ยังไม่ได้ตั้งค่า Firebase ใส่ค่าใน <code>.env</code> ตามคู่มือ Lab 3.1 แล้วรัน <code>npm run dev</code> ใหม่
      </div>
    );
  }

  if (user === undefined) {
    return <p className="text-sm text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  }

  if (user === null) {
    return (
      <div className="mx-auto max-w-md rounded-xl bg-white p-6 text-center ring-1 ring-stone-200 sm:p-8">
        <h1 className="text-xl font-semibold text-stone-800">ยอดขายสด</h1>
        <p className="mt-2 text-sm text-stone-500">เข้าสู่ระบบเพื่อดูยอดขายแบบ real-time และบันทึกยอดขาย</p>
        <button
          type="button"
          onClick={signIn}
          disabled={signingIn}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true" className="text-base font-bold text-[#4285f4]">G</span>
          {signingIn ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        {authError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">❌ {authError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />}
        <span className="max-w-[12rem] truncate text-sm font-medium text-stone-700">{user.displayName ?? user.email}</span>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="rounded-lg px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
        >
          ออกจากระบบ
        </button>
      </div>
      <LiveDashboard user={user} />
    </div>
  );
}

function LiveDashboard({ user }) {
  const [rangeId, setRangeId] = useState("7d");
  const [branch, setBranch] = useState("");
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | live | error
  const [error, setError] = useState("");
  const [reads, setReads] = useState(0);
  const [fresh, setFresh] = useState(() => new Set());
  const timers = useRef([]);
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState("");

  // เมนูเปลี่ยนไม่บ่อย จึงอ่านครั้งเดียวด้วย getDocs (ไม่ต้องฟังแบบ real-time)
  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, "products"))
      .then((snap) => setProducts(
        snap.docs.map((d) => d.data()).sort((a, b) => a.product_id.localeCompare(b.product_id)),
      ))
      .catch((e) => setProductsError(`โหลดเมนูไม่ได้ · ${thaiError(e)}`));
  }, []);

  const range = RANGES.find((r) => r.id === rangeId);
  const end = todayBangkok();
  const start = addDays(end, -(range.days - 1));

  useEffect(() => {
    if (!db) return;
    let first = true;

    const q = query(collection(db, "sales"), where("date", ">=", start), where("date", "<=", end), orderBy("date"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        setReads((n) => n + changes.length);
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus("live");

        if (!first) {
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length) {
            setFresh((s) => new Set([...s, ...added]));
            timers.current.push(setTimeout(() => {
              setFresh((s) => {
                const next = new Set(s);
                added.forEach((id) => next.delete(id));
                return next;
              });
            }, HIGHLIGHT_MS));
          }
        }
        first = false;
      },
      (e) => {
        setStatus("error");
        setError(thaiError(e));
      },
    );

    return () => {
      unsubscribe();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [start, end]);

  // เปลี่ยนช่วงเวลา = เริ่ม listener ใหม่ จึงล้างสถานะเดิมที่นี่ (ไม่ทำใน effect)
  const changeRange = (id) => {
    if (id === rangeId) return;
    setRangeId(id);
    setStatus("loading");
    setError("");
    setReads(0);
    setFresh(new Set());
  };

  const rows = useMemo(() => {
    const prepared = prepareRows(docs);
    return branch ? prepared.filter((r) => r.branch === branch) : prepared;
  }, [docs, branch]);

  const kpi = useMemo(() => computeKpis(rows), [rows]);
  const byBranch = useMemo(() => revenueByBranch(rows), [rows]);
  const daily = useMemo(() => dailyRevenue(rows), [rows]);
  const hourly = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0 }));
    for (const r of rows) byHour[r.hour].revenue += r.revenue;
    return byHour;
  }, [rows]);
  const recent = useMemo(
    () => [...rows].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, RECENT_COUNT),
    [rows],
  );
  const productName = useMemo(() => new Map(products.map((p) => [p.product_id, p.product_name])), [products]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-800 sm:text-2xl">
            ยอดขายสด
            {status === "live" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> LIVE
              </span>
            )}
          </h1>
          <p className="text-xs text-stone-400 sm:text-sm">
            {branch ? `สาขา${branch}` : "ทุกสาขา"} ·{" "}
            {range.days === 1 ? formatThaiDate(end) : `${formatThaiDate(start)} – ${formatThaiDate(end)}`} ·
            อ่านเอกสารไปแล้ว {fmtNum(reads)} รายการ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-white p-1 ring-1 ring-stone-200">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => changeRange(r.id)}
                aria-pressed={rangeId === r.id}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  rangeId === r.id ? "bg-[#e0428f] text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
            aria-label="เลือกสาขา"
          >
            <option value="">ทุกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {status === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">❌ {error}</div>
      )}
      {status === "loading" && <p className="text-sm text-stone-500">กำลังโหลดข้อมูลจาก Firestore…</p>}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        <KpiCard label="ยอดขายรวม" value={fmtBaht(kpi.revenue)} />
        <KpiCard label="จำนวนบิล" value={fmtNum(kpi.bills)} />
        <KpiCard label="เฉลี่ยต่อบิล" value={fmtBaht(kpi.avgPerBill)} />
        <KpiCard label="ลูกค้าสมาชิก" value={fmtNum(kpi.customers)} note="ไม่นับลูกค้าทั่วไป" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 sm:gap-6">
        <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200 lg:col-span-2">
          <h2 className="font-semibold text-stone-800">{range.days === 1 ? "ยอดขายรายชั่วโมงวันนี้" : "ยอดขายรายวัน"}</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              {range.days === 1 ? (
                <BarChart data={hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="hour" tick={AXIS_TICK} tickFormatter={(h) => `${h}:00`} interval={2} />
                  <YAxis tick={AXIS_TICK} tickFormatter={fmtShortBaht} width={56} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(h) => `${h}:00–${h}:59 น.`} formatter={(v) => [fmtBaht(v), "ยอดขาย"]} />
                  <Bar dataKey="revenue" fill={PINK} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              ) : (
                <LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d) => formatThaiDate(d, { year: "none" })} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} tickFormatter={fmtShortBaht} width={56} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => formatThaiDate(d)} formatter={(v) => [fmtBaht(v), "ยอดขาย"]} />
                  <Line type="monotone" dataKey="revenue" stroke={PINK} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-semibold text-stone-800">ยอดขายแยกสาขา</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-stone-500">
              <tr><th className="py-2 font-medium">สาขา</th><th className="py-2 text-right font-medium">บิล</th><th className="py-2 text-right font-medium">ยอดขาย</th></tr>
            </thead>
            <tbody>
              {byBranch.map((b) => (
                <tr key={b.branch} className="border-t border-stone-100">
                  <td className="py-2">{b.branch}</td>
                  <td className="py-2 text-right tabular-nums">{fmtNum(b.bills)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtBaht(b.revenue)}</td>
                </tr>
              ))}
              {byBranch.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-stone-400">ยังไม่มียอดขายในช่วงนี้</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="font-semibold text-stone-800">รายการล่าสุด</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-stone-500">
              <tr>
                <th className="py-2 font-medium">เวลา</th>
                <th className="py-2 font-medium">สาขา</th>
                <th className="py-2 font-medium">เมนู</th>
                <th className="py-2 text-right font-medium">จำนวน</th>
                <th className="py-2 text-right font-medium">ยอดขาย</th>
                <th className="py-2 pl-3 font-medium">ชำระ</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-stone-100 transition-colors duration-700 ${fresh.has(r.id) ? "bg-amber-100" : ""}`}
                >
                  <td className="py-2 tabular-nums">{formatThaiDate(r.date, { year: "none" })} {r.datetime.slice(11, 16)}</td>
                  <td className="py-2">{r.branch}</td>
                  <td className="py-2">{productName.get(r.product_id) ?? r.product_id}</td>
                  <td className="py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="py-2 text-right tabular-nums">{fmtBaht(r.revenue)}</td>
                  <td className="py-2 pl-3">{r.payment_method}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-stone-400">ยังไม่มีรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <aside className="xl:sticky xl:top-4">
        <SaleForm products={products} productsError={productsError} uid={user.uid} />
      </aside>
      </div>
    </div>
  );
}
