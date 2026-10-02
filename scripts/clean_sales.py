"""ทำความสะอาด sales.csv — ทำงานบน clean = df.copy() ไม่แก้ df ต้นฉบับ

รันจาก terminal:  python scripts/clean_sales.py [path/to/sales.csv]
รันใน Jupyter/Colab:  ถ้ามี df อยู่แล้วจะใช้ df นั้น (ควรอ่านด้วย dtype=str, keep_default_na=False)

ทุกขั้นตอนบันทึกลง log เป็น (ขั้นตอน, จำนวนแถวที่กระทบ, การตัดสินใจ)
"""

import os
import re
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd

DEFAULT_CSV_PATH = "public/sales.csv"
SAMPLE_N = 5
BE_OFFSET = 543  # พ.ศ. − 543 = ค.ศ.
THAI_TZ = timezone(timedelta(hours=7))

VALID_BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"]

# ชื่อสาขาหลัง normalize (ตัดช่องว่างทั้งหมด, ตัดคำว่า "สาขา", ตัวพิมพ์เล็ก) → ชื่อมาตรฐาน
# เจอชื่อใหม่ที่ map ไม่ได้ ให้เพิ่มที่นี่ (สคริปต์จะแสดงค่าที่ map ไม่ได้ให้เห็น)
BRANCH_MAP = {
    **{b: b for b in VALID_BRANCHES},
    "siam": "สยาม",
    "silom": "สีลม",
    "ari": "อารีย์",
    "aree": "อารีย์",
    "อารี": "อารีย์",
    "อารีย": "อารีย์",
    "bangna": "บางนา",
    "university": "มหาวิทยาลัย",
    "uni": "มหาวิทยาลัย",
    "มหาลัย": "มหาวิทยาลัย",
    "ม.": "มหาวิทยาลัย",
}


def csv_path_from_argv() -> str:
    # ใน Jupyter/Colab sys.argv มี '-f kernel.json' จึงเอาเฉพาะ argument ที่ลงท้าย .csv
    args = [a for a in sys.argv[1:] if not a.startswith("-") and a.lower().endswith(".csv")]
    return args[0] if args else DEFAULT_CSV_PATH


if not isinstance(globals().get("df"), pd.DataFrame):
    CSV_PATH = csv_path_from_argv()
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"ไม่พบไฟล์ {CSV_PATH!r} (โฟลเดอร์ปัจจุบัน: {os.getcwd()})")
    df = pd.read_csv(CSV_PATH, dtype=str, keep_default_na=False, encoding="utf-8-sig")

ORIGINAL_COLUMNS = list(df.columns)
rows_before = len(df)
clean = df.copy()  # ทำงานบนสำเนาเท่านั้น
log: list[dict] = []


def add_log(step: str, affected: int, decision: str) -> None:
    log.append({"ขั้นตอน": step, "จำนวนแถวที่กระทบ": int(affected), "การตัดสินใจ": decision})


def samples(s: pd.Series) -> str:
    return ", ".join(repr(v) for v in s.drop_duplicates().head(SAMPLE_N))


# ---------------------------------------------------------------------------
# 1) ลบแถวที่ซ้ำกันทุกคอลัมน์ (ไม่ใช้ order_id อย่างเดียว เพราะ 1 บิลมีหลายแถว)
# ---------------------------------------------------------------------------
dup = clean.duplicated(keep="first")
clean = clean[~dup]
add_log("1. ลบแถวซ้ำทุกคอลัมน์", dup.sum(), "เก็บแถวแรกของแต่ละกลุ่ม ลบที่เหลือ")

# ---------------------------------------------------------------------------
# 2) datetime → YYYY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ.
#    รองรับ: ISO ปี ค.ศ./พ.ศ. (มี/ไม่มีวินาที, มี/ไม่มี timezone) และ DD/MM/YYYY HH:MM[:SS] ปี ค.ศ./พ.ศ.
#    ปี > 2400 ถือเป็น พ.ศ. (ปี ค.ศ. ในข้อมูลขายไม่มีทางถึง 2400)
# ---------------------------------------------------------------------------
ISO_RE = re.compile(
    r"^(?P<y>\d{4})-(?P<m>\d{1,2})-(?P<d>\d{1,2})[T ](?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2}))?"
    r"(?:\.\d+)?(?P<tz>Z|[+-]\d{2}:?\d{2})?$"
)
DMY_RE = re.compile(
    r"^(?P<d>\d{1,2})/(?P<m>\d{1,2})/(?P<y>\d{4})\s+(?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2}))?$"
)


def parse_tz(tz: str | None) -> timezone:
    if not tz:
        return THAI_TZ  # ไม่มี timezone → ถือเป็นเวลาไทย
    if tz == "Z":
        return timezone.utc
    sign = 1 if tz[0] == "+" else -1
    digits = tz[1:].replace(":", "")
    return timezone(sign * timedelta(hours=int(digits[:2]), minutes=int(digits[2:])))


def normalize_datetime(value: str) -> tuple[str | None, str]:
    """คืน (ค่าใหม่ หรือ None ถ้าแปลงไม่ได้, ประเภทที่เจอ)"""
    v = value.strip()
    m = ISO_RE.match(v) or DMY_RE.match(v)
    if not m:
        return None, "แปลงไม่ได้"
    kind = "ISO" if m.re is ISO_RE else "DD/MM/YYYY"
    year = int(m["y"])
    if year > 2400:
        year -= BE_OFFSET
        kind += " พ.ศ."
    tz = parse_tz(m.groupdict().get("tz"))
    try:
        dt = datetime(year, int(m["m"]), int(m["d"]), int(m["H"]), int(m["M"]), int(m["S"] or 0), tzinfo=tz)
    except ValueError:  # เช่น เดือน 13 / 30 ก.พ.
        return None, "แปลงไม่ได้"
    return dt.astimezone(THAI_TZ).isoformat(timespec="seconds"), kind


parsed = clean["datetime"].map(normalize_datetime)
new_dt = parsed.map(lambda t: t[0])
kinds = parsed.map(lambda t: t[1])
changed = new_dt.notna() & (new_dt != clean["datetime"])
for kind, n in kinds[changed].value_counts().items():
    add_log(f"2. แปลง datetime ({kind})", n, "แปลงเป็น YYYY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ.")
bad_dt = new_dt.isna()
if bad_dt.any():
    add_log("2. datetime แปลงไม่ได้", bad_dt.sum(), f"ลบแถว (ไม่รู้วันเวลาที่ขาย) ตัวอย่าง: {samples(clean.loc[bad_dt, 'datetime'])}")
clean["datetime"] = new_dt
clean = clean[~bad_dt]

# ---------------------------------------------------------------------------
# 3) ชื่อสาขา: ตัดช่องว่าง แล้ว map ให้เหลือ 5 ชื่อ
# ---------------------------------------------------------------------------
stripped = clean["branch"].str.strip()
n_space = int((stripped != clean["branch"]).sum())
if n_space:
    add_log("3. ตัดช่องว่างชื่อสาขา", n_space, "strip ช่องว่างหน้า/หลัง")


def branch_key(name: str) -> str:
    return re.sub(r"\s+", "", name).removeprefix("สาขา").lower()


mapped = stripped.map(lambda b: BRANCH_MAP.get(branch_key(b)))
renamed = mapped.notna() & (mapped != stripped)
if renamed.any():
    pairs = stripped[renamed].drop_duplicates().head(SAMPLE_N)
    add_log("3. map ชื่อสาขา", renamed.sum(), "เปลี่ยนเป็นชื่อมาตรฐาน: " + ", ".join(f"{b!r}→{BRANCH_MAP[branch_key(b)]}" for b in pairs))
unmapped = mapped.isna()
if unmapped.any():
    add_log("3. ชื่อสาขา map ไม่ได้", unmapped.sum(), f"ลบแถว (เพิ่มใน BRANCH_MAP ถ้าเป็นสาขาจริง): {samples(stripped[unmapped])}")
clean["branch"] = mapped
clean = clean[~unmapped]

# ---------------------------------------------------------------------------
# 4) unit_price: ตัด "บาท" แปลงเป็นตัวเลข จัดการราคาติดลบ แล้วแปลงเป็นจำนวนเต็ม
# ---------------------------------------------------------------------------
price_str = clean["unit_price"].str.replace("บาท", "", regex=False)
n_baht = int((price_str != clean["unit_price"]).sum())
if n_baht:
    add_log('4. ตัดคำว่า "บาท"', n_baht, 'ลบคำว่า "บาท" ออกก่อนแปลงเป็นตัวเลข')
price = pd.to_numeric(price_str.str.strip(), errors="coerce")

bad_price = price.isna()
if bad_price.any():
    add_log("4. unit_price แปลงไม่ได้", bad_price.sum(), f"ลบแถว (ไม่รู้ราคา) ตัวอย่าง: {samples(clean.loc[bad_price, 'unit_price'])}")

# ราคาติดลบ: เทียบกับ "ราคาปกติ" ของสินค้านั้น = ราคาบวกที่พบบ่อยที่สุดของ product_id เดียวกัน
#  - |ราคา| ตรงกับราคาปกติ → น่าจะพิมพ์เครื่องหมายลบเกิน จึงกลับเป็นบวก
#  - ไม่ตรง / ไม่มีราคาอ้างอิง → ไม่แน่ใจว่าราคาที่ถูกคือเท่าไร จึงลบแถว (ไม่เดาตัวเลขเอง)
ref_price = price[price > 0].groupby(clean["product_id"]).agg(lambda s: s.mode().iloc[0])
neg = price < 0
neg_fixable = neg & (price.abs() == clean["product_id"].map(ref_price))
neg_drop = neg & ~neg_fixable
if neg_fixable.any():
    add_log("4. ราคาติดลบ (ตรงราคาปกติ)", neg_fixable.sum(), "กลับเป็นค่าบวก: |ราคา| ตรงกับราคาปกติของสินค้านั้น น่าจะพิมพ์ลบเกิน")
if neg_drop.any():
    add_log("4. ราคาติดลบ (ไม่ตรงราคาปกติ)", neg_drop.sum(), f"ลบแถว: ไม่มีราคาอ้างอิงที่ตรง ตัวอย่าง: {samples(clean.loc[neg_drop, 'unit_price'])}")
price = price.where(~neg_fixable, price.abs())

not_int = price.notna() & (price % 1 != 0)
if not_int.any():
    add_log("4. unit_price มีทศนิยม", not_int.sum(), "ปัดเป็นจำนวนเต็มใกล้สุด")
clean["unit_price"] = price
clean = clean[~(bad_price | neg_drop)]
clean["unit_price"] = clean["unit_price"].round().astype("int64")

# ---------------------------------------------------------------------------
# 5) ลบแถว qty = 0 และแถว product_id ว่าง
# ---------------------------------------------------------------------------
qty_zero = pd.to_numeric(clean["qty"].str.strip(), errors="coerce") == 0
clean = clean[~qty_zero]
add_log("5. ลบแถว qty = 0", qty_zero.sum(), "ลบแถว (ไม่มีการขายจริง)")

no_product = clean["product_id"].str.strip() == ""
clean = clean[~no_product]
add_log("5. ลบแถว product_id ว่าง", no_product.sum(), "ลบแถว (ไม่รู้ว่าขายสินค้าอะไร)")

# ---------------------------------------------------------------------------
# 6) ตรวจซ้ำอีกรอบหลัง normalize — แถวที่เดิมต่างกันแค่รูปแบบ (เช่น ปี พ.ศ. / ช่องว่างในชื่อสาขา) จะซ้ำกันแล้ว
# ---------------------------------------------------------------------------
dup2 = clean.duplicated(keep="first")
clean = clean[~dup2]
add_log("6. ลบแถวซ้ำหลัง normalize", dup2.sum(), "แถวที่ต่างแค่รูปแบบข้อมูล ถือเป็นแถวเดียวกัน เก็บแถวแรก")

# ---------------------------------------------------------------------------
# ผลลัพธ์: คอลัมน์และลำดับเหมือนเดิม
# ---------------------------------------------------------------------------
clean = clean[ORIGINAL_COLUMNS].reset_index(drop=True)
assert list(clean.columns) == ORIGINAL_COLUMNS
assert clean["unit_price"].dtype == "int64"
assert set(clean["branch"]) <= set(VALID_BRANCHES)
assert clean["datetime"].str.fullmatch(r"(19|20)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00").all()

log_df = pd.DataFrame(log, columns=["ขั้นตอน", "จำนวนแถวที่กระทบ", "การตัดสินใจ"])
with pd.option_context("display.max_colwidth", None, "display.width", 200):
    print(log_df.to_string(index=False))
print(f"\nจำนวนแถว: ก่อน {rows_before:,} → หลัง {len(clean):,} (ลบ {rows_before - len(clean):,} แถว)")

# บันทึกไฟล์ (ถ้าต้องการ):
# clean.to_csv("sales_clean.csv", index=False, encoding="utf-8-sig")
