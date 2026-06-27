import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 }
] as const;

for (const viewport of VIEWPORTS) {
  test(`landing remains stable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /create private room/i })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("two clients can enter the same room", async ({ browser, request }) => {
  const roomResponse = await request.post("http://127.0.0.1:2567/rooms", { data: {} });
  expect(roomResponse.ok()).toBeTruthy();
  const { code } = await roomResponse.json() as { code: string };

  const first = await browser.newContext();
  const second = await browser.newContext();
  const firstPage = await first.newPage();
  const secondPage = await second.newPage();

  await firstPage.addInitScript(() => {
    localStorage.setItem("congcard:nickname", "Playwright One");
    localStorage.setItem("congcard:avatar", "sun");
  });
  await secondPage.addInitScript(() => {
    localStorage.setItem("congcard:nickname", "Playwright Two");
    localStorage.setItem("congcard:avatar", "moon");
  });

  await Promise.all([firstPage.goto(`/room/${code}`), secondPage.goto(`/room/${code}`)]);
  await expect(firstPage.getByText("Playwright Two")).toBeVisible({ timeout: 15_000 });
  await expect(secondPage.getByText("Playwright One")).toBeVisible({ timeout: 15_000 });

  await first.close();
  await second.close();
});
