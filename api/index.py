import os
import time
import requests
import threading
import telebot
from flask import Flask

# ==========================================
# ⚙️ SECRETS & CONFIGURATION
# ==========================================
# Render Dashboard se environment variables uthayega
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") 
GITHUB_TOKEN = os.environ.get("PAT_TOKEN")
# FIX: Ab yeh aapke Render variables se GITHUB_REPO fetch karega
REPO_NAME = os.environ.get("GITHUB_REPO") 
WORKFLOW_NAME = "record.yml" # Action file ka naam

# Sanity Check: Agar koi variable miss ho gaya Render me toh logs me bata dega
if not all([BOT_TOKEN, GITHUB_TOKEN, REPO_NAME]):
    print("⚠️ WARNING: Kuch Environment Variables gayab hain Render se!")

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# ==========================================
# 🛠️ HELPER FUNCTION: GITHUB VARIABLES UPDATE
# ==========================================
def update_github_variable(var_name, value):
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/variables/{var_name}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28" # FIX: Added API version for stability
    }
    res = requests.patch(url, json={"name": var_name, "value": str(value)}, headers=headers)
    
    if res.status_code != 204:
        print(f"❌ Error updating {var_name}: {res.text}")
    return res.status_code == 204

# ==========================================
# 🤖 TELEGRAM BOT COMMANDS
# ==========================================

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    text = ("🤖 **Secure Cloud Meet Bot v2.0**\n\n"
            "Commands:\n"
            "🚀 `/go <meet_link>` - Start Recording\n"
            "🛑 `/off` - Stop & Get Video\n"
            "📸 `/vew` - Live Class Screenshot\n"
            "📺 `/full` - Full Screen Mode")
    bot.reply_to(message, text, parse_mode="Markdown")

@bot.message_handler(commands=['go'])
def start_recording(message):
    try:
        meet_url = message.text.split()[1]
    except IndexError:
        bot.reply_to(message, "⚠️ Bhai link bhi toh de! Example: `/go https://meet.google.com/xyz`")
        return

    bot.reply_to(message, f"🚀 GitHub Engine start kar raha hu for:\n{meet_url}\n\nThoda wait karo, VIP entry le raha hu!")
    
    # Purane flags ko reset karna zaroori hai
    update_github_variable("STOP_FLAG", "0")
    update_github_variable("VIEW_FLAG", "0")
    update_github_variable("FULL_FLAG", "0")

    # GitHub Action trigger karna
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/workflows/{WORKFLOW_NAME}/dispatches"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    data = {
        "ref": "main",
        "inputs": {"meet_url": meet_url}
    }
    res = requests.post(url, json=data, headers=headers)
    
    if res.status_code == 204:
        bot.reply_to(message, "✅ Server ON! Bot thodi der mein meeting me Admit hoga aur screenshot bhejega.")
    else:
        bot.reply_to(message, f"❌ Error starting server: {res.text}")

@bot.message_handler(commands=['off'])
def stop_recording(message):
    bot.reply_to(message, "🛑 Stop command bhej diya! Recording save ho rahi hai, thodi der me upload hogi...")
    update_github_variable("STOP_FLAG", "1")

@bot.message_handler(commands=['vew'])
def live_view(message):
    bot.reply_to(message, "📸 Live Screenshot nikal raha hu... 5-10 second wait karo!")
    update_github_variable("VIEW_FLAG", "1")

@bot.message_handler(commands=['full'])
def full_screen(message):
    bot.reply_to(message, "📺 Full Screen mode activate kar raha hu...")
    update_github_variable("FULL_FLAG", "1")

# ==========================================
# 🌐 FLASK WEB SERVER (For Render Port Binding)
# ==========================================
@app.route('/')
def index():
    return "✅ Bot is alive and running! Server is Awake."

def run_bot():
    while True:
        try:
            print("Starting Telegram Polling...")
            bot.polling(none_stop=True, timeout=60)
        except Exception as e:
            print("Bot error:", e)
            time.sleep(5)

if __name__ == "__main__":
    threading.Thread(target=run_bot, daemon=True).start()
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
