import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import ExcelJS from "exceljs";

dotenv.config({ path: ".env.local" });
test.use({ viewport: { width: 1600, height: 1000 }, launchOptions: { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } });
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";

test("quotation workflow, remembered contact/email, export, restore and permanent deletion", async ({ page, request }) => {
  test.setTimeout(180000);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const marker = `REQUIREMENT-TEST-${Date.now()}`;
  let createdId: string | undefined;
  let customerId: string | undefined;
  page.on("pageerror", (error) => { throw error; });
  try {
    await page.goto(`${base}/quotations/new`);
    const form = page.locator("form");
    await expect(form.locator('[name="payment_term"]')).toHaveValue("");
    await expect(form.locator('[name="payment_term"]')).not.toHaveAttribute("placeholder", /.+/);
    await expect(form.locator('[name="boq_no"]')).not.toHaveAttribute("placeholder", /.+/);
    await expect(form.getByText("Revision (R)")).toHaveCount(0);
    const rows = form.locator("table").first().locator("tbody tr");
    await expect(rows).toHaveCount(12);
    await expect(rows.nth(0).getByRole("button", { name: "เพิ่มรายละเอียดใต้บรรทัดนี้" })).toHaveCount(0);
    await expect(rows.nth(1).getByRole("button", { name: "เพิ่มรายละเอียดใต้บรรทัดนี้" })).toHaveCount(0);
    await expect(rows.nth(1).locator("input").nth(2)).toHaveValue("");
    await expect(rows.nth(1).locator("input").nth(2)).not.toHaveAttribute("placeholder", /.+/);

    await form.locator('[name="customer_name"]').fill("MAYEKAWA (THAILAND)CO.,LTD");
    await expect(form.locator('[name="customer_address"]')).not.toHaveValue("");
    await expect(form.locator('[name="customer_tax_id"]')).not.toHaveValue("");
    for (const [name, email] of [["คุณธราดล", "tharadon@mth.co.th"], ["คุณวศิตา", "wasita@mth.co.th"], ["คุณกริช", "grit@mth.co.th"]]) {
      await form.locator('[name="attention"]').fill(name);
      await expect(form.locator('[name="email"]')).toHaveValue(email);
    }
    await form.locator('[name="email"]').fill("override@example.test");
    await form.locator('[name="project_name"]').fill("Project sync test");
    await expect(rows.nth(0).locator("textarea")).toHaveValue("Project sync test");
    await expect(form.locator('[name="email"]')).toHaveValue("override@example.test");
    await form.locator('[name="quotation_date"]').fill("01/09/2569");
    const next = await (await request.get(`${base}/api/quotations/next-number?date=01%2F09%2F2569`)).json();
    await expect(form.locator('[name="quotation_no"]')).toHaveValue(next.quotationNo);
    await form.locator('[name="quotation_no"]').fill("6909001r2");
    await form.locator('[name="quotation_date"]').fill("01/10/2569");
    await expect(form.locator('[name="quotation_no"]')).toHaveValue("6909001r2");

    await form.locator('[name="customer_name"]').fill(marker);
    await expect(form.locator('[name="attention"]')).toHaveValue("");
    await expect(form.locator('[name="email"]')).toHaveValue("");
    await form.locator('[name="customer_address"]').fill("Test address\nBangkok");
    await form.locator('[name="customer_tax_id"]').fill("1234567890123");
    await form.locator('[name="attention"]').fill(`${marker} person`);
    await form.locator('[name="email"]').fill("test-person@example.test");
    await form.locator('[name="quotation_date"]').fill("01/01/2588");
    await form.locator('[name="quotation_no"]').fill(`8801${String(Date.now() % 1000).padStart(3, "0")}r99`);
    await form.locator('[name="project_name"]').fill(marker);
    await form.locator('[name="payment_term"]').fill("เครดิต 60 วัน");
    await form.locator('[name="boq_no"]').fill("8801001");
    await form.locator('[name="po"]').fill("PO-TEST");
    await rows.nth(1).locator("textarea").fill("Product one");
    await rows.nth(1).getByRole("button", { name: "เพิ่มรายละเอียดใต้บรรทัดนี้" }).click();
    await expect(rows.nth(2).locator("textarea")).toHaveValue("- ");
    await expect(rows.nth(2).locator("textarea")).toHaveAttribute("placeholder", "รายละเอียดเพิ่มเติมของรายการ");
    await rows.nth(2).locator("textarea").press("Backspace");
    await expect(rows).toHaveCount(12);
    await rows.nth(1).locator("input").nth(0).fill("36500");
    await rows.nth(1).locator("input").nth(1).fill("1");
    await expect(rows.nth(1).locator("input").nth(0)).toHaveValue("36,500.00");
    await rows.nth(1).locator("input").nth(2).fill("set");
    await expect(rows.nth(1).locator("input").nth(2)).toHaveValue("SET");
    await rows.nth(2).locator("textarea").fill("Product two");
    await rows.nth(2).locator("input").nth(0).fill("875.75");
    await rows.nth(2).locator("input").nth(1).fill("3.125");
    await rows.nth(2).getByRole("button", { name: "เพิ่มรายละเอียดใต้บรรทัดนี้" }).click();
    await rows.nth(3).locator("textarea").fill("- Details belonging to product two");
    await form.locator("#remarks").fill("Note first line\nPayment second line\nThird line");
    await form.getByRole("button", { name: "+ เพิ่มรายการ", exact: true }).click();
    await expect(rows).toHaveCount(14);
    await form.getByRole("textbox", { name: "VAT percentage" }).fill("7.5");
    await expect(form.locator('[name="total_amount"]')).toHaveValue("42179.47");
    await form.getByRole("button", { name: "บันทึกใบเสนอราคา", exact: true }).click();
    await expect(page).toHaveURL(/\/quotations$/);

    const { data: quote, error } = await supabase.from("quotations").select("id,quotation_no,customer_id,attention,email,total_amount,quotation_line_items(*)").eq("project_name", marker).single();
    expect(error).toBeNull();
    expect(quote).not.toBeNull();
    createdId = quote!.id; customerId = quote!.customer_id;
    expect(Number(quote!.total_amount)).toBe(42179.47);
    expect(quote!.attention).toBe(`${marker} person`);
    expect(quote!.email).toBe("test-person@example.test");
    expect(quote!.quotation_line_items).toHaveLength(4);

    const download = await request.get(`${base}/api/quotations/${createdId}/excel`);
    expect(download.status()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await download.body() as never);
    const sheet = workbook.getWorksheet("Quotation")!;
    expect((sheet.getCell("G34").value as { result: number }).result).toBe(42179.47);
    expect(sheet.getCell("C14").text).toBe(`${marker} person`);
    expect(sheet.getCell("B31").text).toBe("Payment second line\nThird line");

    await page.goto(`${base}/quotations/new`);
    await form.locator('[name="customer_name"]').fill(marker);
    await expect(form.locator('[name="customer_tax_id"]')).toHaveValue("1234567890123");
    await expect(form.locator('[name="attention"]')).toHaveValue(`${marker} person`);
    await expect(form.locator('[name="email"]')).toHaveValue("test-person@example.test");
    await form.locator('[name="attention"]').fill("Temporary unknown name");
    await expect(form.locator('[name="email"]')).toHaveValue("");
    await form.locator('[name="attention"]').fill(`${marker} person`);
    await expect(form.locator('[name="email"]')).toHaveValue("test-person@example.test");
    await form.locator('[name="quotation_no"]').fill(quote!.quotation_no);
    await form.locator('[name="project_name"]').fill(`${marker} duplicate attempt`);
    await form.getByRole("button", { name: "บันทึกใบเสนอราคา", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("เลขใบเสนอราคานี้มีอยู่แล้ว");
    const { count: duplicateCount } = await supabase.from("quotations").select("id", { count: "exact", head: true }).eq("quotation_no", quote!.quotation_no);
    expect(duplicateCount).toBe(1);

    await page.goto(`${base}/quotations?search=${encodeURIComponent(marker)}`);
    await page.getByRole("button", { name: `แก้ไขใบเสนอราคา ${quote!.quotation_no}` }).click();
    const dialog = page.getByRole("dialog");
    const editRows = dialog.locator("table").first().locator("tbody tr");
    await editRows.nth(1).locator("input").nth(0).fill("500");
    await dialog.locator('[name="email"]').fill("edited-person@example.test");
    await dialog.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const updatedFile = await request.get(`${base}/api/quotations/${createdId}/excel`);
    const updatedWorkbook = new ExcelJS.Workbook();
    await updatedWorkbook.xlsx.load(await updatedFile.body() as never);
    expect((updatedWorkbook.getWorksheet("Quotation")!.getCell("G34").value as { result: number }).result).toBe(3479.47);
    await page.goto(`${base}/quotations/new`);
    await form.locator('[name="customer_name"]').fill(marker);
    await expect(form.locator('[name="email"]')).toHaveValue("edited-person@example.test");
    await form.locator('[name="attention"]').fill("Unknown contact");
    await form.locator('[name="attention"]').fill(`${marker} person`);
    await expect(form.locator('[name="email"]')).toHaveValue("edited-person@example.test");

    await page.goto(`${base}/quotations?search=${encodeURIComponent(marker)}`);
    await page.getByTitle("ลบใบเสนอราคา", { exact: true }).click();
    await page.getByRole("button", { name: "ลบใบเสนอราคา", exact: true }).last().click();
    await expect.poll(async () => (await supabase.from("quotations").select("deleted_at").eq("id", createdId!).single()).data?.deleted_at).not.toBeNull();
    await page.goto(`${base}/trash`);
    const trashRow = page.locator("tr").filter({ hasText: marker });
    await trashRow.getByRole("button", { name: "กู้คืน", exact: true }).click();
    await expect.poll(async () => (await supabase.from("quotations").select("deleted_at").eq("id", createdId!).single()).data?.deleted_at).toBeNull();
    await page.goto(`${base}/quotations?search=${encodeURIComponent(marker)}`);
    await page.getByTitle("ลบใบเสนอราคา", { exact: true }).click();
    await page.getByRole("button", { name: "ลบใบเสนอราคา", exact: true }).last().click();
    await expect.poll(async () => (await supabase.from("quotations").select("deleted_at").eq("id", createdId!).single()).data?.deleted_at).not.toBeNull();
    await page.goto(`${base}/trash`);
    await trashRow.getByRole("button", { name: "ลบถาวร", exact: true }).click();
    await page.getByRole("button", { name: "ลบถาวร", exact: true }).last().click();
    await expect.poll(async () => (await supabase.from("quotations").select("id").eq("id", createdId!).maybeSingle()).data).toBeNull();
  } finally {
    // Only disposable records created by this test may be cleaned up.
    const { data: testQuotes } = await supabase.from("quotations").select("id,customer_id").like("project_name", `${marker}%`).eq("customer_name_raw", marker);
    for (const row of testQuotes ?? []) {
      customerId ??= row.customer_id;
      await supabase.from("quotations").delete().eq("id", row.id).eq("customer_name_raw", marker);
    }
    if (customerId) await supabase.from("customers").delete().eq("id", customerId).eq("name", marker);
    else await supabase.from("customers").delete().eq("name", marker);
  }
});

test("list order, searches, report routes and unfiltered register export", async ({ page, request }) => {
  test.setTimeout(90000);
  await page.goto(`${base}/quotations?year=2569&month=9`);
  const list = await page.locator("tbody tr").evaluateAll((rows) => rows.map((row) => {
    const cells = row.querySelectorAll("td"); return { date: cells[0]?.textContent?.trim() ?? "", q: cells[1]?.textContent?.trim() ?? "" };
  }));
  expect(list.length).toBeGreaterThan(1);
  for (let i = 1; i < list.length; i++) {
    const iso = (date: string) => date.split("/").reverse().join("-");
    expect(iso(list[i - 1].date) >= iso(list[i].date)).toBeTruthy();
    if (list[i - 1].date === list[i].date) expect(list[i - 1].q >= list[i].q).toBeTruthy();
  }
  await page.goto(`${base}/quotations?search=6909034`);
  await expect(page.locator("tbody").first()).toContainText("คุณธราดล");
  for (const route of ["/", "/reports/monthly", "/reports/monthly/2569", "/reports/monthly/2569/10", "/reports/yearly", "/reports/yearly/2569", "/trash"]) {
    const response = await request.get(`${base}${route}`);
    expect(response.status(), route).toBe(200);
  }
  const response = await request.get(`${base}/api/quotations/export`);
  expect(response.status()).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.body() as never);
  const register = workbook.worksheets[0];
  expect(register.rowCount).toBeGreaterThan(1500);
  const firstDatedRow = Array.from({ length: register.rowCount - 1 }, (_, i) => i + 2).find((row) => register.getCell(row, 1).text)!;
  expect(register.getCell(firstDatedRow, 1).text).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  expect(typeof register.getCell("F2").value).toBe("number");
  const qs = Array.from({ length: register.rowCount - 1 }, (_, i) => register.getCell(i + 2, 2).text);
  expect(qs.some((q) => q.includes("6910018"))).toBeTruthy();
  expect(register.getCell(firstDatedRow, 1).text.slice(-4) <= register.getCell(`A${register.rowCount}`).text.slice(-4)).toBeTruthy();
  const dates = Array.from({ length: register.rowCount - 1 }, (_, i) => register.getCell(i + 2, 1).text)
    .filter(Boolean).map((date) => date.split("/").reverse().join("-"));
  for (let index = 1; index < dates.length; index++) expect(dates[index] >= dates[index - 1]).toBeTruthy();
});
