const puppeteer = require('puppeteer');

const meetUrl = process.argv[2];

if (!meetUrl) {
    console.error("❌ Error: Meeting URL is missing!");
    process.exit(1);
}

(async () => {
    console.log("🚀 Starting Headless Browser...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        // Profile hata di hai, ab bot ekdum fast naya browser kholega
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
    
    await new Promise(r => setTimeout(r, 5000));
    console.log("📸 Taking Pre-Join Screenshot...");
    await page.screenshot({ path: '1_before_join.png' });

    try {
        console.log("📝 Checking for Guest Name input...");
        
        // Agar naam likhne ka dabba aaye, toh usme naam daalo
        const nameInput = await page.$('input[type="text"]');
        if (nameInput) {
            console.log("⌨️ Typing bot name...");
            await nameInput.type("Secure Cloud Bot");
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("⏳ Clicking 'Join Now' or 'Ask to Join'...");
        await page.evaluate(() => {
            let buttons = [...document.querySelectorAll('button')];
            let joinBtn = buttons.find(b => 
                (b.innerText && b.innerText.includes('Ask to join')) || 
                (b.innerText && b.innerText.includes('Join now'))
            );
            if (joinBtn) joinBtn.click();
        });
        console.log("✅ Join request sent!");

    } catch (error) {
        console.log("⚠️ Auto-join logic error or UI changed.");
    }

    await new Promise(r => setTimeout(r, 5000));
    console.log("📸 Taking Post-Join Screenshot...");
    await page.screenshot({ path: '2_after_join.png' });

    console.log("🎥 Bot is sitting in the meeting. Waiting for FFmpeg to finish recording...");
    await new Promise(() => {}); 
})();
