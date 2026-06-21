const puppeteer = require('puppeteer');
const { exec } = require('child_process');

const meetUrl = process.argv[2];
const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;

if (!meetUrl) {
    console.error("❌ Error: Meeting URL is missing!");
    process.exit(1);
}

(async () => {
    console.log("🚀 Starting Advanced Stealth Browser (Incognito)...");
    
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
            '--incognito', // 🔥 Incognito Mode
            '--disable-blink-features=AutomationControlled' // 🔥 Anti-Bot Bypass
        ],
        // 🔥 Hides "Chrome is being controlled by automated software" banner
        ignoreDefaultArgs: ['--enable-automation', '--mute-audio'] 
    });

    // Create a fresh page in the incognito context
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    const context = browser.defaultBrowserContext();

    // 🔥 Fake User-Agent to look like a real Windows PC
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Override permissions so it doesn't ask for Mic/Camera popups
    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the UI to load
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: '1_before_join.png' });

    try {
        console.log("🕵️ Attempting Anonymous Guest Join...");
        
        // 1. Look for the Name Input Box
        const nameInputSelector = 'input[type="text"], input[aria-label="Your name"], input[placeholder="Your name"]';
        try {
            await page.waitForSelector(nameInputSelector, { timeout: 10000 });
            // Generate a random name to avoid suspicion
            const botName = "Student " + Math.floor(Math.random() * 9999);
            await page.type(nameInputSelector, botName, { delay: 150 }); // Typing like a human
            console.log(`✍️ Entered Guest Name: ${botName}`);
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.log("ℹ️ Name input not found. UI might be different or already skipped.");
        }

        // 2. Click Ask to Join / Join Now
        console.log("⏳ Clicking 'Ask to Join'...");
        const joined = await page.evaluate(() => {
            let buttons = [...document.querySelectorAll('button')];
            let joinBtn = buttons.find(b => 
                (b.innerText && b.innerText.includes('Ask to join')) || 
                (b.innerText && b.innerText.includes('Join now'))
            );
            if (joinBtn) { joinBtn.click(); return true; }
            return false;
        });
        
        if (joined) {
            console.log("✅ Join button clicked! Waiting in Lobby / Meeting...");
        } else {
            console.log("⚠️ Could not find Join button.");
        }
    } catch (error) { 
        console.log("⚠️ Error during join process:", error); 
    }

    // Wait 10 seconds to allow host to admit, or UI to transition
    await new Promise(r => setTimeout(r, 10000)); 
    console.log("📸 Taking Post-Join Screenshot & Sending to Telegram...");
    await page.screenshot({ path: '2_after_join.png' });

    // Send Live Photo to Telegram
    if (botToken && chatId) {
        let cmd = `curl -s -F chat_id="${chatId}" -F photo="@2_after_join.png" -F caption="✅ Bot Lobby ya Meeting me hai!\n\n⚠️ Agar 'Waiting for host' dikh raha hai, toh apne Meet me bot ko 'Admit' karo." "https://api.telegram.org/bot${botToken}/sendPhoto"`;
        exec(cmd, (err) => { if(!err) console.log("🚀 Live Photo Sent!"); });
    }

    console.log("🎥 Engine is fully armed and running. Waiting for Stop/View/Full Commands.");
    await new Promise(() => {}); // Keep alive loop
})();
