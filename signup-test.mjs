import { chromium } from 'playwright';

const BASE = 'https://knoswmba.parrytech.co';

// Wait for the new deployment to be live (poll until signup page loads)
console.log('Deployment is live, proceeding...');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture API response
const responses = [];
page.on('response', async (res) => {
  if (res.url().includes('/api/auth/signup')) {
    const body = await res.text().catch(() => '');
    responses.push({ status: res.status(), body });
  }
});

await page.goto(BASE + '/signup');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/signup-page.png' });
console.log('Signup page title:', await page.title());
console.log('Signup page URL:', page.url());

// Dump visible input fields for debugging
const inputs = await page.locator('input').all();
console.log('Inputs found:', inputs.length);
for (const inp of inputs) {
  const type = await inp.getAttribute('type');
  const name = await inp.getAttribute('name');
  const placeholder = await inp.getAttribute('placeholder');
  console.log(`  input type=${type} name=${name} placeholder=${placeholder}`);
}

const testEmail = `playwright-test-${Date.now()}@example.com`;
console.log('Test email:', testEmail);

await page.locator('input[placeholder="Your name"]').fill('Playwright Test');
await page.locator('input[type="email"]').fill(testEmail);
const passwordInputs = page.locator('input[type="password"]');
await passwordInputs.nth(0).fill('TestPassword123!');
await passwordInputs.nth(1).fill('TestPassword123!');

await page.screenshot({ path: '/tmp/signup-filled.png' });
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/signup-result.png' });

console.log('\nURL after submit:', page.url());
const bodyText = await page.locator('body').textContent();
console.log('Page text:', bodyText.substring(0, 800));

if (responses.length > 0) {
  console.log('\n=== /api/auth/signup Response ===');
  console.log('Status:', responses[0].status);
  try {
    const parsed = JSON.parse(responses[0].body);
    console.log('Body:', JSON.stringify(parsed, null, 2));
  } catch {
    console.log('Body (raw):', responses[0].body);
  }
} else {
  console.log('\nNo /api/auth/signup response intercepted');
}

await browser.close();
