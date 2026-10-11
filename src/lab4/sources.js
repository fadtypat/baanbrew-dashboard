// แหล่งข้อมูลของแท็บ Lab 4 · ทั้งสองแบบมีหน้าตาเดียวกัน: { onAuth, signIn, signOut, loadAnalytics }
// - firestoreSource: ล็อกอิน Google แล้วอ่าน 5 เอกสารใน collection "analytics" (ไม่อ่านยอดขายดิบจาก sales)
// - demoSource: เปิดด้วย ?demo คำนวณในเบราว์เซอร์จาก CSV ไม่ต้องมี Firebase และไม่ใช้โควตา
import Papa from "papaparse";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, db, googleProvider, isConfigured } from "../lab3/firebase.js";
import { parseSales, prepareRows } from "../lib/metrics.js";
import { buildDemoAnalytics } from "./demoAnalytics.js";

const DOCS = ["meta", "daily", "rfm", "cohort", "abc"];

export const isDemo = () => new URLSearchParams(window.location.search).has("demo");

export const firestoreSource = {
  onAuth(cb) {
    if (!auth) { cb(null); return () => {}; }
    return onAuthStateChanged(auth, cb);
  },
  signIn: () => {
    if (!isConfigured) return Promise.reject(new Error("ยังไม่ได้ตั้งค่า Firebase ใส่ค่าใน .env ตามคู่มือ Lab 3.1 (หรือเปิดโหมดสาธิตด้วย ?demo)"));
    return signInWithPopup(auth, googleProvider);
  },
  signOut: () => signOut(auth),
  /** อ่าน analytics/{meta,daily,rfm,cohort,abc} = 5 การอ่านเสมอ ไม่ว่าจะมียอดขายกี่แถว */
  async loadAnalytics() {
    const snaps = await Promise.all(DOCS.map((id) => getDoc(doc(db, "analytics", id))));
    const missing = DOCS.filter((_, i) => !snaps[i].exists());
    if (missing.length) throw new Error(`ยังไม่มีเอกสาร analytics/${missing.join(", ")} รัน npm run analytics ก่อน`);
    const data = Object.fromEntries(DOCS.map((id, i) => [id, snaps[i].data()]));
    // builtAt เป็น Timestamp ของ Firestore → แปลงเป็นมิลลิวินาทีให้ new Date() ใช้ได้
    data.meta = { ...data.meta, builtAt: data.meta.builtAt?.toMillis?.() ?? null };
    return { ...data, reads: DOCS.length };
  },
};

const fetchCsv = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลด ${url} ไม่สำเร็จ (${res.status})`);
  return (await res.text()).replace(/^﻿/, "");
};
const parseCsv = (text) => Papa.parse(text, { header: true, skipEmptyLines: true }).data;

export const demoSource = {
  onAuth(cb) { cb({ displayName: "ผู้ใช้โหมดสาธิต", email: "demo@local" }); return () => {}; },
  signIn: () => Promise.resolve(),
  signOut: () => { window.location.search = ""; return Promise.resolve(); }, // ออกจากโหมดสาธิต
  async loadAnalytics() {
    const [salesText, productsText, holidaysText] = await Promise.all([
      fetchCsv("/sales.csv"), fetchCsv("/products.csv"), fetchCsv("/thai_holidays.csv").catch(() => ""),
    ]);
    const rows = prepareRows(parseSales(salesText));
    const holidays = Object.fromEntries(parseCsv(holidaysText).map((h) => [h.date, h.holiday]));
    return buildDemoAnalytics(rows, parseCsv(productsText), holidays);
  },
};

export const analyticsSource = () => (isDemo() ? demoSource : firestoreSource);
