const puppeteer = require('puppeteer');
const { exec } = require('child_process');

let meetUrl = process.argv[2];
const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const cookiesJson = process.env.GOOGLE_COOKIES; // Extracted from GitHub Secrets

if (!meetUrl) {
    console.error("❌ Error: Meeting URL is missing!");
    process.exit(1);
}

// Auto-fix URL if http/https is missing
if (!meetUrl.startsWith('http://') && !meetUrl.startsWith('https://')) {
    meetUrl = 'https://' + meetUrl;
}

(async () => {
    console.log("🚀 Starting Supreme Engine (Cookie Injection Method)...");
    
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        defaultViewport: null, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--window-size=1280,720',
            '--start-maximized', 
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream', 
            '--disable-infobars',
            '--autoplay-policy=no-user-gesture-required', 
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ],
        ignoreDefaultArgs: ['--enable-automation', '--mute-audio'] 
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    const context = browser.defaultBrowserContext();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

    // 🔥 THE MAGIC: Injecting Cookies
    if (cookiesJson) {
        try {
            const cookies = JSON.parse(cookiesJson);
            await page.setCookie(...cookies);
            console.log("🍪 Cookies Injected Successfully! Bot is now recognized as a Real User.");
        } catch (error) {
            console.log("⚠️ Failed to parse cookies from environment variable.");
        }
    } else {
        console.log("⚠️ No GOOGLE_COOKIES found in environment. Joining as Guest.");
    }

    try {
        const meetOrigin = new URL(meetUrl).origin; 
        await context.overridePermissions(meetOrigin, ['microphone', 'camera', 'notifications']);
    } catch (err) {}

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 6000));
    
    // Auto-Dismiss Popups
    try {
        await page.evaluate(() => {
            let dismissBtns = [...document.querySelectorAll('button')].filter(b => b.innerText.includes('Got it') || b.innerText.includes('Dismiss'));
            dismissBtns.forEach(btn => btn.click());
        });
    } catch(e) {}

    await page.screenshot({ path: '1_before_join.png' });

    // Fallback: Type Name if Cookies are invalid/expired
    try {
        const nameInputSelector = 'input[type="text"], input[aria-label="Your name"], input[placeholder="Your name"]';
        const nameInput = await page.$(nameInputSelector);
        if (nameInput) {
            console.log("⚠️ Cookies invalid or rejected. Entering Guest Name...");
            await page.type(nameInputSelector, "Student " + Math.floor(Math.random() * 9999), { delay: 100 });
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch(e) {}

    // Click Join / Ask to Join
    try {
        console.log("⏳ Clicking 'Join Now'...");
        const joined = await page.evaluate(() => {
            let buttons = [...document.querySelectorAll('button')];
            let joinBtn = buttons.find(b => 
                (b.innerText && b.innerText.includes('Join now')) || 
                (b.innerText && b.innerText.includes('Ask to join'))
            );
            if (joinBtn) { joinBtn.click(); return true; }
            return false;
        });
        
        if (joined) console.log("✅ Join button clicked!");
    } catch (error) { 
        console.log("⚠️ Error clicking Join button:", error); 
    }

    await new Promise(r => setTimeout(r, 10000)); 
    console.log("📸 Taking Post-Join Screenshot & Sending to Telegram...");
    await page.screenshot({ path: '2_after_join.png' });

    if (botToken && chatId) {
        let cmd = `curl -s -F chat_id="${chatId}" -F photo="@2_after_join.png" -F caption="✅ Status: Entered the Matrix!" "https://api.telegram.org/bot${botToken}/sendPhoto"`;
        exec(cmd, (err) => {});
    }

    console.log("🎥 Engine Locked. Awaiting commands...");
    await new Promise(() => {}); 
})();
