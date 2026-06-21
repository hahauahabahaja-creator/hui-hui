const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const fs = require('fs');

let meetUrl = process.argv[2];
const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const cookiesJson = process.env.GOOGLE_COOKIES; 

if (!meetUrl) process.exit(1);
if (!meetUrl.startsWith('http://') && !meetUrl.startsWith('https://')) {
    meetUrl = 'https://' + meetUrl;
}

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    fs.appendFileSync('recording.log', `[${timestamp}] ${message}\n`);
}

(async () => {
    log("🚀 Starting Supreme Engine (No Cam/Mic Mode)...");
    
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        defaultViewport: null, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--window-size=1366,768',
            '--start-maximized', 
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream', 
            '--disable-infobars',
            '--autoplay-policy=no-user-gesture-required', 
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-default-apps',
            '--mute-audio'
        ],
        ignoreDefaultArgs: ['--enable-automation', '--mute-audio'],
        handleSIGINT: false
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    const context = browser.defaultBrowserContext();

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
        window.chrome = { runtime: {} };
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

    // 🔥 FIX: First go to Google domain so cookies attach properly
    log("🌐 Preparing Google domain for cookie injection...");
    await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2', timeout: 60000 });

    if (cookiesJson) {
        try {
            const cookies = JSON.parse(cookiesJson);
            await page.setCookie(...cookies);
            log("✅ Cookies injected into Google Domain");
            
            // 🔥 FIX: Reload page to verify login
            await page.reload({ waitUntil: 'networkidle2' });
            log("🔄 Account verification complete");
        } catch (error) {
            log("⚠️ Could not parse cookies: " + error.message);
        }
    }

    try {
        const meetOrigin = new URL(meetUrl).origin; 
        await context.overridePermissions(meetOrigin, ['microphone', 'camera', 'notifications']);
        log(`✅ Permissions overridden for ${meetOrigin}`);
    } catch (err) {
        log("⚠️ Permission override failed: " + err.message);
    }

    log(`📡 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 8000));
    
    log("🔇 Disabling Camera and Microphone...");
    try {
        await page.focus('body');
        await page.keyboard.down('ControlLeft');
        await page.keyboard.press('KeyE');
        await page.keyboard.press('KeyD');
        await page.keyboard.up('ControlLeft');
        await new Promise(r => setTimeout(r, 3000));
        log("✅ Media shortcuts executed");
    } catch(e) {
        log("⚠️ Could not toggle media shortcuts: " + e.message);
    }

    try {
        await page.evaluate(() => {
            const dismissBtns = [...document.querySelectorAll('button')]
                .filter(b => {
                    const text = b.innerText || '';
                    return text.includes('Got it') || 
                           text.includes('Dismiss') || 
                           text.includes('Skip') || 
                           text.includes('Not now');
                });
            dismissBtns.forEach(btn => btn.click());
        });
        log("✅ Popups dismissed");
    } catch(e) {
        log("⚠️ Popup dismissal failed: " + e.message);
    }

    await page.screenshot({ path: '1_before_join.png' });
    log("📸 Before-join screenshot saved");

    try {
        const nameInputSelector = 'input[type="text"], input[aria-label="Your name"], input[placeholder="Your name"]';
        const nameInput = await page.$(nameInputSelector);
        if (nameInput) {
            const randomName = "Student " + Math.floor(Math.random() * 9999);
            await page.type(nameInputSelector, randomName, { delay: 100 });
            await new Promise(r => setTimeout(r, 1000));
            log(`✅ Name entered: ${randomName}`);
        }
    } catch(e) {
        log("⚠️ Name input failed: " + e.message);
    }

    try {
        const joined = await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('button')];
            const joinBtn = buttons.find(b => {
                const text = (b.innerText || '');
                return text.includes('Join now') || 
                       text.includes('Ask to join') ||
                       text.includes('Continue');
            });
            if (joinBtn) { 
                joinBtn.click(); 
                return true; 
            }
            return false;
        });
        
        if (joined) {
            log("✅ Join button clicked");
        } else {
            log("⚠️ Could not find join button");
        }
    } catch (error) {
        log("⚠️ Join click failed: " + error.message);
    }

    await new Promise(r => setTimeout(r, 15000)); 
    await page.screenshot({ path: '2_after_join.png' });
    log("✅ After-join screenshot saved");

    if (botToken && chatId) {
        const cmd = `curl -s -F chat_id="${chatId}" -F photo="@2_after_join.png" -F caption="✅ **Status:** Successfully connected to the meeting." "https://api.telegram.org/bot${botToken}/sendPhoto?parse_mode=Markdown"`;
        exec(cmd, (error) => {
            if (error) {
                log("⚠️ Failed to send confirmation screenshot: " + error.message);
            } else {
                log("✅ Confirmation screenshot sent");
            }
        });
    }

    log("🔄 Recording engine active...");
    await new Promise(() => {}); 
})();

process.on('uncaughtException', (error) => {
    log("💥 Uncaught Exception: " + error.message);
});

process.on('unhandledRejection', (error) => {
    log("💥 Unhandled Rejection: " + error.message);
});
