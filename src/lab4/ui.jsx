import { LoginCard, UserChip, authErrorText } from "../lab3/AuthBar.jsx";
import { useState } from "react";
import { Card as BaseCard } from "../components/ui.tsx";
import { MUTED as THEME_MUTED, PINK, PURPLE } from "../components/theme.ts";

// สีและการ์ดใช้ชุดเดียวกับ Dashboard (components/theme.ts, components/ui.tsx)
export const INK = "#2d2a3e";
export const MUTED = THEME_MUTED;
export const RAMP = ["#f3eeff", "#e0d4ff", "#c7b0ff", "#a583ff", PURPLE, "#5a2fd6"]; // ไล่สีเดียว อ่อน→เข้ม (ม่วง)
export const MAIN = PINK;
export { PINK, PURPLE };
export const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
export const thaiDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
export const thaiMonth = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("th-TH", { month: "short", year: "2-digit" });

/** การ์ดของ Dashboard (sub → subtitle, right → action เพื่อให้โค้ดของ Lab 4 ไม่ต้องเปลี่ยน) */
export function Card({ title, sub, children, right }) {
  return <BaseCard title={title} subtitle={sub} action={right}>{children}</BaseCard>;
}

/** แสดงแทนส่วนที่ยังคำนวณไม่ได้ เช่น ฟังก์ชันยังเป็น "ยังไม่ได้ทำ" */
export function Pending({ lab, error }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[#ddd3ea] p-6 text-center text-stone-500">
      <div className="font-medium">รอ {lab}</div>
      <div className="mt-1 text-sm">{error}</div>
    </div>
  );
}

export function Insight({ children }) {
  return <p className="mt-3 rounded-xl bg-[#faf5ff] px-3 py-2 text-sm text-stone-700">💡 {children}</p>;
}

/** ส่วนหัวร่วม: ล็อกอิน, ความสดของข้อมูล, จำนวนเอกสารที่อ่าน */
export function AnalyticsShell({ source, state, title, children }) {
  const { user, data, error } = state;
  const [authError, setAuthError] = useState(null);
  if (user === undefined) return <p className="text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (!user) {
    return <LoginCard title={title} hint="เข้าสู่ระบบด้วย Google เพื่อดูผลวิเคราะห์"
                      onSignIn={() => source.signIn().catch((e) => setAuthError(authErrorText(e)))} error={authError} />;
  }
  const m = data?.meta;
  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 sm:text-2xl">{title}</h1>
          {m && (
            <p className="mt-1 text-xs text-stone-400 sm:text-sm">
              ข้อมูลถึง {thaiDay(m.asOf)} · {m.rows?.toLocaleString()} รายการ ·{" "}
              {m.builtBy === "demo" ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">โหมดสาธิต คำนวณในเบราว์เซอร์</span>
                : <>อัปเดต {m.builtAt ? new Date(m.builtAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "–"} โดย {m.builtBy === "github-actions" ? "GitHub Actions" : "เครื่องผู้สอน/ผู้เรียน"} · อ่าน {data.reads} เอกสาร</>}
            </p>
          )}
        </div>
        <UserChip user={user} onSignOut={() => source.signOut()} />
      </header>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && !error && <p className="text-stone-500">กำลังโหลดผลวิเคราะห์…</p>}
      {data && children(data)}
    </div>
  );
}
