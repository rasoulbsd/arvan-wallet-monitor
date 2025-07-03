import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const EMAIL = process.env.ARVAN_EMAIL;
const PASSWORD = process.env.ARVAN_PASSWORD;
const THRESHOLD = parseInt(process.env.ARVAN_WALLET_THRESHOLD, 10);
const BOT_TOKEN = process.env.ARVAN_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.ARVAN_TELEGRAM_CHAT_ID;
const TOPIC_ID = process.env.ARVAN_TELEGRAM_TOPIC_ID;
const CHECK_INTERVAL_HOURS = parseInt(process.env.ARVAN_CHECK_INTERVAL_HOURS || '6', 10);
const INTERVAL_MS = CHECK_INTERVAL_HOURS * 60 * 60 * 1000;
const MSG_LOG = './sent-messages.json';
const PROVIDER_KEY = 'arvan';

function saveMessageId(id) {
  try {
    let data = {};
    if (fs.existsSync(MSG_LOG)) {
      data = JSON.parse(fs.readFileSync(MSG_LOG));
    }
    if (!data[PROVIDER_KEY]) data[PROVIDER_KEY] = { ids: [] };
    if (!Array.isArray(data[PROVIDER_KEY].ids)) data[PROVIDER_KEY].ids = [];
    data[PROVIDER_KEY].ids.push(id);
    fs.writeFileSync(MSG_LOG, JSON.stringify(data), "utf8");
  } catch (err) {
    console.warn('[WARN] Could not save message ID:', err.message);
  }
}

function getSavedMessageIds() {
  try {
    if (!fs.existsSync(MSG_LOG)) return [];
    const data = JSON.parse(fs.readFileSync(MSG_LOG));
    return data[PROVIDER_KEY]?.ids || [];
  } catch (err) {
    console.warn('[WARN] Could not read message log:', err.message);
    return [];
  }
}

function clearMessageLog() {
  try {
    let data = {};
    if (fs.existsSync(MSG_LOG)) {
      data = JSON.parse(fs.readFileSync(MSG_LOG));
    }
    delete data[PROVIDER_KEY];
    fs.writeFileSync(MSG_LOG, JSON.stringify(data), "utf8");
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
  const thresholdFormatted = (Number(THRESHOLD) / 10).toLocaleString('en-US');
  const msg = `*⚠️🟦 Arvan Wallet Low Balance*\n\n\`\`\`\nTreshold: ${thresholdFormatted} T\nCurrent Balance: ${formatted} T\n\`\`\``;
  const payload = {
    chat_id: CHAT_ID,
    text: msg,
    parse_mode: 'Markdown'
  };
  if (TOPIC_ID) payload.message_thread_id = parseInt(TOPIC_ID);

  const prevMsgIds = getSavedMessageIds();
  let messageId;
  if (prevMsgIds.length > 0) {
    // Try to edit the last message
    const prevMsgId = prevMsgIds[prevMsgIds.length - 1];
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        ...payload,
        message_id: prevMsgId
      });
      messageId = prevMsgId;
    } catch (err) {
      // If edit fails (e.g., message deleted), send a new one
      const res = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
      messageId = res.data.result.message_id;
    }
  } else {
    const res = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
    messageId = res.data.result.message_id;
  }
  saveMessageId(messageId);
}

async function deleteOldMessages() {
  const msgIds = getSavedMessageIds();
  if (!msgIds.length) return;
  for (const msgId of msgIds) {
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        chat_id: CHAT_ID,
        message_id: msgId
      });
      console.log(`✅ Deleted alert message: ${msgId}`);
    } catch (err) {
      console.warn(`⚠️ Could not delete message ${msgId}:`, err.response?.data || err.message);
    }
  }
  clearMessageLog();
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