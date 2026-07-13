import { expect, test } from "@playwright/test";

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
  await page.goto("/login?site-add-qa=1");
  await page.getByRole("button", { name: "Use This Device Only (No Cloud)" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  await page.goto("/sites/");
  await page.getByRole("button", { name: "Add Site" }).click();
  await page.getByLabel("Site Name").fill("Kondhwa Test Site");
  await page.getByRole("button", { name: "Save Entry" }).click();

  await expect(page.getByText("Kondhwa Test Site")).toBeVisible();
  await page.goto("/bill-scanner/");
  await expect(page.getByRole("heading", { name: "Bill Scanner" })).toBeVisible();
  await expect(page.locator("select option", { hasText: "Kondhwa Test Site" })).toHaveCount(1);
});
