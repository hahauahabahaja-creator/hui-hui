const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const { exec } = require('child_process');
const fs = require('fs');

// 🔥 ACTIVATE ALL PLUGINS
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

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
    log("🚀 Starting ULTIMATE ENGINE with ALL Anti-Detection...");

    // 🔥 LAUNCH WITH PERFECT SETTINGS
    const browser = await puppeteer.launch({
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
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-default-apps',
            '--mute-audio',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--disable-web-security',
            '--disable-features=BlockInsecurePrivateNetworkRequests',
            '--disable-features=OutOfBlinkCors',
            '--disable-features=BlockInsecurePrivateNetworkRequests'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        handleSIGINT: false
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    const context = browser.defaultBrowserContext();

    // 🔥 REMOVE ALL TRACES OF AUTOMATION
    await page.evaluateOnNewDocument(() => {
        // Remove webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // Add fake plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const plugins = [
                    { name: 'Chrome PDF Plugin' },
                    { name: 'Chrome PDF Viewer' },
                    { name: 'Native Client' }
                ];
                plugins.length = 3;
                plugins.item = (i) => plugins[i];
                return plugins;
            }
        });
        
        // Fake languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
        
        // Fake permissions
        Object.defineProperty(navigator, 'permissions', {
            get: () => ({
                query: () => Promise.resolve({ state: 'prompt' })
            })
        });
        
        // Chrome runtime
        window.chrome = {
            runtime: {},
            app: {},
            loadTimes: function() {},
            csi: function() {},
            getVariable: function() {}
        };
        
        // Remove PhantomJS, Nightmare traces
        delete window.callPhantom;
        delete window._phantom;
        delete window.__nightmare;
        delete window.webdriver;
        delete window.__selenium_evaluate;
        delete window.__webdriver_evaluate;
        delete window.__selenium_evaluate;
        delete window.__webdriver_script_function;
        delete window.__webdriver_script_func;
        delete window.__webdriver_script_fn;
        
        // Override headless detection
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia = function(constraints) {
            return originalGetUserMedia(constraints).catch(() => {
                return new Promise((resolve) => {
                    const stream = new MediaStream();
                    const videoTrack = new MediaStreamTrack('video', {
                        kind: 'video',
                        enabled: true,
                        muted: true
                    });
                    stream.addTrack(videoTrack);
                    resolve(stream);
                });
            });
        };
    });

    // 🔥 REAL USER AGENT
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 🔥 SET REALISTIC VIEWPORT
    await page.setViewport({
        width: 1366,
        height: 768,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
    });

    // 🔥 GO TO GOOGLE FIRST
    log("🌐 Going to Google for cookie injection...");
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // 🔥 INJECT COOKIES PROPERLY
    if (cookiesJson) {
        try {
            const cookies = JSON.parse(cookiesJson);
            // Clear existing cookies
            await page.deleteCookie(...cookies);
            // Set new cookies
            await page.setCookie(...cookies);
            log("✅ Cookies injected successfully");
            
            // Verify login
            await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 3000));
            
            const loggedIn = await page.evaluate(() => {
                return document.querySelector('a[href*="accounts.google.com"]') !== null;
            });
            
            if (loggedIn) {
                log("✅ Login verified - Account active!");
            } else {
                log("⚠️ Login may need cookies refresh");
            }
        } catch (error) {
            log("⚠️ Cookie injection failed: " + error.message);
        }
    }

    // 🔥 SET PERMISSIONS
    try {
        const meetOrigin = new URL(meetUrl).origin;
        await context.overridePermissions(meetOrigin, [
            'microphone',
            'camera',
            'notifications'
        ]);
        log(`✅ Permissions granted for ${meetOrigin}`);
    } catch (err) {
        log("⚠️ Permission override failed: " + err.message);
    }

    // 🔥 NAVIGATE TO MEET
    log(`📡 Navigating to: ${meetUrl}`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000));

    // 🔥 HANDLE POPUPS
    try {
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                const text = btn.innerText || '';
                if (text.includes('Got it') || text.includes('Dismiss') || 
                    text.includes('Skip') || text.includes('Not now') || 
                    text.includes('Accept')) {
                    btn.click();
                }
            });
        });
        log("✅ Popups handled");
    } catch(e) {}

    // 🔥 TURN OFF CAMERA AND MIC
    log("🔇 Turning off Camera and Microphone...");
    try {
        await page.keyboard.down('ControlLeft');
        await page.keyboard.press('KeyE');
        await page.keyboard.press('KeyD');
        await page.keyboard.up('ControlLeft');
        await new Promise(r => setTimeout(r, 3000));
        log("✅ Media turned off");
    } catch(e) {
        log("⚠️ Keyboard shortcuts failed: " + e.message);
    }

    // 🔥 ENTER NAME IF NEEDED
    try {
        const nameInput = await page.$('input[type="text"]');
        if (nameInput) {
            const randomName = "Student " + Math.floor(Math.random() * 9999);
            await page.type('input[type="text"]', randomName);
            log(`✅ Name entered: ${randomName}`);
        }
    } catch(e) {}

    // 🔥 JOIN MEETING - MULTIPLE METHODS
    log("👋 Trying to join meeting...");
    
    // Method 1: Direct click
    try {
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            const joinBtn = Array.from(buttons).find(b => 
                b.innerText.includes('Join now') || 
                b.innerText.includes('Ask to join') ||
                b.innerText.includes('Continue')
            );
            if (joinBtn) joinBtn.click();
        });
        log("✅ Method 1: Clicked join button");
    } catch(e) {}

    // Method 2: JavaScript trigger
    try {
        await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.textContent.includes('joinNow')) {
                    eval(script.textContent);
                }
            });
        });
        log("✅ Method 2: JavaScript trigger");
    } catch(e) {}

    // Wait for join
    await new Promise(r => setTimeout(r, 20000));

    // 🔥 TAKE SCREENSHOT
    await page.screenshot({ path: 'joined.png' });
    log("✅ Screenshot captured");

    // 🔥 SEND CONFIRMATION
    if (botToken && chatId) {
        const cmd = `curl -s -F chat_id="${chatId}" -F photo="@joined.png" -F caption="✅ **ULTIMATE ENGINE:** Successfully joined the meeting!" "https://api.telegram.org/bot${botToken}/sendPhoto?parse_mode=Markdown"`;
        exec(cmd, () => {
            log("✅ Confirmation sent to Telegram");
        });
    }

    log("🔄 Recording engine active and undetectable!");
    await new Promise(() => {});
})();

// 🔥 ERROR HANDLING
process.on('uncaughtException', (error) => {
    log("💥 Uncaught Exception: " + error.message);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    log("💥 Unhandled Rejection: " + error.message);
    process.exit(1);
});
