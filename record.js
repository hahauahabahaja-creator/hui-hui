const puppeteer = require('puppeteer');

const meetUrl = process.argv[2];

if (!meetUrl) {
    console.error("❌ Error: Meeting URL is missing!");
    process.exit(1);
}

(async () => {
    console.log("🚀 Starting Headless Browser with Real Profile...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        userDataDir: '/tmp/chrome_profile/meet_profile', // Real Profile Path
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
            '--disable-dev-shm-usage' // 🔥 CPU/RAM optimized
        ],
        ignoreDefaultArgs: ['--mute-audio']
    });

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 5000));
    console.log("📸 Taking Pre-Join Screenshot...");
    await page.screenshot({ path: '1_before_join.png' });

    try {
        console.log("⏳ Clicking 'Join Now'...");
        const joined = await page.evaluate(() => {
            let buttons = [...document.querySelectorAll('button')];
            let joinBtn = buttons.find(b => 
                (b.innerText && b.innerText.includes('Join now')) || 
                (b.innerText && b.innerText.includes('Ask to join'))
            );
            if (joinBtn) {
                joinBtn.click();
                return true;
            }
            return false;
        });

        if (joined) console.log("✅ Join clicked successfully!");
        else console.log("⚠️ Could not find Join button, might be inside already.");
    } catch (error) {
        console.log("⚠️ Error clicking Join button.");
    }

    await new Promise(r => setTimeout(r, 5000));
    console.log("📸 Taking Post-Join Screenshot...");
    await page.screenshot({ path: '2_after_join.png' });

    console.log("🎥 Bot is sitting in the meeting... Waiting for Stop Command.");
    await new Promise(() => {}); 
})();
