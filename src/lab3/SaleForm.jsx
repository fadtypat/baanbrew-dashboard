// Lab 3.2 · ฟอร์มบันทึกยอดขาย (Prompt 3.2C)
// ตรวจด้วย validateSaleForm · สร้างเอกสารด้วย buildSale · บันทึกลง Firestore ด้วย setDoc
import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, MAX_QTY, PAYMENTS, buildSale, validateSaleForm } from "./saleModel.js";
import { fmtBaht } from "../lib/metrics.js";

const EMPTY = { branch: "", product_id: "", qty: "1", payment_method: "", customer_id: "" };

const saveErrorText = (e) =>
  e.code === "permission-denied" ? "ถูกปฏิเสธโดย Security Rules" : `บันทึกไม่สำเร็จ: ${e.message}`;

const inputClass = (hasError) =>
  `mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ${hasError ? "ring-red-400" : "ring-stone-200"} focus:outline-none focus:ring-2 focus:ring-[#e0428f]`;

function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// uid = ผู้ใช้ที่ล็อกอิน (LiveTab ส่งมา) ใช้เป็น created_by ของเอกสาร
export default function SaleForm({ products, productsError, uid }) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false); // แสดง error หลังกดบันทึกครั้งแรก
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  const errors = useMemo(() => validateSaleForm(form, products), [form, products]);
  const shown = submitted ? errors : {};
  const product = products.find((p) => p.product_id === form.product_id);

  // ยอดรวมก่อนบันทึก: ใช้ buildSale ตัวเดียวกับตอนบันทึก จึงตรงกับที่จะเก็บจริง
  const preview = useMemo(
    () => (Object.keys(errors).length === 0 && product ? buildSale(form, product, { uid }).data : null),
    [errors, form, product, uid],
  );

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setResult(null);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || !product) return;

    setSaving(true);
    setResult(null);
    try {
      const { id, data } = buildSale(form, product, { uid });
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setResult({ ok: true, text: `บันทึกแล้ว · บิล ${data.order_id} · ${fmtBaht(data.revenue)}` });
      // เก็บสาขาและวิธีชำระไว้ เพราะมักบันทึกต่อเนื่องที่สาขาเดิม
      setForm((f) => ({ ...EMPTY, branch: f.branch, payment_method: f.payment_method }));
      setSubmitted(false);
    } catch (err) {
      setResult({ ok: false, text: saveErrorText(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="font-semibold text-stone-800">บันทึกยอดขาย</h2>
      {productsError && <p role="alert" className="mt-2 text-sm text-red-700">❌ {productsError}</p>}

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
        <Field label="สาขา" error={shown.branch}>
          <select value={form.branch} onChange={set("branch")} className={inputClass(shown.branch)}>
            <option value="">เลือกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="เมนู" error={shown.product_id}>
          <select value={form.product_id} onChange={set("product_id")} className={inputClass(shown.product_id)}>
            <option value="">{products.length ? "เลือกเมนู" : "กำลังโหลดเมนู…"}</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.product_name} · {fmtBaht(p.price)}</option>
            ))}
          </select>
        </Field>

        <Field label={`จำนวน (1–${MAX_QTY})`} error={shown.qty}>
          <input
            type="number" inputMode="numeric" min={1} max={MAX_QTY} step={1}
            value={form.qty} onChange={set("qty")} className={inputClass(shown.qty)}
          />
        </Field>

        <Field label="วิธีชำระเงิน" error={shown.payment_method}>
          <select value={form.payment_method} onChange={set("payment_method")} className={inputClass(shown.payment_method)}>
            <option value="">เลือกวิธีชำระเงิน</option>
            {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="รหัสสมาชิก (ไม่บังคับ)" error={shown.customer_id}>
          <input
            type="text" placeholder="เช่น C01234" autoComplete="off"
            value={form.customer_id} onChange={set("customer_id")} className={inputClass(shown.customer_id)}
          />
        </Field>

        <div className="flex items-baseline justify-between rounded-lg bg-stone-50 px-3 py-2">
          <span className="text-sm text-stone-500">ยอดรวม</span>
          <span className="text-xl font-semibold tabular-nums text-stone-900">
            {preview ? fmtBaht(preview.revenue) : "–"}
          </span>
        </div>
        {preview && (
          <p className="text-xs text-stone-400">
            {preview.qty} × {fmtBaht(preview.unit_price)} · ช่องทาง{preview.channel}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || products.length === 0}
          className="w-full rounded-lg bg-[#e0428f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c02d74] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>

        {result && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {result.ok ? "✅" : "❌"} {result.text}
          </p>
        )}
      </form>
    </section>
  );
}
