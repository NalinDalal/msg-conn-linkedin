# msg-conn-linkedin

a bot in bun that basically logs in my linkedin, then reaches out to connected people for job

To install dependencies:

```bash
bun install
```

To run the basic version (connections listing only):

```bash
bun run index.ts
# or with Node.js
node index.ts
```

To run the full automation script:

```bash
# Set required environment variables
export LINKEDIN_EMAIL="your-email@example.com"
export LINKEDIN_PASSWORD="your-password"

# Optional: Enable debug mode (runs in visible browser mode)
export DEBUG_MODE="true"

# Run the full automation
bun run final.ts
# or with Node.js  
node final.ts
```

## Scripts

### `index.ts` - Basic version:
- Logs into LinkedIn
- Opens your connections list  
- Iterates and **prints names** (no messaging yet)

### `final.ts` - Full automation:
- Robust LinkedIn login with multiple selector fallbacks
- Scrapes connection names AND profile URLs
- Saves complete connection data to `connections.json`
- Visits each connection's profile 
- Sends personalized messages with the template below
- Throttles messages (10-40s random delays)
- Screenshots on login failures for debugging
- Supports visible browser mode (`DEBUG_MODE=true`)

## Message Template

The script uses this message template (automatically personalized with each connection's name):

> Hi [Name], I hope you're doing well! I'm currently exploring new opportunities in software engineering and wanted to reach out. If you're aware of any openings at your company, or could point me in the right direction, I'd really appreciate it. Happy to share my github.com/nalindalal . Thanks a lot in advance!

## Environment Variables

- `LINKEDIN_EMAIL` - Your LinkedIn email (required)
- `LINKEDIN_PASSWORD` - Your LinkedIn password (required)  
- `DEBUG_MODE` - Set to "true" to run in visible browser mode for debugging (optional)

## Features

- Messaging 1st-degree connections is **allowed** by LinkedIn (no restriction like cold outreach).
- Less risk of account restriction if you pace it naturally.

The basic flow would be:

1. **Login / session setup**
   - Either log in with username/password (automated form fill), or save your LinkedIn cookies locally and load them in Playwright so you don't keep logging in.

2. **Go to "My Network → Connections"**
   - URL: `https://www.linkedin.com/mynetwork/invite-connect/connections/`
   - This page lists all your connections.

3. **Iterate through connections**
   - For each person, open their profile.
   - Click **Message**.
   - Paste a custom message (e.g. "Hey, I'm exploring new opportunities — let me know if your team is hiring or could refer me").

4. **Throttle**
   - Add **random delays** (10–40s between messages, random timing simulation) so LinkedIn doesn't flag you.

5. **Optional filters**
   - You could restrict it (e.g., only connections in the U.S., or only with job titles containing "recruiter / hiring manager / engineer").