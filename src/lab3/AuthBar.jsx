// ส่วนล็อกอินที่ใช้ร่วมกัน (การ์ดเข้าสู่ระบบ + ชิปผู้ใช้) ใช้โทนเดียวกับ Card ของ Dashboard
// ข้อความ error ของ Firebase Auth แปลเป็นไทยไว้ที่นี่ที่เดียว

const AUTH_ERROR_TEXT = {
  "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาตให้ล็อกอิน เพิ่มโดเมนใน Firebase Console → Authentication → Settings → Authorized domains",
  "auth/operation-not-allowed": "ยังไม่ได้เปิดการล็อกอินด้วย Google เปิดใน Firebase Console → Authentication → Sign-in method → Google",
  "auth/configuration-not-found": "โปรเจกต์ยังไม่ได้เปิดใช้ Authentication ไปที่ Firebase Console → Authentication → Get started แล้วเปิด Google ใน Sign-in method",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่",
  "auth/popup-closed-by-user": "หน้าต่างล็อกอินถูกปิดก่อนเข้าสู่ระบบเสร็จ ลองใหม่อีกครั้ง",
};

export const authErrorText = (e) => AUTH_ERROR_TEXT[e.code] ?? `เข้าสู่ระบบไม่สำเร็จ: ${e.message}`;

export function LoginCard({ onSignIn, error, title = "เข้าสู่ระบบ", hint = "เข้าสู่ระบบด้วย Google เพื่อดูผลวิเคราะห์" }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-[0_4px_24px_rgba(60,30,90,0.06)] sm:p-8">
      <h1 className="text-xl font-semibold text-stone-800">{title}</h1>
      <p className="mt-2 text-sm text-stone-500">{hint}</p>
      <button
        type="button"
        onClick={onSignIn}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50"
      >
        <span aria-hidden="true" className="text-base font-bold text-[#4285f4]">G</span>
        เข้าสู่ระบบด้วย Google
      </button>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">❌ {error}</p>}
    </div>
  );
}

export function UserChip({ user, onSignOut }) {
  return (
    <div className="flex items-center gap-3">
      {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />}
      <span className="max-w-[12rem] truncate text-sm font-medium text-stone-700">{user.displayName ?? user.email}</span>
      <button
        type="button"
        onClick={onSignOut}
        className="rounded-lg px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
