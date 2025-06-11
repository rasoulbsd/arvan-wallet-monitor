import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const EMAIL = process.env.ARVAN_EMAIL;
const PASSWORD = process.env.ARVAN_PASSWORD;
const THRESHOLD = parseInt(process.env.WALLET_THRESHOLD, 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TOPIC_ID = process.env.TELEGRAM_TOPIC_ID;
const CHECK_INTERVAL_HOURS = parseInt(process.env.CHECK_INTERVAL_HOURS || '6', 10);
const INTERVAL_MS = CHECK_INTERVAL_HOURS * 60 * 60 * 1000;
const MSG_LOG = './sent-messages.json';

function saveMessageId(id) {
  try {
    let ids = [];
    if (fs.existsSync(MSG_LOG)) {
      ids = JSON.parse(fs.readFileSync(MSG_LOG));
    }
    ids.push(id);
    fs.writeFileSync(MSG_LOG, JSON.stringify(ids));
  } catch (err) {
    console.warn('[WARN] Could not save message ID:', err.message);
  }
}

function getSavedMessageIds() {
  try {
    if (!fs.existsSync(MSG_LOG)) return [];
    return JSON.parse(fs.readFileSync(MSG_LOG));
  } catch (err) {
    console.warn('[WARN] Could not read message log:', err.message);
    return [];
  }
}

function clearMessageLog() {
  try {
    fs.writeFileSync(MSG_LOG, JSON.stringify([]));
  } catch (err) {
    console.warn('[WARN] Could not clear message log:', err.message);
  }
}

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

  const res = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
  const messageId = res.data.result.message_id;
  saveMessageId(messageId);
}

async function deleteOldMessages() {
  const oldMessages = getSavedMessageIds();
  const remaining = [];

  for (const msgId of oldMessages) {
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        chat_id: CHAT_ID,
        message_id: msgId
      });
      console.log(`✅ Deleted alert message: ${msgId}`);
    } catch (err) {
      console.warn(`⚠️ Could not delete message ${msgId}:`, err.response?.data || err.message);
      remaining.push(msgId); // Keep only those that failed
    }
  }

  fs.writeFileSync(MSG_LOG, JSON.stringify(remaining));
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
    } else {
      console.log(`✅ Balance is healthy. Deleting old alert messages if any.`);
      await deleteOldMessages();
    }
  } catch (err) {
    console.error('[ERROR]', err.response?.data || err.message);
  }
}

async function startLoop() {
  console.log(`🔁 Starting Arvan wallet monitor. Every ${CHECK_INTERVAL_HOURS}h`);
  await checkWalletOnce();
  setInterval(checkWalletOnce, INTERVAL_MS);
}

startLoop();