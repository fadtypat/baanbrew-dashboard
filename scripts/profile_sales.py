"""Data profiling ของ sales.csv — รายงานอย่างเดียว ไม่แก้ข้อมูล

รันจาก terminal:  python scripts/profile_sales.py [path/to/sales.csv]
รันใน Jupyter/Colab:
  - ถ้ามี DataFrame ชื่อ df อยู่แล้ว จะใช้ df นั้นเลย
  - ถ้ายังไม่มี จะอ่านไฟล์จาก CSV_PATH (แก้ path ได้ด้านล่าง เช่น Colab ใช้ "/content/sales.csv")
"""

import os
import sys

import pandas as pd

DEFAULT_CSV_PATH = "public/sales.csv"
SAMPLE_N = 5  # จำนวนตัวอย่างที่แสดงในแต่ละข้อ

# ชื่อสาขาที่ถูกต้อง — ชื่อที่ไม่อยู่ในนี้ (รวมถึงสะกดต่าง / มีช่องว่างเกิน / ว่าง) นับเป็น bad branch
VALID_BRANCHES = {"สยาม", "สีลม", "บางนา", "มหาวิทยาลัย", "อารีย์"}


def csv_path_from_argv() -> str:
    """เอา path ไฟล์ .csv จาก command line

    ใน Jupyter/Colab sys.argv เป็น ['ipykernel_launcher.py', '-f', '/.../kernel-xxx.json']
    จึงต้องกรองเอาเฉพาะ argument ที่ไม่ขึ้นต้นด้วย '-' และลงท้ายด้วย .csv
    """
    args = [a for a in sys.argv[1:] if not a.startswith("-") and a.lower().endswith(".csv")]
    return args[0] if args else DEFAULT_CSV_PATH


if isinstance(globals().get("df"), pd.DataFrame):
    # Notebook ที่โหลด df ไว้แล้ว — ใช้ตามนั้น (ควรอ่านมาด้วย dtype=str, keep_default_na=False)
    source = "DataFrame df ที่มีอยู่แล้ว"
else:
    CSV_PATH = csv_path_from_argv()
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"ไม่พบไฟล์ {CSV_PATH!r} (โฟลเดอร์ปัจจุบัน: {os.getcwd()})\n"
            "แก้ DEFAULT_CSV_PATH ให้ชี้ไปที่ไฟล์ หรือโหลด df ไว้ก่อนรันสคริปต์นี้"
        )
    # ทุกคอลัมน์เป็น str, ค่าว่างเป็น "" (ไม่ให้ pandas แปลงเป็น NaN); utf-8-sig ตัด BOM หัวไฟล์
    df = pd.read_csv(CSV_PATH, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    source = CSV_PATH


def section(title: str) -> None:
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")


def samples(s: pd.Series) -> list[str]:
    """ตัวอย่างค่าไม่ซ้ำ ไม่เกิน SAMPLE_N ตัว (ใช้ repr ให้เห็นช่องว่างหน้า/หลัง)"""
    return [repr(v) for v in s.drop_duplicates().head(SAMPLE_N)]


print(f"ข้อมูล: {source}  |  {len(df):,} แถว × {df.shape[1]} คอลัมน์")

# 1) ค่าว่างและค่าไม่ซ้ำของแต่ละคอลัมน์ — ค่าที่มีแต่ช่องว่างถือเป็นค่าว่างด้วย
section("1) ค่าว่าง / ค่าไม่ซ้ำ รายคอลัมน์")
is_blank = df.apply(lambda col: col.str.strip() == "")
profile = pd.DataFrame(
    {
        "ค่าว่าง": is_blank.sum(),
        "% ว่าง": (is_blank.mean() * 100).round(2),
        "ค่าไม่ซ้ำ": df.nunique(),  # นับ "" เป็นหนึ่งค่าด้วย ถ้ามี
    }
)
print(profile.to_string())

# 2) แถวที่ซ้ำกันทุกคอลัมน์ — นับเฉพาะแถวที่ซ้ำ ไม่นับแถวแรกของแต่ละกลุ่ม
section("2) แถวซ้ำทุกคอลัมน์")
dup_mask = df.duplicated(keep="first")
n_dup = int(dup_mask.sum())
print(f"n_dup = {n_dup:,}")
if n_dup:
    print(df[df.duplicated(keep=False)].head(SAMPLE_N * 2).to_string())

# 3) datetime ที่ไม่ใช่ YYYY-MM-DDT... ปี ค.ศ. (19xx/20xx) — ปี พ.ศ. เช่น 2568 จะไม่ผ่าน
section("3) datetime รูปแบบผิด")
dt_ok = df["datetime"].str.match(r"^(19|20)\d{2}-\d{2}-\d{2}T")
n_bad_dt = int((~dt_ok).sum())
print(f"n_bad_dt = {n_bad_dt:,}")
if n_bad_dt:
    print("ตัวอย่าง:", samples(df.loc[~dt_ok, "datetime"]))

# 4) ชื่อสาขาทั้งหมดพร้อมจำนวนแถว
section("4) ชื่อสาขา")
branch_counts = df["branch"].value_counts()
for name, count in branch_counts.items():
    flag = "" if name in VALID_BRANCHES else "   ← ไม่อยู่ในรายชื่อสาขาที่ถูกต้อง"
    print(f"  {name!r:<20} {count:>8,}{flag}")
n_bad_branch = int((~df["branch"].isin(VALID_BRANCHES)).sum())
print(f"n_bad_branch = {n_bad_branch:,}  (จำนวนแถว)")

# 5) unit_price ที่แปลงเป็นตัวเลขไม่ได้ (ไม่รวมค่าว่าง ซึ่งนับไว้ในข้อ 1) และที่ติดลบ
section("5) unit_price")
price_raw = df["unit_price"].str.strip()
price_num = pd.to_numeric(price_raw, errors="coerce")  # แปลงตรง ๆ แบบเข้มงวด
price_text_mask = price_num.isna() & (price_raw != "")
n_price_text = int(price_text_mask.sum())
print(f"n_price_text = {n_price_text:,}  (ไม่รวมค่าว่าง {int((price_raw == '').sum()):,} แถว)")
if n_price_text:
    print("ตัวอย่าง:", samples(df.loc[price_text_mask, "unit_price"]))


# แปลงเป็นตัวเลขก่อน แล้วจึงเทียบ < 0 — ค่าที่แปลงไม่ได้เป็น NaN ซึ่ง NaN < 0 เป็น False จึงไม่ถูกนับ
# (ห้ามเทียบแบบ string เช่น startswith('-') หรือ df["unit_price"] < "0" เพราะจะนับ '-0', '-abc', '-' ผิด)
neg_mask = price_num < 0
n_price_neg = int(neg_mask.sum())
print(f"n_price_neg  = {n_price_neg:,}")
if n_price_neg:
    print("ตัวอย่าง:", samples(df.loc[neg_mask, "unit_price"]))

# ตรวจเทียบ: ค่าที่ขึ้นต้นด้วย '-' แต่ไม่ถูกนับเป็นติดลบ (เช่น '-0', '-abc') — รายงานเฉย ๆ ไม่นับรวม
dash_not_neg = price_raw.str.startswith("-") & ~neg_mask
if dash_not_neg.any():
    print(f"ขึ้นต้นด้วย '-' แต่ไม่นับเป็นติดลบ {int(dash_not_neg.sum()):,} แถว:", samples(df.loc[dash_not_neg, "unit_price"]))

# 6) qty = 0 (เทียบเป็นตัวเลข จึงจับ "0", "0.0", " 0" ได้) และ product_id ว่าง
section("6) qty = 0 / product_id ว่าง")
qty_num = pd.to_numeric(df["qty"].str.strip(), errors="coerce")
n_qty_zero = int((qty_num == 0).sum())
n_missing_product = int((df["product_id"].str.strip() == "").sum())
print(f"n_qty_zero        = {n_qty_zero:,}")
print(f"n_missing_product = {n_missing_product:,}")

section("สรุป")
summary = {
    "n_dup": n_dup,
    "n_bad_dt": n_bad_dt,
    "n_bad_branch": n_bad_branch,
    "n_price_text": n_price_text,
    "n_price_neg": n_price_neg,
    "n_qty_zero": n_qty_zero,
    "n_missing_product": n_missing_product,
}
for k, v in summary.items():
    print(f"  {k:<18} {v:>8,}")
