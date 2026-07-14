import { expect, test } from "@playwright/test";

async function loginDeviceOnly(page: import("@playwright/test").Page, marker: string) {
  await page.goto(`/login?${marker}=1`);
  await page.getByRole("button", { name: "Use This Device Only (No Cloud)" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

async function openAddSheet(page: import("@playwright/test").Page, path: string, buttonName: string) {
  await page.goto(path);
  const addButton = page.getByRole("button", { name: buttonName });
  await expect(addButton).toBeVisible();
  await addButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectFirstOption(dialog: import("@playwright/test").Locator, fieldName: string) {
  const select = dialog.locator(`select[name="${fieldName}"]`);
  await expect(select).toBeVisible();
  await select.selectOption({ index: 1 });
}

async function saveAndExpect(page: import("@playwright/test").Page, dialog: import("@playwright/test").Locator, text: string) {
  await dialog.getByRole("button", { name: "Save Entry" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(text).first()).toBeVisible();
}

test("mobile app shell opens login and offline dashboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Contractor OS")).toBeVisible();
  await page.getByRole("button", { name: "Use This Device Only (No Cloud)" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByTestId("ask-ai-button")).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
  await page.getByRole("button", { name: "Open Cloud Sync status" }).click();
  await expect(page.locator("#supabase-sync")).toBeVisible();
  await expect(page.getByRole("button", { name: /Bill Scanner/i }).first()).toBeVisible();
});

test("power screens stay usable on iPhone width", async ({ page }) => {
  await page.goto("/login?mobile-power-qa=1");
  await page.getByRole("button", { name: "Use This Device Only (No Cloud)" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  const routes = [
    { path: "/business-brain/", text: "AI Business Brain" },
    { path: "/cash-flow/", text: "Cash Flow Forecast" },
    { path: "/approval-center/", text: "Approval Center" },
    { path: "/bill-scanner/", text: "Bill Scanner" }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByText(route.text).first()).toBeVisible();
    await expect(page.getByTestId("quick-add-button")).toHaveCount(0);
    if (route.path === "/bill-scanner/") {
      await expect(page.getByTestId("ask-ai-button")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Capture Photo" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Browse Image" })).toBeVisible();
      await expect(page.getByRole("button", { name: "AI Scan" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Local Scan" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add Row" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Save Selected Items" })).toBeVisible();
    } else {
      await expect(page.getByTestId("ask-ai-button")).toBeVisible();
    }
    const hasNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(hasNoHorizontalOverflow).toBeTruthy();
  }
});

test("site add flow keeps new site visible and available in scanner dropdown", async ({ page }) => {
  await loginDeviceOnly(page, "site-add-qa");

  await page.goto("/sites/");
  await page.getByRole("button", { name: "Add Site" }).click();
  await page.getByLabel("Site Name").fill("Kondhwa Test Site");
  await page.getByRole("button", { name: "Save Entry" }).click();

  await expect(page.getByText("Kondhwa Test Site")).toBeVisible();
  await page.goto("/bill-scanner/");
  await expect(page.getByRole("heading", { name: "Bill Scanner" })).toBeVisible();
  await expect(page.locator("select option", { hasText: "Kondhwa Test Site" })).toHaveCount(1);
});

test("site cards include a working delete site option", async ({ page }) => {
  await loginDeviceOnly(page, "site-delete-qa");
  const suffix = Date.now().toString().slice(-6);
  const siteName = `Delete Site QA ${suffix}`;

  const dialog = await openAddSheet(page, "/sites/", "Add Site");
  await dialog.getByLabel("Site Name").fill(siteName);
  await dialog.getByLabel("Client Name").fill(`Delete Client ${suffix}`);
  await saveAndExpect(page, dialog, siteName);

  page.once("dialog", async (confirmDialog) => {
    expect(confirmDialog.message()).toContain("Delete this site");
    await confirmDialog.accept();
  });
  const siteCard = page.locator('[class*="__record"]').filter({ hasText: siteName });
  await expect(siteCard).toHaveCount(1);
  await siteCard.getByRole("button", { name: "Delete Site" }).click();
  await expect(page.getByText("Site deleted")).toBeVisible();
  await expect(page.getByText(siteName)).toHaveCount(0);

  await page.goto("/bill-scanner/");
  await expect(page.locator("select option", { hasText: siteName })).toHaveCount(0);
});

test("long client names stay readable on iPhone site cards", async ({ page }) => {
  await loginDeviceOnly(page, "client-name-layout-qa");
  const suffix = Date.now().toString().slice(-6);
  const siteName = `Client Layout ${suffix}`;
  const clientName = `ClientNameWithVeryLongContinuousText${suffix}AndExtraWordsForMobileWrapping`;

  const dialog = await openAddSheet(page, "/sites/", "Add Site");
  await dialog.getByLabel("Site Name").fill(siteName);
  await dialog.getByLabel("Client Name").fill(clientName);
  await dialog.getByLabel("Budget").fill("999999999");
  await saveAndExpect(page, dialog, siteName);

  const layout = await page.evaluate((name) => {
    const card = [...document.querySelectorAll('[class*="record"]')].find((element) => element.textContent?.includes(name));
    const subtitle = card?.querySelector("p");
    const amount = card?.querySelector('[class*="amount"]');
    const subtitleRect = subtitle?.getBoundingClientRect();
    const amountRect = amount?.getBoundingClientRect();
    return {
      hasCard: Boolean(card),
      hasClientName: Boolean(card?.textContent?.includes("ClientNameWithVeryLongContinuousText")),
      subtitleRight: subtitleRect?.right ?? 0,
      amountLeft: amountRect?.left ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  }, siteName);

  expect(layout.hasCard).toBeTruthy();
  expect(layout.hasClientName).toBeTruthy();
  expect(layout.subtitleRight).toBeLessThanOrEqual(layout.amountLeft - 4);
  expect(layout.overflow).toBeLessThanOrEqual(2);
});

test("core business entry screens save data one by one on iPhone", async ({ page }) => {
  test.setTimeout(120000);
  await loginDeviceOnly(page, "entry-matrix-qa");
  const suffix = Date.now().toString().slice(-6);
  const siteName = `QA Site ${suffix}`;
  const supplierName = `QA Supplier ${suffix}`;
  const labourName = `QA Labour ${suffix}`;

  let dialog = await openAddSheet(page, "/sites/", "Add Site");
  await dialog.getByLabel("Site Name").fill(siteName);
  await dialog.getByLabel("Client Name").fill(`QA Client ${suffix}`);
  await dialog.getByLabel("Budget").fill("125000");
  await saveAndExpect(page, dialog, siteName);

  dialog = await openAddSheet(page, "/suppliers/", "Add Supplier");
  await dialog.getByLabel("Supplier Name").fill(supplierName);
  await dialog.getByLabel("Mobile Number").fill("9876543210");
  await saveAndExpect(page, dialog, supplierName);

  dialog = await openAddSheet(page, "/labour/", "Add Labour");
  await dialog.getByLabel("Labour Name").fill(labourName);
  await dialog.getByLabel("Work Type").fill("Mason");
  await dialog.getByLabel("Default Daily Wage").fill("800");
  await selectFirstOption(dialog, "site_id");
  await saveAndExpect(page, dialog, labourName);

  dialog = await openAddSheet(page, "/attendance/", "Mark Attendance");
  await selectFirstOption(dialog, "site_id");
  await selectFirstOption(dialog, "labour_id");
  await dialog.getByLabel("Daily Wage").fill("800");
  await saveAndExpect(page, dialog, labourName);

  dialog = await openAddSheet(page, "/materials/", "Add Material");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Material Name").fill(`QA Cement ${suffix}`);
  await dialog.getByLabel("Quantity").fill("10");
  await dialog.getByLabel("Rate").fill("360");
  await dialog.getByLabel("Bill Number").fill(`BILL-${suffix}`);
  await saveAndExpect(page, dialog, `QA Cement ${suffix}`);

  dialog = await openAddSheet(page, "/expenses/", "Add Expense");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Amount").fill("450");
  await dialog.getByLabel("Notes").fill(`QA tea expense ${suffix}`);
  await saveAndExpect(page, dialog, "misc");

  dialog = await openAddSheet(page, "/payments/", "Add Client Payment");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Contract Amount").fill("125000");
  await dialog.getByLabel("Received Amount").fill("25000");
  await dialog.getByLabel("Notes").fill(`QA payment ${suffix}`);
  await saveAndExpect(page, dialog, `QA Client ${suffix}`);

  dialog = await openAddSheet(page, "/supplier-payments/", "Add Supplier Payment");
  await selectFirstOption(dialog, "supplier_id");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Paid Amount").fill("5000");
  await dialog.getByLabel("Pending Amount").fill("1500");
  await dialog.getByLabel("Bill Reference").fill(`BILL-${suffix}`);
  await saveAndExpect(page, dialog, supplierName);

  dialog = await openAddSheet(page, "/progress/", "Add Progress");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Progress Title").fill(`QA Plaster ${suffix}`);
  await dialog.getByLabel("Description").fill("Completed test plaster wall");
  await dialog.getByLabel("Progress %").fill("30");
  await saveAndExpect(page, dialog, `QA Plaster ${suffix}`);

  dialog = await openAddSheet(page, "/extra-works/", "Add Extra Work");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Work Description").fill(`QA extra waterproofing ${suffix}`);
  await dialog.getByLabel("Quantity").fill("50");
  await dialog.getByLabel("Rate").fill("75");
  await saveAndExpect(page, dialog, `QA extra waterproofing ${suffix}`);

  dialog = await openAddSheet(page, "/reminders/", "Add Reminder");
  await selectFirstOption(dialog, "site_id");
  await dialog.getByLabel("Reminder Title").fill(`QA follow up ${suffix}`);
  await saveAndExpect(page, dialog, `QA follow up ${suffix}`);

  dialog = await openAddSheet(page, "/partner-draws/", "Add Partner Draw");
  await dialog.getByLabel("Partner Name").fill(`QA Partner ${suffix}`);
  await dialog.getByLabel("Amount Taken").fill("1000");
  await saveAndExpect(page, dialog, `QA Partner ${suffix}`);

  dialog = await openAddSheet(page, "/staff/", "Add Staff");
  await dialog.getByLabel("Full Name").fill(`QA Staff ${suffix}`);
  await dialog.getByLabel("Email").fill(`qa-${suffix}@example.com`);
  await saveAndExpect(page, dialog, `QA Staff ${suffix}`);

  const hasNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  expect(hasNoHorizontalOverflow).toBeTruthy();
});

test("bill scanner manual rows save into materials on iPhone", async ({ page }) => {
  test.setTimeout(90000);
  await loginDeviceOnly(page, "bill-scanner-save-qa");
  const suffix = Date.now().toString().slice(-6);
  const siteName = `Scanner Site ${suffix}`;
  const itemName = `Scanner Cement ${suffix}`;

  let dialog = await openAddSheet(page, "/sites/", "Add Site");
  await dialog.getByLabel("Site Name").fill(siteName);
  await dialog.getByLabel("Client Name").fill(`Scanner Client ${suffix}`);
  await saveAndExpect(page, dialog, siteName);

  await page.goto("/bill-scanner/");
  await expect(page.getByRole("heading", { name: "Bill Scanner" })).toBeVisible();
  await page.getByRole("button", { name: "Add Row" }).click();
  await page.getByPlaceholder("Item description").fill(itemName);
  await page.getByPlaceholder("Qty").fill("12");
  const rateInputs = page.getByPlaceholder("Rate");
  await expect(rateInputs).toHaveCount(2);
  await rateInputs.first().fill("365");
  const amountInputs = page.getByPlaceholder("Amount");
  await expect(amountInputs).toHaveValue("4380");
  const siteSelect = page.locator("select").filter({ has: page.locator("option", { hasText: siteName }) });
  await expect(siteSelect).toHaveCount(1);
  await siteSelect.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save Selected Items" }).click();
  await expect(page.getByText("1 material items saved from bill")).toBeVisible();

  await page.goto("/materials/");
  await expect(page.getByText(itemName).first()).toBeVisible();
});
