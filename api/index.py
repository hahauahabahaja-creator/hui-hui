import os
import time
import requests
import threading
import telebot
from flask import Flask

# ==========================================
# ⚙️ SECRETS & CONFIGURATION
# ==========================================
# Render Dashboard se yeh variables uthayega
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") 
GITHUB_TOKEN = os.environ.get("PAT_TOKEN")
REPO_NAME = "hahauahabahaja-creator/hui-hui" # Teri GitHub Repo
WORKFLOW_NAME = "record.yml" # Teri Action file ka naam

# Bot aur Server Initialize kar rahe hain
bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# ==========================================
# 🛠️ HELPER FUNCTION: GITHUB VARIABLES UPDATE
# ==========================================
def update_github_variable(var_name, value):
    url = f"https://api.github.com/repos/{REPO_NAME}/actions/variables/{var_name}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json"
    }
    # Variable ko update (PATCH) kar rahe hain
    res = requests.patch(url, json={"name": var_name, "value": str(value)}, headers=headers)
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
        # Link nikal rahe hain user ke message se
        meet_url = message.text.split()[1]
    except IndexError:
        bot.reply_to(message, "⚠️ Bhai link bhi toh de! Example: `/go https://meet.google.com/xyz`")
        return

    bot.reply_to(message, f"🚀 GitHub Engine start kar raha hu for:\n{meet_url}\n\nThoda wait karo, VIP entry le raha hu!")
    
    # Purane flags ko Reset kar rahe hain (Taaki galti se turant band na ho)
    update_github_variable("STOP_FLAG", "0")
    update_github_variable("VIEW_FLAG", "0")
    update_github_variable("FULL_FLAG", "0")

    # GitHub Action (record.yml) ko trigger mar rahe hain
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
    bot.reply_to(message, "🛑 Stop command bhej diya! Recording save ho rahi hai, auto-split hokar jaldi group me aayegi...")
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
    return "Bot is alive and running!"

def run_bot():
    # Anti-Crash Loop: Agar Telegram se connection toote toh wapas jud jaye
    while True:
        try:
            print("Starting Telegram Polling...")
            bot.polling(none_stop=True, timeout=60)
        except Exception as e:
            print("Bot error:", e)
            time.sleep(5)

if __name__ == "__main__":
    # Bot ko background thread mein chala rahe hain
    threading.Thread(target=run_bot, daemon=True).start()
    
    # Flask Server main thread mein chalega
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
