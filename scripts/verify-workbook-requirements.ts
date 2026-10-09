import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { buildQuotationWorkbook, buildQuotationRegisterWorkbook, type ExportQuotation } from "../src/lib/excel/workbooks";
import { findContactEmail } from "../src/lib/contact-options";
import { findLinkedCustomerProfile } from "../src/lib/customer-profile-links";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const scenarios = [
    { price: 36500, qty: 1, discount: 0, vat: .07, rows: 12, expected: 39055, bahtText: "สามหมื่นเก้าพันห้าสิบห้าบาทถ้วน" },
    { price: 1234.5, qty: 3, discount: 100, vat: .07, rows: 14, expected: 3855.745, bahtText: "สามพันแปดร้อยห้าสิบห้าบาทเจ็ดสิบห้าสตางค์" },
    { price: 82.75, qty: 2.5, discount: 10, vat: 0, rows: 50, expected: 196.875, bahtText: "หนึ่งร้อยเก้าสิบหกบาทแปดสิบแปดสตางค์" },
    { price: 0, qty: 1, discount: 0, vat: .07, rows: 13, expected: 0, bahtText: "ศูนย์บาทถ้วน" },
    { price: 1000001, qty: 1, discount: 0, vat: 0, rows: 100, expected: 1000001, bahtText: "หนึ่งล้านเอ็ดบาทถ้วน" },
  ];
  for (const scenario of scenarios) {
    const quote: ExportQuotation = {
      id: "fixture", quotation_no: "6910099r2", quotation_date: "2026-10-09", boq_no: "6910002",
      customer_name_raw: "Fixture customer", project_name: "Fixture project", total_amount: 99999999,
      po: null, payment_term: "เครดิต 60 วัน", attention: "Fixture contact", email: "fixture@example.test",
      remarks: "บรรทัดแรก\nบรรทัดที่สอง\nบรรทัดที่สาม", discount_amount: scenario.discount, vat_rate: scenario.vat,
      quotation_line_items: Array.from({ length: scenario.rows }, (_, index) => ({
        line_no: index + 1, description: index === 0 ? "Fixture project" : index === 1 ? "Product" : `- Detail ${index}`,
        show_item_number: index === 1, unit_price: index === 1 ? scenario.price : null,
        quantity: index === 1 ? scenario.qty : null, unit: index === 1 ? "set" : null,
      })),
    };
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await buildQuotationWorkbook(quote) as never);
    const sheet = workbook.getWorksheet("Quotation")!;
    const summary = 18 + scenario.rows;
    const value = (address: string) => {
      const cell = sheet.getCell(address);
      return cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value;
    };
    assert.equal(value("F11"), "Q6910099r2");
    assert.equal(value("F12"), "BOQ6910002");
    assert.equal(value("C14"), "Fixture contact");
    assert.equal(value("F19"), "SET");
    assert.equal(value(`D${summary}`), "Total");
    const expected = Math.round((scenario.expected + Number.EPSILON) * 100) / 100;
    assert.equal(value(`G${summary + 4}`), expected);
    assert.equal(value(`B${summary + 4}`), scenario.bahtText);
    assert.equal(value(`C${summary - 1}`), `- Detail ${scenario.rows - 1}`);
    assert.equal(value(`B${summary + 1}`), "บรรทัดที่สอง\nบรรทัดที่สาม");
    assert.ok(sheet.model.merges.includes(`B${summary + 4}:C${summary + 4}`));
    assert.ok(sheet.model.merges.includes(`E${summary + 8}:G${summary + 8}`));
    assert.equal(sheet.getCell("D19").numFmt.includes(","), true);
    console.log(`PASS workbook: ${scenario.rows} rows, ${scenario.price} x ${scenario.qty}, total ${expected}`);
  }

  const contacts = [
    { name: "คุณวศิตา", customerName: "MAYEKAWA (THAILAND) CO., LTD", email: "new@example.test" },
    { name: "คุณวศิตา", customerName: "MAYEKAWA (THAILAND)CO.,LTD", email: "old@example.test" },
    { name: "Same name", customerName: "Company A", email: "a@example.test" },
    { name: "Same name", customerName: "Company B", email: "b@example.test" },
  ];
  assert.equal(findContactEmail(contacts, " คุณวศิตา ", "บริษัท มาเยคาว่า (ประเทศไทย) จำกัด"), "new@example.test");
  assert.equal(findContactEmail(contacts, "Same name", "Company B"), "b@example.test");
  assert.equal(findContactEmail(contacts, "Same name", ""), undefined);
  assert.equal(findLinkedCustomerProfile([{ name: "MAYEKAWA (THAILAND)CO.,LTD", email: "a" }, { name: "MAYEKAWA (THAILAND) CO., LTD", email: "b" }], "MAYEKAWA (THAILAND) CO., LTD")?.email, "b");
  console.log("PASS contact email/company aliases and duplicate display names");

  const blankContactWorkbook = new ExcelJS.Workbook();
  await blankContactWorkbook.xlsx.load(await buildQuotationWorkbook({
    id: "blank-contact-fixture", quotation_no: "6910099", quotation_date: "2026-10-09", boq_no: null,
    customer_name_raw: "MAYEKAWA (THAILAND)CO.,LTD", project_name: "Blank fields fixture", total_amount: 12345,
    po: null, payment_term: null, attention: null, email: null, quotation_line_items: [],
  }) as never);
  const blankSheet = blankContactWorkbook.getWorksheet("Quotation")!;
  assert.equal(blankSheet.getCell("C14").text, "");
  assert.equal(blankSheet.getCell("F13").text, "");
  assert.equal(blankSheet.getCell("G34").result, 12345);
  console.log("PASS blank quotation contact/payment stay blank and existing total is preserved");

  const template = await JSZip.loadAsync(await readFile("templates/excel/quotation-register.xlsx"));
  const rows: ExportQuotation[] = Array.from({ length: 1005 }, (_, i) => ({
    id: `row-${i}`, quotation_no: `6910${String(i).padStart(3, "0")}`, quotation_date: "2026-10-09",
    boq_no: i % 2 ? "6910001" : null, customer_name_raw: `Company ${i}`, project_name: `Project ${i}`,
    total_amount: i * 1234.56, po: i % 2 ? `PO${i}` : null, payment_term: null, attention: `Contact ${i}`, email: `email${i}@example.test`,
  }));
  const exported = await JSZip.loadAsync(await buildQuotationRegisterWorkbook(rows));
  assert.equal(await exported.file("xl/styles.xml")!.async("string"), await template.file("xl/styles.xml")!.async("string"));
  const originalXml = await template.file("xl/worksheets/sheet1.xml")!.async("string");
  const exportXml = await exported.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.equal(exportXml.match(/<cols>[\s\S]*?<\/cols>/)?.[0], originalXml.match(/<cols>[\s\S]*?<\/cols>/)?.[0]);
  assert.equal((exportXml.match(/<row\b/g) ?? []).length, rows.length + 1);
  assert.match(exportXml, /09\/10\/2569/);
  assert.match(exportXml, /PO1003/);
  assert.match(exportXml, /Contact 1004/);
  console.log("PASS register: 1005 dynamic rows, dates/prices/PO, exact template fonts and widths");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
