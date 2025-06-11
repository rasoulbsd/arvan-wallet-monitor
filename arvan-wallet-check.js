import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL = process.env.ARVAN_EMAIL;
const PASSWORD = process.env.ARVAN_PASSWORD;
const THRESHOLD = parseInt(process.env.WALLET_THRESHOLD, 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TOPIC_ID = process.env.TELEGRAM_TOPIC_ID;

const CHECK_INTERVAL_HOURS = parseInt(process.env.CHECK_INTERVAL_HOURS || '6', 10);
const INTERVAL_MS = CHECK_INTERVAL_HOURS * 60 * 60 * 1000;

async function login() {
  const res = await axios.post('https://dejban.arvancloud.ir/v1/auth/login', {
    email: EMAIL,
    password: PASSWORD,
    captcha: 'v3.undefined'
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://accounts.arvancloud.ir',
      'Referer': 'https://accounts.arvancloud.ir/',
      'x-redirect-uri': 'https://panel.arvancloud.ir/',
      'user-agent': 'Mozilla/5.0'
    }
  });
  return res.data.data;
}

async function refreshTokenPair(accessToken, refreshToken, defaultAccount) {
  const authHeader = `Bearer ${accessToken}.${defaultAccount}`;
  const res = await axios.post('https://dejban.arvancloud.ir/v1/auth/refresh-token', {
    refreshToken
  }, {
    headers: {
      Authorization: authHeader,
      'Accept-Language': 'en'
    }
  });
  return res.data.data.accessToken;
}

async function queryWallet(bearerToken) {
  const res = await axios.get('https://napi.arvancloud.ir/resid/v1/wallets/me', {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'User-Agent': 'Mozilla/5.0',
      Origin: 'https://panel.arvancloud.ir',
      Referer: 'https://panel.arvancloud.ir/'
    }
  });
  return res.data.data;
}

async function notifyTelegram(balance) {
  const formatted = (Number(balance) / 10).toLocaleString('en-US');
  const msg = `⚠️ Arvan Wallet Low Balance: ${formatted} T`;
  const payload = {
    chat_id: CHAT_ID,
    text: msg
  };
  if (TOPIC_ID) payload.message_thread_id = parseInt(TOPIC_ID);
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
}

async function checkWalletOnce() {
  try {
    const { accessToken, refreshToken, defaultAccount } = await login();
    const newAccessToken = await refreshTokenPair(accessToken, refreshToken, defaultAccount);
    const wallet = await queryWallet(`${newAccessToken}.${defaultAccount}`);
    const balance = parseInt(wallet.totalBalance, 10);
    console.log(`[${new Date().toISOString()}] Wallet Balance: ${balance.toLocaleString('en-US')} IRR`);

    if (balance < THRESHOLD) {
      console.log(`❗ Balance below threshold (${THRESHOLD})`);
      await notifyTelegram(balance);
    }
  } catch (err) {
    console.error('[ERROR]', err.response?.data || err.message);
  }
}

async function startLoop() {
  console.log(`Starting Arvan wallet monitor. Interval: ${CHECK_INTERVAL_HOURS}h`);
  await checkWalletOnce();
  setInterval(checkWalletOnce, INTERVAL_MS);
}

startLoop();