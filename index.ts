import { chromium } from "playwright";

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL!;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD!;

async function main() {
  const browser = await chromium.launch({ headless: false }); // visible browser
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to LinkedIn login
  await page.goto("https://www.linkedin.com/login");

  // Fill login form
  await page.fill("input#username", LINKEDIN_EMAIL);
  await page.fill("input#password", LINKEDIN_PASSWORD);
  await page.click('button[type="submit"]');

  // ✅ Wait for feed to show up instead of waiting for URL
  await page.waitForSelector("div.feed-identity-module", { timeout: 60000 });
  console.log("✅ Logged in!");

  // Go to connections page
  await page.goto(
    "https://www.linkedin.com/mynetwork/invite-connect/connections/",
  );

  // Wait for connections list to load
  await page.waitForSelector("ul.mn-connection-list", { timeout: 60000 });

  // Grab connection names
  const names = await page.$$eval("span.mn-connection-card__name", (els) =>
    els.map((e) => e.textContent?.trim()).filter(Boolean),
  );

  console.log("Connections:");
  names.forEach((name, i) => console.log(`${i + 1}. ${name}`));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

