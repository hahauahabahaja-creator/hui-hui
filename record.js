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
    console.log("🚀 Starting Headless Browser with Real Profile...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        userDataDir: '/tmp/chrome_profile/meet_profile',
        defaultViewport: null, 
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720',
            '--start-maximized', '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream', '--disable-infobars',
            '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'
        ],
        ignoreDefaultArgs: ['--mute-audio']
    });

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '1_before_join.png' });

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
        if (joined) console.log("✅ Join clicked successfully!");
    } catch (error) { console.log("⚠️ Error clicking Join button."); }

    await new Promise(r => setTimeout(r, 5000)); // Wait for enter
    console.log("📸 Taking Post-Join Screenshot & Sending to Telegram...");
    await page.screenshot({ path: '2_after_join.png' });

    // 🔥 JAISE HI JOIN HOGA, TURANT PHOTO BHEJEGA!
    if (botToken && chatId) {
        let cmd = `curl -s -F chat_id="${chatId}" -F photo="@2_after_join.png" -F caption="✅ Bot Meeting mein ghus gaya hai!" "https://api.telegram.org/bot${botToken}/sendPhoto"`;
        exec(cmd, (err) => { if(!err) console.log("🚀 Live Photo Sent!"); });
    }

    console.log("🎥 Bot is sitting in the meeting... Waiting for Stop/View/Full Commands.");
    await new Promise(() => {}); 
})();
