import { chromium } from "playwright";
import { promises as fs } from 'fs';

// Environment variables for LinkedIn credentials
const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL!;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD!;

// Configuration
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const MIN_DELAY = 10000; // 10 seconds minimum delay between messages
const MAX_DELAY = 40000; // 40 seconds maximum delay between messages

// Message template from README
const MESSAGE_TEMPLATE = `Hi [Name], I hope you're doing well! I'm currently exploring new opportunities in software engineering and wanted to reach out. If you're aware of any openings at your company, or could point me in the right direction, I'd really appreciate it. Happy to share my github.com/nalindalal . Thanks a lot in advance!`;

interface Connection {
  name: string;
  profileUrl: string;
}

// Utility function for random delay
function getRandomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

// Utility function to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page: any, filename: string): Promise<void> {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
  } catch (error) {
    console.error(`Failed to take screenshot: ${error}`);
  }
}

async function robustLogin(page: any): Promise<boolean> {
  try {
    console.log("🔐 Attempting to log into LinkedIn...");
    
    // Go to LinkedIn login
    await page.goto("https://www.linkedin.com/login", { waitUntil: 'networkidle' });

    // Take screenshot before login attempt
    if (DEBUG_MODE) {
      await takeScreenshot(page, 'login-page.png');
    }

    // Fill login form with multiple selector attempts
    const usernameSelectors = ["input#username", "input[name='session_key']", "input[type='email']"];
    const passwordSelectors = ["input#password", "input[name='session_password']", "input[type='password']"];
    
    let usernameInput = null;
    let passwordInput = null;

    // Try to find username input
    for (const selector of usernameSelectors) {
      try {
        usernameInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (usernameInput) {
          console.log(`✅ Found username input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Username selector ${selector} not found`);
      }
    }

    // Try to find password input
    for (const selector of passwordSelectors) {
      try {
        passwordInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (passwordInput) {
          console.log(`✅ Found password input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Password selector ${selector} not found`);
      }
    }

    if (!usernameInput || !passwordInput) {
      console.error("❌ Could not find login form elements");
      await takeScreenshot(page, 'login-form-not-found.png');
      return false;
    }

    // Fill the form
    await page.fill("input#username", LINKEDIN_EMAIL);
    await page.fill("input#password", LINKEDIN_PASSWORD);
    
    // Try multiple submit button selectors
    const submitSelectors = ['button[type="submit"]', 'button[data-id="sign-in-form__submit-btn"]', '.login__form_action_container button'];
    
    let submitClicked = false;
    for (const selector of submitSelectors) {
      try {
        await page.click(selector);
        console.log(`✅ Clicked submit with selector: ${selector}`);
        submitClicked = true;
        break;
      } catch (e) {
        console.log(`❌ Submit selector ${selector} not found`);
      }
    }

    if (!submitClicked) {
      console.error("❌ Could not find submit button");
      await takeScreenshot(page, 'submit-button-not-found.png');
      return false;
    }

    // Wait for login to complete - try multiple indicators
    const loginSuccessSelectors = [
      "div.feed-identity-module",
      "nav.global-nav",
      "[data-test-global-nav]",
      ".global-nav__me"
    ];

    let loginSuccess = false;
    for (const selector of loginSuccessSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 30000 });
        console.log(`✅ Login success detected with selector: ${selector}`);
        loginSuccess = true;
        break;
      } catch (e) {
        console.log(`❌ Login indicator ${selector} not found`);
      }
    }

    if (!loginSuccess) {
      console.error("❌ Login failed - success indicators not found");
      await takeScreenshot(page, 'login-failed.png');
      return false;
    }

    // Check for additional verification or captcha
    const currentUrl = page.url();
    if (currentUrl.includes('challenge') || currentUrl.includes('checkpoint')) {
      console.error("❌ Login requires additional verification (captcha/2FA)");
      await takeScreenshot(page, 'login-verification-required.png');
      return false;
    }

    console.log("✅ Successfully logged into LinkedIn!");
    return true;

  } catch (error) {
    console.error(`❌ Login error: ${error}`);
    await takeScreenshot(page, 'login-error.png');
    return false;
  }
}

async function scrapeConnections(page: any): Promise<Connection[]> {
  console.log("🔍 Navigating to connections page...");
  
  // Go to connections page
  await page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", { 
    waitUntil: 'networkidle' 
  });

  // Wait for connections list to load with multiple selectors
  const connectionListSelectors = [
    "ul.mn-connection-list",
    ".mn-connections",
    "[data-test-connections-list]",
    ".artdeco-list"
  ];

  let connectionsListFound = false;
  for (const selector of connectionListSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 30000 });
      console.log(`✅ Connections list found with selector: ${selector}`);
      connectionsListFound = true;
      break;
    } catch (e) {
      console.log(`❌ Connections list selector ${selector} not found`);
    }
  }

  if (!connectionsListFound) {
    console.error("❌ Could not find connections list");
    await takeScreenshot(page, 'connections-list-not-found.png');
    return [];
  }

  console.log("🔍 Scraping connection names and profile URLs...");

  // Scroll to load more connections
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const scrollDelay = 2000;
      let totalHeight = 0;
      const distance = 100;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);

      // Fallback timeout
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 30000);
    });
  });

  // Try multiple selectors for connection cards
  const connectionSelectors = [
    ".mn-connection-card",
    ".connection-card",
    "[data-test-connection-list-item]"
  ];

  let connections: Connection[] = [];

  for (const selector of connectionSelectors) {
    try {
      connections = await page.$$eval(selector, (elements: Element[]) => {
        return elements.map((element) => {
          // Try to find name with multiple selectors
          const nameSelectors = [
            ".mn-connection-card__name",
            ".connection-card__name",
            ".actor-name",
            "[data-test-connection-name]"
          ];

          let name = "";
          for (const nameSelector of nameSelectors) {
            const nameElement = element.querySelector(nameSelector);
            if (nameElement && nameElement.textContent) {
              name = nameElement.textContent.trim();
              break;
            }
          }

          // Try to find profile URL
          const linkSelectors = [
            "a[href*='/in/']",
            ".mn-connection-card__link",
            ".connection-card__link"
          ];

          let profileUrl = "";
          for (const linkSelector of linkSelectors) {
            const linkElement = element.querySelector(linkSelector) as HTMLAnchorElement;
            if (linkElement && linkElement.href) {
              profileUrl = linkElement.href;
              break;
            }
          }

          return { name, profileUrl };
        }).filter(conn => conn.name && conn.profileUrl);
      });

      if (connections.length > 0) {
        console.log(`✅ Found ${connections.length} connections with selector: ${selector}`);
        break;
      }
    } catch (e) {
      console.log(`❌ Connection selector ${selector} failed: ${e}`);
    }
  }

  if (connections.length === 0) {
    console.error("❌ No connections found with any selector");
    await takeScreenshot(page, 'no-connections-found.png');
  }

  return connections;
}

async function sendMessage(page: any, connection: Connection): Promise<boolean> {
  try {
    console.log(`💬 Attempting to message ${connection.name}...`);

    // Navigate to the profile
    await page.goto(connection.profileUrl, { waitUntil: 'networkidle' });
    
    // Wait for profile to load
    await sleep(2000);

    // Try to find and click the Message button
    const messageButtonSelectors = [
      'button[aria-label*="Message"]',
      'button:has-text("Message")',
      '.pv-s-profile-actions button:has-text("Message")',
      '[data-test-message-button]'
    ];

    let messageButtonClicked = false;
    for (const selector of messageButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(`✅ Clicked message button with selector: ${selector}`);
        messageButtonClicked = true;
        break;
      } catch (e) {
        console.log(`❌ Message button selector ${selector} not found`);
      }
    }

    if (!messageButtonClicked) {
      console.log(`❌ Could not find message button for ${connection.name}`);
      return false;
    }

    // Wait for message dialog to open
    const messageDialogSelectors = [
      '.msg-form__contenteditable',
      '[data-test-message-compose]',
      '.msg-form__msg-content-container',
      'div[role="textbox"]'
    ];

    let messageDialog = null;
    for (const selector of messageDialogSelectors) {
      try {
        messageDialog = await page.waitForSelector(selector, { timeout: 10000 });
        if (messageDialog) {
          console.log(`✅ Message dialog found with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Message dialog selector ${selector} not found`);
      }
    }

    if (!messageDialog) {
      console.log(`❌ Could not find message dialog for ${connection.name}`);
      return false;
    }

    // Prepare personalized message
    const personalizedMessage = MESSAGE_TEMPLATE.replace('[Name]', connection.name);

    // Type the message with human-like delays
    await page.type(messageDialog, personalizedMessage, { delay: 50 });

    // Wait a moment before sending
    await sleep(1000);

    // Try to find and click send button
    const sendButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      '[data-test-send-button]',
      '.msg-form__send-button'
    ];

    let sendButtonClicked = false;
    for (const selector of sendButtonSelectors) {
      try {
        await page.click(selector, { timeout: 5000 });
        console.log(`✅ Message sent to ${connection.name}!`);
        sendButtonClicked = true;
        break;
      } catch (e) {
        console.log(`❌ Send button selector ${selector} not found`);
      }
    }

    if (!sendButtonClicked) {
      console.log(`❌ Could not find send button for ${connection.name}`);
      return false;
    }

    return true;

  } catch (error) {
    console.error(`❌ Error messaging ${connection.name}: ${error}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting LinkedIn connection messaging automation...");
  console.log(`🔧 Debug mode: ${DEBUG_MODE ? 'ON' : 'OFF'}`);

  // Validate environment variables
  if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD) {
    console.error("❌ Please set LINKEDIN_EMAIL and LINKEDIN_PASSWORD environment variables");
    process.exit(1);
  }

  const browser = await chromium.launch({ 
    headless: !DEBUG_MODE,  // Run in visible mode if DEBUG_MODE is true
    slowMo: DEBUG_MODE ? 1000 : 0  // Slow down actions in debug mode
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  const page = await context.newPage();

  try {
    // Step 1: Login to LinkedIn
    const loginSuccess = await robustLogin(page);
    if (!loginSuccess) {
      console.error("❌ Login failed. Exiting...");
      await browser.close();
      process.exit(1);
    }

    // Step 2: Scrape connections
    const connections = await scrapeConnections(page);
    
    if (connections.length === 0) {
      console.log("❌ No connections found. Exiting...");
      await browser.close();
      process.exit(1);
    }

    // Step 3: Save connections to JSON file
    await fs.writeFile('connections.json', JSON.stringify(connections, null, 2));
    console.log(`✅ Saved ${connections.length} connections to connections.json`);

    // Display connections
    console.log("\n📋 Found connections:");
    connections.forEach((conn, i) => {
      console.log(`${i + 1}. ${conn.name} - ${conn.profileUrl}`);
    });

    // Step 4: Send messages with throttling
    console.log(`\n📨 Starting to send messages to ${connections.length} connections...`);
    
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      console.log(`\n[${i + 1}/${connections.length}] Processing ${connection.name}...`);

      const messageSuccess = await sendMessage(page, connection);
      
      if (messageSuccess) {
        successCount++;
        console.log(`✅ Successfully messaged ${connection.name}`);
      } else {
        failureCount++;
        console.log(`❌ Failed to message ${connection.name}`);
      }

      // Throttle between messages (except for the last one)
      if (i < connections.length - 1) {
        const delay = getRandomDelay();
        console.log(`⏱️  Waiting ${delay / 1000}s before next message...`);
        await sleep(delay);
      }
    }

    // Final summary
    console.log(`\n🎉 Messaging completed!`);
    console.log(`✅ Successful messages: ${successCount}`);
    console.log(`❌ Failed messages: ${failureCount}`);
    console.log(`📊 Success rate: ${((successCount / connections.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error(`❌ Fatal error: ${error}`);
    await takeScreenshot(page, 'fatal-error.png');
  } finally {
    await browser.close();
  }
}

// Run the main function
main().catch((err) => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});