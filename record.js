const puppeteer = require('puppeteer');

const meetUrl = process.argv[2];

if (!meetUrl) {
    console.error("❌ Error: Meeting URL is missing!");
    process.exit(1);
}

(async () => {
    console.log("🚀 Starting Headless Browser with Secure Profile...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        userDataDir: '/tmp/chrome_profile', // 🔥 Humari secure profile
        defaultViewport: null, 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--start-maximized',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--disable-infobars',
            '--autoplay-policy=no-user-gesture-required'
        ],
        ignoreDefaultArgs: ['--mute-audio']
    });

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    try {
        console.log("⏳ Checking if we need to click 'Join Now'...");
        await page.waitForSelector('button', { timeout: 15000 });
        
        const joined = await page.evaluate(() => {
            let buttons = [...document.querySelectorAll('button')];
            let joinBtn = buttons.find(b => 
                b.innerText.includes('Join now') || 
                b.innerText.includes('Ask to join')
            );
            
            if (joinBtn) {
                joinBtn.click();
                return true;
            }
            return false;
        });

        if (joined) {
            console.log("✅ Join button clicked successfully!");
        } else {
            console.log("⚠️ Could not find Join button, might be already inside the meeting.");
        }
        
    } catch (error) {
        console.log("⚠️ Error clicking Join button or UI changed.");
    }

    console.log("🎥 Bot is sitting in the meeting. Waiting for FFmpeg to finish recording...");
    await new Promise(() => {}); 
})();
