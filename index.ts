
import { chromium } from "playwright";

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL!;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD!;
const MESSAGE = "Hey, I’m exploring new opportunities — let me know if your team is hiring or could refer me";

function randomDelay(min: number, max: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto("https://www.linkedin.com/login");
  await page.fill("input#username", LINKEDIN_EMAIL);
  await page.fill("input#password", LINKEDIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector("div.feed-identity-module", { timeout: 60000 });
  console.log("✅ Logged in!");

  // Go to connections page
  await page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/");
  await page.waitForSelector("ul.mn-connection-list", { timeout: 60000 });

  // Get connection profile links
  const connections = await page.$$eval(
    "a.mn-connection-card__link",
    (els) =>
      els.map((e) => ({
  name: e.querySelector("span.mn-connection-card__name")?.textContent?.trim() || "",
  url: e.getAttribute('href') || "",
      }))
  );

  // Save connections to a file
  const fs = await import('fs/promises');
  await fs.writeFile('connections.json', JSON.stringify(connections, null, 2));
  console.log(`Saved ${connections.length} connections to connections.json`);

  // Message each connection
  for (const [i, conn] of connections.entries()) {
    console.log(`Messaging ${conn.name} (${conn.url})...`);
    try {
      const connPage = await context.newPage();
      await connPage.goto(conn.url);
      await connPage.waitForSelector('button[aria-label^="Message"],button[aria-label^="Send message"]', { timeout: 30000 });
      await connPage.click('button[aria-label^="Message"],button[aria-label^="Send message"]');
      await connPage.waitForSelector('div.msg-form__contenteditable', { timeout: 30000 });
      await connPage.fill('div.msg-form__contenteditable', MESSAGE);
      await randomDelay(500, 1500); // Simulate typing
      await connPage.click('button.msg-form__send-button');
      console.log(`✅ Messaged ${conn.name}`);
      await connPage.close();
      // Throttle between messages
      await randomDelay(10000, 40000);
    } catch (err) {
      console.error(`❌ Failed to message ${conn.name}:`, err);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

