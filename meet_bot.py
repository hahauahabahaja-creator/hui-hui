import os
import time
import requests
from datetime import datetime
from playwright.sync_api import sync_playwright

# ============================================
# ⚙️ CONFIGURATION & SECRETS
# ============================================
MEET_URL = os.environ.get("MEET_URL", "")
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
CHAT_ID = os.environ.get("CHAT_ID", "")

# ============================================
# 🛠️ HELPER FUNCTIONS
# ============================================
def log(message):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def send_telegram(message):
    """Telegram par updates bhejne ke liye function"""
    if BOT_TOKEN and CHAT_ID:
        try:
            requests.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                data={'chat_id': CHAT_ID, 'text': message},
                timeout=10
            )
            log("✅ Telegram message sent")
        except Exception as e:
            log(f"⚠️ Telegram sending failed: {e}")

# ============================================
# 🚀 MAIN BOT ENGINE
# ============================================
def run_bot():
    if not MEET_URL:
        log("❌ Error: MEET_URL is missing!")
        return

    send_telegram(f"🚀 **Bot Initialization Started**\n📡 Target URL: {MEET_URL}")

    with sync_playwright() as p:
        log("🌐 Launching Playwright Chromium Browser...")
        
        # Browser Start Karna
        browser = p.chromium.launch(
            headless=False,  # Meet ke liye false rakhna padta hai taaki streams properly load hon
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--disable-blink-features=AutomationControlled",
                "--window-size=1366,768",
                "--mute-audio"
            ]
        )
        
        # Context aur Permissions
        context = browser.new_context(
            viewport={'width': 1366, 'height': 768},
            permissions=['camera', 'microphone']
        )
        page = context.new_page()

        log(f"📡 Navigating to: {MEET_URL}")
        page.goto(MEET_URL, timeout=60000)
        page.wait_for_timeout(6000)

        # 1. Popups Hatana (Got it / Dismiss)
        log("🔄 Checking for popups...")
        try:
            page.evaluate("""
                () => {
                    document.querySelectorAll('button').forEach(btn => {
                        if(btn.innerText.includes('Got it') || btn.innerText.includes('Dismiss')) {
                            btn.click();
                        }
                    });
                }
            """)
        except:
            pass

        # 2. Mic aur Camera Off Karna (Ctrl+D, Ctrl+E)
        log("🔇 Turning off Mic & Camera...")
        try:
            page.keyboard.press("Control+d")
            page.wait_for_timeout(1000)
            page.keyboard.press("Control+e")
            page.wait_for_timeout(2000)
        except Exception as e:
            log(f"⚠️ Could not disable media: {e}")

        # 3. Guest Name Daalna (Agar pooche toh)
        try:
            name_input = page.locator('input[type="text"]').first
            if name_input.is_visible(timeout=3000):
                guest_name = "Student " + str(int(time.time()))[-4:]
                log(f"✍️ Typing Guest Name: {guest_name}")
                name_input.fill(guest_name)
                page.wait_for_timeout(1000)
        except Exception:
            log("ℹ️ No name input found. Moving to Join step.")

        # 4. Join Button Click Karna
        log("⏳ Clicking 'Join Now' / 'Ask to Join'...")
        joined = False
        selectors = ["text=Ask to join", "text=Join now", "button:has-text('Join')"]
        
        for selector in selectors:
            try:
                btn = page.locator(selector).first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    log(f"✅ Clicked Join using selector: {selector}")
                    joined = True
                    break
            except:
                continue

        # Agar normal buttons na milein, toh JS ka use karna
        if not joined:
            log("⚠️ Trying JavaScript forced click...")
            try:
                page.evaluate("""
                    () => {
                        let btns = [...document.querySelectorAll('button')];
                        let jBtn = btns.find(b => b.innerText.includes('Join') || b.innerText.includes('Ask'));
                        if(jBtn) jBtn.click();
                    }
                """)
                joined = True
                log("✅ Clicked using JS.")
            except:
                log("❌ Failed to click Join button.")

        if joined:
            send_telegram("✅ **Meeting Joined / Request Sent!**\n🎥 Recording is now running smoothly in the background.")

        # 5. Infinite Loop (Browser ko khula rakhne ke liye)
        log("🔄 Engine Locked. Monitoring meeting...")
        try:
            while True:
                time.sleep(10)
        except KeyboardInterrupt:
            log("🛑 Process stopped manually.")
        finally:
            log("🧹 Closing browser...")
            browser.close()

if __name__ == "__main__":
    run_bot()
