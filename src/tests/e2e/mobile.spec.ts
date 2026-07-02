import { expect, test } from "@playwright/test";

test("mobile app shell opens login and offline dashboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Contractor OS")).toBeVisible();
  await page.getByRole("button", { name: "Continue Offline" }).click();
  await expect(page.getByText("Home")).toBeVisible();
  await expect(page.getByText("Ask AI")).toBeVisible();
});
