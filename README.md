# ArvanCloud Wallet Monitor 🕵️‍♂️

A fully Dockerized Node.js service that monitors your [ArvanCloud](https://www.arvancloud.ir/) wallet balance and sends alerts via Telegram if the balance drops below a custom threshold.

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
That’s it. The monitor runs inside the container and checks your wallet every 6 hours by default.

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

