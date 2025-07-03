# Arvan & Hamravesh Wallet Monitor

This repository contains monitoring scripts for both ArvanCloud and Hamravesh wallets, organized in separate directories for clarity and maintainability.

## Structure

- `arvan/` - ArvanCloud wallet monitoring code
- `hamravesh/` - Hamravesh wallet monitoring code
- `data/` - Data storage (if needed)
- `sent-messages.json` - Stores the latest Telegram alert message ID

## Environment Variables

Create a `.env` file in the root with the following content:

```env
# ArvanCloud
ARVAN_EMAIL=your_arvancloud_email@example.com
ARVAN_PASSWORD=your_arvancloud_password
ARVAN_WALLET_THRESHOLD=1000000
ARVAN_TELEGRAM_BOT_TOKEN=your_arvancloud_telegram_bot_token
ARVAN_TELEGRAM_CHAT_ID=your_arvancloud_telegram_chat_id
ARVAN_TELEGRAM_TOPIC_ID=your_arvancloud_telegram_topic_id

# Hamravesh
HAMRAVESH_EMAIL=your_hamravesh_email@example.com
HAMRAVESH_PASSWORD=your_hamravesh_password
HAMRAVESH_WALLET_THRESHOLD=1000000
HAMRAVESH_TELEGRAM_BOT_TOKEN=your_hamravesh_telegram_bot_token
HAMRAVESH_TELEGRAM_CHAT_ID=your_hamravesh_telegram_chat_id
HAMRAVESH_TELEGRAM_TOPIC_ID=your_hamravesh_telegram_topic_id
HAMRAVESH_COOKIE=your_hamravesh_cookie_string

# Common
CHECK_INTERVAL_HOURS=6
```

- Each provider can use a different Telegram bot, chat/group/channel, and threshold.
- If you use a group or channel, set the correct chat ID and bot permissions.

## Usage

### Locally

- **ArvanCloud:**
  ```bash
  node arvan/arvan-wallet-check.js
  ```
- **Hamravesh:**
  ```bash
  node hamravesh/hamravesh-monitor.js
  ```

### Docker Compose

To run both monitors in parallel:

```bash
docker-compose up --build -d
```

This will start two services:
- `arvan-monitor` (ArvanCloud)
- `hamravesh-monitor` (Hamravesh)

## Telegram Alerts

- Only one alert message is kept per provider. If the balance is low, the alert is updated in place.
- When the balance is healthy, the alert is deleted.
- The alert format is:

```
⚠️ <Provider> Wallet Low Balance (bolded)

```
Treshold: 3,000,000 T
Current Balance: 2,382,784 T
```

## Adding More Providers

To add more wallet monitors, create a new directory (e.g., `newprovider/`) and follow the same pattern with provider-specific environment variables.

## ⚙️ Features

- ✅ Periodic wallet balance checking (default: every 6 hours)
- ✅ Telegram alerts for low balance
- ✅ Configurable via `.env` file
- ✅ Self-contained, no external cron needed
- ✅ Deploy with a single Docker Compose command

---

## 📦 Requirements

- Docker
- Docker Compose
- A Telegram bot and chat ID (group or user)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/arvan-wallet-monitor.git
cd arvan-wallet-monitor
```

### 2. Create .env from Example
```bash
cp .env.example .env
```
Edit .env and fill in your ArvanCloud credentials and Telegram bot info.

### 3. Build and Run
```bash
docker-compose up --build -d
```
That's it. The monitor runs inside the container and checks your wallet every 6 hours by default.

## ⚙️ Environment Variables

| Variable              | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `ARVAN_EMAIL`         | Your ArvanCloud account email                                               |
| `ARVAN_PASSWORD`      | Your ArvanCloud account password                                            |
| `WALLET_THRESHOLD`    | Minimum acceptable balance in IRR (e.g., `10000000` for 1 million Toman)    |
| `CHECK_INTERVAL_HOURS`| Interval between wallet checks in hours (e.g., `6`)                         |
| `TELEGRAM_BOT_TOKEN`  | Telegram bot token from [@BotFather](https://t.me/BotFather)                |
| `TELEGRAM_CHAT_ID`    | Telegram group or user chat ID (can get from [@userinfobot](https://t.me/userinfobot)) |
| `TELEGRAM_TOPIC_ID`   | *(Optional)* Topic/thread ID if using a forum-style group                   |

## 💬 Example Telegram Message
```
⚠️ Arvan Wallet Low Balance: 1,234,567 T
```

## 🛠️ Development
To run locally without Docker:
```bash
npm install
node arvan-wallet-check.js
```

## 📄 License
This project is licensed for private/internal use only. Unauthorized distribution is prohibited.

