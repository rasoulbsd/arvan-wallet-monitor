import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// ES module __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const CACHE_PATH = path.join(__dirname, "token-cache.json");
const LOGIN_URL = "https://api.hamravesh.com/api/v1/users/login";
const PROFILE_URL = "https://api.hamravesh.com/api/v2/users/profile";

// Credentials from .env
const EMAIL = process.env.HAMRAVESH_EMAIL;
const PASSWORD = process.env.HAMRAVESH_PASSWORD;
const BOT_TOKEN = process.env.HAMRAVESH_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.HAMRAVESH_TELEGRAM_CHAT_ID;
const TOPIC_ID = process.env.HAMRAVESH_TELEGRAM_TOPIC_ID;
const THRESHOLD = parseInt(process.env.HAMRAVESH_WALLET_THRESHOLD, 10);
const CHECK_INTERVAL_HOURS = parseInt(process.env.HAMRAVESH_CHECK_INTERVAL_HOURS || '6', 10);
const INTERVAL_MS = CHECK_INTERVAL_HOURS * 60 * 60 * 1000;
const MSG_LOG = './sent-messages.json';
const PROVIDER_KEY = 'hamravesh';

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

const COMMON_HEADERS = {
  cookie: process.env.HAMRAVESH_COOKIE,
  "User-Agent": "insomnia/11.2.0"
};

function readTokenCache() {
  try {
    const data = fs.readFileSync(CACHE_PATH, "utf8");
    const json = JSON.parse(data);
    return json.token || null;
  } catch {
    return null;
  }
}

function writeTokenCache(token) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ token }), "utf8");
}

async function loginAndGetToken() {
  const options = {
    method: "POST",
    url: LOGIN_URL,
    headers: { ...COMMON_HEADERS, "Content-Type": "application/json" },
    data: {
      captcha: null,
      client_time: String(Date.now()),
      identity: EMAIL,
      password: PASSWORD
    }
  };
  const response = await axios.request(options);
  if (response.data && response.data.key) {
    writeTokenCache(response.data.key);
    return response.data.key;
  }
  throw new Error("Login failed: No token in response");
}

async function fetchProfile(token) {
  const options = {
    method: "GET",
    url: PROFILE_URL,
    headers: {
      ...COMMON_HEADERS,
      authorization: `Token ${token}`
    }
  };
  return axios.request(options);
}

async function notifyTelegram(balance) {
  const formatted = Number(balance).toLocaleString('en-US');
  const thresholdFormatted = Number(THRESHOLD).toLocaleString('en-US');
  const msg = `*⚠️🟪 Hamravesh Wallet Low Balance*\n\n\`\`\`\nTreshold: ${thresholdFormatted} IRR\nCurrent Balance: ${formatted} IRR\n\`\`\``;
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
    let token = readTokenCache();
    let triedLogin = false;
    let profile;
    while (true) {
      try {
        if (!token) {
          if (triedLogin) throw new Error("No token and login already tried.");
          token = await loginAndGetToken();
          triedLogin = true;
        }
        const response = await fetchProfile(token);
        profile = response.data;
        break; // Success!
      } catch (err) {
        if (!triedLogin) {
          token = null;
          continue;
        }
        throw err;
      }
    }
    // Assume balance is in profile.organizations[0].balance
    const org = profile.organizations && profile.organizations[0];
    const balance = org ? org.balance : null;
    console.log(`[${new Date().toISOString()}] Hamravesh Wallet Balance: ${balance?.toLocaleString('en-US') || 'N/A'} IRR`);
    if (balance !== null && balance < THRESHOLD) {
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
  console.log(`🔁 Starting Hamravesh wallet monitor. Every ${CHECK_INTERVAL_HOURS}h`);
  await checkWalletOnce();
  setInterval(checkWalletOnce, INTERVAL_MS);
}

startLoop(); 