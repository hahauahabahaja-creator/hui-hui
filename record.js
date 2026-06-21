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
    console.log("🚀 Starting Browser with Real Gmail Profile...");
    
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        userDataDir: '/tmp/chrome_profile/meet_profile', // 🔥 Using the real profile
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

    // Latest footprint taaki browser block na ho
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    console.log(`🌐 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: '1_before_join.png' });

    try {
        console.log("⏳ Clicking 'Join Now' / 'Ask to Join'...");
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
        else console.log("⚠️ Could not find Join button.");
    } catch (error) { 
        console.log("⚠️ Error clicking Join button."); 
    }

    await new Promise(r => setTimeout(r, 10000)); 
    console.log("📸 Taking Post-Join Screenshot & Sending to Telegram...");
    await page.screenshot({ path: '2_after_join.png' });

    if (botToken && chatId) {
        let cmd = `curl -s -F chat_id="${chatId}" -F photo="@2_after_join.png" -F caption="✅ Bot Meeting me entry maar chuka hai (via Profile)!" "https://api.telegram.org/bot${botToken}/sendPhoto"`;
        exec(cmd, (err) => { if(!err) console.log("🚀 Live Photo Sent!"); });
    }

    console.log("🎥 Bot is waiting in the meeting...");
    await new Promise(() => {}); 
})();
