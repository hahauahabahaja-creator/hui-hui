const puppeteer = require('puppeteer');

const meetUrl = process.argv[2];

if (!meetUrl) {
    console.error("❌ Error: Meeting URL is missing!");
    process.exit(1);
}

(async () => {
    console.log("🚀 Starting Headless Browser...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser', // GitHub action se install hoga
        headless: false, // Xvfb virtual screen ke liye false rakhna zaroori hai
        defaultViewport: null, 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--start-maximized',
            '--use-fake-ui-for-media-stream', // Auto-allow mic/cam prompts
            '--use-fake-device-for-media-stream', // No real mic/cam needed
            '--disable-infobars',
            '--autoplay-policy=no-user-gesture-required' // Allow audio to play auto
        ],
        ignoreDefaultArgs: ['--mute-audio'] // Ensure audio is unmuted!
    });

    const page = await browser.newPage();
    
    // Auto-allow permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    try {
        console.log("⏳ Waiting for page load to enter name...");
        // Google Meet guest login ke liye "Name" input box ka wait karna
        await page.waitForSelector('input[type="text"]', { timeout: 15000 });
        await page.type('input[type="text"]', 'Recording Bot');
        
        // Enter daba kar "Ask to join" / "Join" kar dena
        await page.keyboard.press('Enter');
        console.log("✅ Name entered and join requested!");
    } catch (error) {
        console.log("⚠️ No name input found (Might be already in meeting or different UI).");
    }

    console.log("🎥 Bot is sitting in the meeting. Waiting for FFmpeg to record...");
    // Script ko infinite chalu rakhna jab tak GitHub Action usko band na kare
    await new Promise(() => {}); 
})();
