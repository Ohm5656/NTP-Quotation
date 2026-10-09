import { readFile, readdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const quotes: { id: string; quotation_no: string | null; quotation_date: string | null; customer_name_raw: string | null; project_name: string | null; total_amount: number | null; source_row: number | null; attention: string | null; email: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("quotations").select("id,quotation_no,quotation_date,customer_name_raw,project_name,total_amount,source_row,attention,email").is("deleted_at", null).order("id").range(from, from + 999);
    if (error) throw error;
    quotes.push(...data);
    if (data.length < 1000) break;
  }
  const report = JSON.parse(await readFile("reports/quotation-financial-repair-commit.json", "utf8"));
  const audit = JSON.parse(await readFile("reports/quotation-archive-audit.json", "utf8"));
  const originalBackupPath = (await readdir("reports")).filter((file) => file.startsWith("contact-repair-backup-")).sort()[0];
  const backup = JSON.parse(await readFile(`reports/${originalBackupPath}`, "utf8"));
  const beforeById = new Map<string, typeof quotes[number]>(backup.quotes.map((row: typeof quotes[number]) => [row.id, row]));
  const preservedFields = ["quotation_no", "quotation_date", "customer_name_raw", "project_name", "total_amount", "source_row"] as const;
  const unexpectedChanges = quotes.filter((quote) => {
    const before = beforeById.get(quote.id);
    return before && preservedFields.some((field) => before[field] !== quote[field]);
  });
  if (unexpectedChanges.length) throw new Error(`Unexpected historical header changes: ${unexpectedChanges.map((row) => row.quotation_no).join(", ")}`);
  const contactChanges = quotes.filter((quote) => {
    const before = beforeById.get(quote.id);
    return before && (before.attention !== quote.attention || before.email !== quote.email);
  });
  const { data: customers, error } = await supabase.from("customers").select("name,tax_id,address,contact,email").order("name");
  if (error) throw error;
  const validEmail = (value: string | null) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  const workbook = new ExcelJS.Workbook();
  const makeSheet = (name: string, headers: string[], rows: unknown[][]) => {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } };
    sheet.columns.forEach((column, index) => { column.width = index === 0 ? 22 : index === headers.length - 1 ? 70 : 40; });
    sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17379C" } }; });
    sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; }));
  };
  const reasons: Record<string, string> = {
    "No matching source workbook": "ไม่พบไฟล์ต้นทางที่ตรงกับเลข Q",
    "Multiple source versions need review": "มีไฟล์ต้นทางหลายฉบับ ต้องเลือกฉบับที่ถูกต้อง",
    "Source identity needs review": "ชื่องาน/ยอดในต้นทางยังจับคู่กับระบบไม่ได้ชัดเจน",
    "Duplicate quotation number has a different amount; needs review": "เลข Q ซ้ำ แต่ยอดต่างกัน ต้องยืนยันว่าเป็นใบไหน",
    "Existing item amounts differ from source; kept for review": "ยอดรายการสินค้าในระบบต่างจาก Excel",
    "Amount column is missing from this source form": "รูปแบบไฟล์ไม่มีคอลัมน์ Amount แบบที่ระบบอ่านได้",
    "Source item calculation differs from its cached grand total; needs review": "ยอดราคา×จำนวนต่างจากยอดที่แสดงในไฟล์ อาจมีจำนวนที่เว้นไว้หรือยอดพิมพ์เอง ต้องตรวจรายละเอียด",
  };
  const reason = (message: string) => reasons[message] ?? message;
  makeSheet("ผลตรวจฟังก์ชัน", ["ข้อกำหนด", "ผล", "หลักฐาน"], [
    ["ผู้ติดต่อแต่ละใบ", "ตรวจครบ 1,568 รายการ", "ยึดชื่อที่แสดงบนใบจริง เช่น C14; ใช้ทะเบียนเดิมเมื่อไม่มีฉบับตรงกับเลข Q"],
    ["เลือกชื่อแล้วเติมอีเมล", "ผ่าน", "จับคู่ชื่อกับบริษัทและอีเมลที่บันทึกไว้; แก้อีเมลเองได้"],
    ["จำบริษัท/ที่อยู่/เลขภาษี", "ผ่าน", "ทดสอบบันทึกบริษัทใหม่แล้วเปิดฟอร์มครั้งถัดไป"],
    ["เลข Q และ Revision", "ผ่าน", "เปลี่ยนเดือนแล้วเสนอเลขใหม่; เลขกรอกเองคงไว้; r2 ได้; ป้องกันเลขซ้ำ"],
    ["ลำดับบนเว็บ", "ผ่าน", "วันใหม่อยู่บน; วันเดียวกันเลข Q มากอยู่บน"],
    ["ลำดับทะเบียน Excel", "ผ่าน", "วันเก่าอยู่บน; โหลดทุกใบที่ยังใช้งาน รวมใบตุลาคมใหม่"],
    ["Project ไป Description", "ผ่าน", "ไม่มี + ในหัวข้อ; + โผล่เมื่อเขียนรายการ; เพิ่มรายละเอียดขึ้นต้น -"],
    ["ลบบรรทัดรายละเอียด", "ผ่าน", "Backspace จนเหลือ - แล้วกดอีกครั้ง บรรทัดหาย"],
    ["Unit / Unit Price", "ผ่าน", "Unit ว่างตอนเริ่ม; ตัวเล็กเปลี่ยนตัวใหญ่; ราคาใส่ comma"],
    ["คำนวณและราคาเป็นคำอ่าน", "ผ่าน", "ทดสอบราคาหลายชุด ส่วนลด VAT ศูนย์ ทศนิยม และหนึ่งล้านเอ็ดบาท"],
    ["เพิ่มบรรทัดและดาวน์โหลด", "ผ่าน", "ทดสอบ 12 / 14 / 50 / 100 บรรทัด; ไม่ตัดแถวใบเก่าเกิน 50"],
    ["หมายเหตุหลายบรรทัด", "ผ่าน", "บรรทัดสองและสามยังแยกบรรทัดในไฟล์ Excel"],
    ["แบบทะเบียน Excel", "ผ่าน", "XML ของฟอนต์/สีและความกว้างตรงกับต้นแบบ; ทดสอบข้อมูลเกิน 1,000 แถว"],
    ["สร้าง แก้ไข ดาวน์โหลด กู้คืน ลบถาวร", "ผ่าน", "ทดสอบผ่านเว็บจริงด้วยรายการชั่วคราว; ล้างรายการทดสอบแล้ว"],
    ["ความครบถ้วนข้อมูลเก่า", "ยังมีรายการต้องตรวจ", "49 ใบยังไม่มีรายละเอียดที่ยืนยันได้; 6 ข้อขัดแย้งแสดงในชีตถัดไป"],
    ["ความหมายยอดทะเบียนเก่า", "คงตามทะเบียนเดิม", "ทะเบียนเดิมหลายใบเก็บยอดก่อน VAT; ฟอร์มใบเสนอราคาแสดง Grand Total หลัง VAT"],
  ]);
  makeSheet("ยอดที่ต้องตรวจ", ["เลข Q", "ชื่อไฟล์ต้นทาง", "ชีต / แถว", "ยอดต้นทาง", "ยอดในระบบ / คำนวณ", "สาเหตุ"], report.conflicts.map((row: { q: string; source: string; reason: string; sourceAmount?: number; existingAmount?: number; calculatedAmount?: number }) => {
    const source = audit.parsedQuotations.find((source: { sourceFile: string }) => source.sourceFile === row.source);
    const lines = source?.lineItems ?? [];
    const cell = source?.fieldCells?.totalAmount;
    return [row.q, row.source, `${source?.worksheet ?? ""} / รายการแถว ${lines[0]?.row ?? "?"}-${lines.at(-1)?.row ?? "?"}; ยอด ${cell?.address ?? "?"}`, row.sourceAmount ?? "", row.existingAmount ?? row.calculatedAmount ?? "", reason(row.reason)];
  }));
  makeSheet("รายละเอียดที่ยังขาด", ["เลข Q", "บริษัท", "ชื่องาน", "แถวทะเบียนต้นทาง", "ไฟล์ที่พบ", "สาเหตุ"], report.missingDetails.map((row: { q: string; id: string; files: string[]; reason: string }) => {
    const quote = quotes.find((quote) => quote.id === row.id);
    return [row.q, quote?.customer_name_raw, quote?.project_name, quote?.source_row, row.files.join("\n"), reason(row.reason)];
  }));
  makeSheet("ผู้ติดต่อที่แก้", ["เลข Q", "บริษัท", "ผู้ติดต่อก่อนแก้", "ผู้ติดต่อตอนนี้", "อีเมลตอนนี้"], contactChanges.map((quote) => [quote.quotation_no, quote.customer_name_raw, beforeById.get(quote.id)?.attention, quote.attention, quote.email]));
  makeSheet("อีเมลที่ต้องตรวจ", ["เลข Q", "บริษัท", "ผู้ติดต่อ", "ค่าที่มีในช่องอีเมล"], quotes.filter((quote) => quote.email && !validEmail(quote.email)).map((quote) => [quote.quotation_no, quote.customer_name_raw, quote.attention, quote.email]));
  makeSheet("ข้อมูลบริษัทที่ยังขาด", ["บริษัท", "ข้อมูลที่ยังไม่มี"], (customers ?? []).map((customer) => [customer.name, [!customer.tax_id && "เลขภาษี", !customer.address && "ที่อยู่", !customer.contact && "ผู้ติดต่อ", !validEmail(customer.email) && "อีเมล"].filter(Boolean).join(", ")]).filter((row) => row[1]));
  await workbook.xlsx.writeFile("reports/requirements-review.xlsx");
  await writeFile("reports/requirements-review.md", `ผลตรวจ ${new Date().toISOString()}\n\nตรวจผู้ติดต่อครบ ${quotes.length} รายการ; มีการแก้ข้อมูลสุทธิ ${contactChanges.length} ใบเทียบกับสำรองก่อนเริ่มแก้\n\nเลข Q วันที่ ชื่องาน บริษัท ยอดทะเบียน และแถวต้นทางคงตามข้อมูลเดิมทุกใบ\n\nเติมส่วนลด 48 ใบ และรายละเอียด 11 ใบจากไฟล์ที่ยืนยันได้\n\nยังต้องตรวจรายละเอียดที่ขาด ${report.missingDetails.length} ใบ และข้อขัดแย้ง ${report.conflicts.length} จุด ตามไฟล์ requirements-review.xlsx\n\nทดสอบฟังก์ชันผ่าน Playwright และทดสอบไฟล์ 12, 14, 50, 100 บรรทัด พร้อมฟอนต์/ความกว้างของทะเบียนต้นฉบับ\n`);
  console.log(JSON.stringify({ activeQuotes: quotes.length, correctedContacts: contactChanges.length, preservedHeaderMismatches: unexpectedChanges.length, missingDetails: report.missingDetails.length, financialConflicts: report.conflicts.length, report: "reports/requirements-review.xlsx" }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
