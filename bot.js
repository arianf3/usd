/**
 * RadProtocol USD & Gold Telegram Bot (@Nabs_usd_bot)
 * Integrated with GitHub API (arianf3/usd) & Dumble / Market WebApp
 */

const http = require('http');
const https = require('https');
const tls = require('tls');
const { URL } = require('url');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PROXY_URL = process.env.TELEGRAM_PROXY || 'http://127.0.0.1:20808';
const WEBAPP_URL = 'https://arianf3.github.io/usd/';
const CHANNEL_LINK = 'https://t.me/rad_protocol';
const REQUIRED_CHANNEL = '@rad_protocol';
const DATA_URL = 'https://raw.githubusercontent.com/arianf3/usd/main/market.json';
const CHARTS_BASE = 'https://raw.githubusercontent.com/arianf3/usd/main/charts/';

// Read Admin Token for channel membership verification
let ADMIN_TOKEN = process.env.ADMIN_VERIFY_TOKEN || '';
if (!ADMIN_TOKEN) {
  try {
    const envContent = require('fs').readFileSync('/root/.hermes/.env', 'utf8');
    const m = envContent.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
    if (m) ADMIN_TOKEN = m[1].trim();
  } catch (e) {}
}

// Persian digits converter
function toFaDigits(str) {
  if (str === undefined || str === null) return '';
  const f = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (d) => f[d]);
}

function formatPrice(val, unit = 'تومان') {
  if (!val) return 'در دسترس نیست';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return toFaDigits(val.toString()) + ' ' + unit;
  return toFaDigits(num.toLocaleString('en-US')) + ' ' + unit;
}

// HTTP request helper with proxy support
function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';

    // If proxy configured for Telegram or general
    if (PROXY_URL && (parsed.hostname.includes('telegram.org') || options.useProxy)) {
      const p = new URL(PROXY_URL);
      if (isHttps) {
        // CONNECT tunnel for HTTPS over HTTP proxy
        const req = http.request({
          host: p.hostname,
          port: p.port,
          method: 'CONNECT',
          path: `${parsed.hostname}:${parsed.port || 443}`
        });

        req.on('connect', (res, socket) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Proxy CONNECT error: ${res.statusCode}`));
          }
          const secureSocket = tls.connect({
            socket,
            servername: parsed.hostname
          }, () => {
            const tlsReq = https.request({
              host: parsed.hostname,
              path: parsed.pathname + parsed.search,
              method: options.method || 'GET',
              headers: options.headers || {},
              createConnection: () => secureSocket
            }, (tlsRes) => {
              let data = '';
              tlsRes.on('data', chunk => data += chunk);
              tlsRes.on('end', () => resolve({ statusCode: tlsRes.statusCode, data }));
            });
            tlsReq.on('error', reject);
            if (options.body) tlsReq.write(options.body);
            tlsReq.end();
          });
          secureSocket.on('error', reject);
        });

        req.on('error', reject);
        req.end();
        return;
      }
    }

    // Direct connection
    const client = isHttps ? https : http;
    const req = client.request(urlStr, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Telegram API caller
async function tgCall(method, payload = {}) {
  try {
    const body = JSON.stringify(payload);
    const res = await request(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      body
    });
    return JSON.parse(res.data);
  } catch (err) {
    console.error(`Telegram API error [${method}]:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Fetch Market Data Cache
let cacheData = null;
let cacheTime = 0;

async function getMarketData() {
  const now = Date.now();
  if (cacheData && (now - cacheTime < 60000)) {
    return cacheData;
  }
  try {
    const res = await request(`${DATA_URL}?t=${now}`);
    if (res.statusCode === 200) {
      cacheData = JSON.parse(res.data);
      cacheTime = now;
      return cacheData;
    }
  } catch (err) {
    console.error('Failed to fetch market data:', err.message);
  }
  return cacheData || {};
}

// Channel membership verification helper
async function isChannelMember(userId) {
  const tokenToUse = ADMIN_TOKEN || BOT_TOKEN;
  try {
    const url = `https://api.telegram.org/bot${tokenToUse}/getChatMember`;
    const body = JSON.stringify({ chat_id: REQUIRED_CHANNEL, user_id: userId });
    const res = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      body
    });
    const json = JSON.parse(res.data);
    if (!json.ok) {
      console.warn(`Could not verify membership for ${userId}:`, json.description);
      return true; // Don't trap users if API fails
    }
    const status = json.result.status;
    return ['creator', 'administrator', 'member', 'restricted'].includes(status);
  } catch (err) {
    console.error('Channel member check error:', err.message);
    return true;
  }
}

function getJoinRequiredUI(name = 'کاربر') {
  const text =
    `سلام <b>${name}</b> عزیز! 📊\n\n` +
    `🔒 <b>برای استفاده از ربات نبض بازار و دریافت قیمت‌های لحظه‌ای، لطفاً ابتدا در کانال رسمی ما عضو شوید:</b>\n\n` +
    `📢 <b>کانال:</b> ${REQUIRED_CHANNEL}\n\n` +
    `👇 پس از عضویت در کانال، روی دکمه <b>«تایید عضویت ✅»</b> بزنید تا منوی ربات برایتان باز شود:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📢 عضویت در کانال RadProtocol', url: CHANNEL_LINK }],
      [{ text: '✅ تایید عضویت', callback_data: 'verify_join' }]
    ]
  };

  return { text, reply_markup: keyboard };
}

// UI: Main Menu
function getMainMenu(market) {
  const timeStr = market.time || '--:--';
  const dateStr = market.date_shamsi_full || 'امروز';

  const usd = formatPrice(market.usd);
  const eur = formatPrice(market.eur);
  const gold = formatPrice(market.gold_18k);
  const coin = formatPrice(market.coin_emami);

  const text = 
    `📊 <b>سامانه هوشمند نبض بازار | نرخ لحظه‌ای ارز، طلا و سکه</b>\n\n` +
    `📅 <b>تاریخ:</b> ${dateStr} | ⏱ <b>ساعت:</b> ${toFaDigits(timeStr)}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🇺🇸 <b>دلار آزاد:</b> <code>${usd}</code>\n` +
    `🇪🇺 <b>یورو اروپا:</b> <code>${eur}</code>\n` +
    `🟡 <b>طلای ۱۸ عیار:</b> <code>${gold}</code>\n` +
    `🪙 <b>سکه تمام امامی:</b> <code>${coin}</code>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👇 <b>برای مشاهده جزئیات کامل، نمودارها و محاسبه‌گر، از دکمه‌های زیر استفاده کنید:</b>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🌐 ورود به وب‌اپ نبض بازار (پیشرفته)', web_app: { url: WEBAPP_URL } }
      ],
      [
        { text: '💵 ارزهای شاخص و بین‌الملل', callback_data: 'rates_currencies' },
        { text: '🪙 طلا و انواع سکه', callback_data: 'rates_gold' }
      ],
      [
        { text: '📈 نمودار ۳۰ روزه دلار', callback_data: 'chart_usd' },
        { text: '📊 نمودار طلا و سکه', callback_data: 'chart_gold' }
      ],
      [
        { text: '🧮 ماشین‌حساب و تبدیل ارز', callback_data: 'calc_help' },
        { text: '🔄 استعلام و بروزرسانی نرخ‌ها', callback_data: 'rates_refresh' }
      ],
      [
        { text: '📢 کانال رسمی (@rad_protocol)', url: CHANNEL_LINK }
      ]
    ]
  };

  return { text, reply_markup: keyboard };
}

// UI: Currencies Menu
function getCurrenciesMenu(market) {
  const timeStr = toFaDigits(market.time || '--:--');
  const dateStr = market.date_shamsi_full || 'امروز';

  const text =
    `💵 <b>نرخ زنده ارزهای شاخص بازار آزاد</b>\n` +
    `⏱ <b>بروزرسانی:</b> ${dateStr} - ساعت ${timeStr}\n\n` +
    `🇺🇸 <b>دلار آمریکا:</b> <code>${formatPrice(market.usd)}</code>\n` +
    `🇪🇺 <b>یورو اروپا:</b> <code>${formatPrice(market.eur)}</code>\n` +
    `🇬🇧 <b>پوند انگلیس:</b> <code>${formatPrice(market.gbp)}</code>\n` +
    `🇦🇪 <b>درهم امارات:</b> <code>${formatPrice(market.aed)}</code>\n` +
    `🇹🇷 <b>لیر ترکیه:</b> <code>${formatPrice(market.try)}</code>\n` +
    `🇨🇦 <b>دلار کانادا:</b> <code>${formatPrice(market.cad)}</code>\n` +
    `🇦🇺 <b>دلار استرالیا:</b> <code>${formatPrice(market.aud)}</code>\n` +
    `🇨🇳 <b>یوان چین:</b> <code>${formatPrice(market.cny)}</code>\n` +
    `🇬🇪 <b>لاری گرجستان:</b> <code>${formatPrice(market.gel)}</code>\n` +
    `🇦🇿 <b>منات آذربایجان:</b> <code>${formatPrice(market.azn)}</code>\n` +
    `🇮🇶 <b>صد دینار عراق:</b> <code>${formatPrice(market.iqd)}</code>\n` +
    `🇷🇺 <b>روبل روسیه:</b> <code>${formatPrice(market.rub)}</code>\n` +
    `🇸🇦 <b>ریال عربستان:</b> <code>${formatPrice(market.sar)}</code>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>داده‌ها هر ۳۰ دقیقه به‌صورت خودکار همگام‌سازی می‌شوند.</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📈 مشاهده نمودار دلار', callback_data: 'chart_usd' },
        { text: '🌐 باز کردن در وب‌اپ', web_app: { url: WEBAPP_URL } }
      ],
      [
        { text: '🪙 مشاهده نرخ طلا و سکه', callback_data: 'rates_gold' },
        { text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }
      ]
    ]
  };

  return { text, reply_markup: keyboard };
}

// UI: Gold Menu
function getGoldMenu(market) {
  const timeStr = toFaDigits(market.time || '--:--');
  const dateStr = market.date_shamsi_full || 'امروز';

  const text =
    `🪙 <b>نرخ زنده انواع طلا و سکه (بازار تهران)</b>\n` +
    `⏱ <b>بروزرسانی:</b> ${dateStr} - ساعت ${timeStr}\n\n` +
    `🟡 <b>طلای ۱۸ عیار:</b> <code>${formatPrice(market.gold_18k)}</code>\n` +
    `⚖️ <b>یک مثقال طلا:</b> <code>${formatPrice(market.gold_mesghal)}</code>\n` +
    `🌐 <b>انس طلای جهانی:</b> <code>${formatPrice(market.gold_ounce || market.usd_xau, 'دلار')}</code>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>سکه تمام طرح جدید (امامی):</b> <code>${formatPrice(market.coin_emami)}</code>\n` +
    `🪙 <b>سکه تمام طرح قدیم (بهار آزادی):</b> <code>${formatPrice(market.coin_bahar)}</code>\n` +
    `🪙 <b>نیم سکه بهار آزادی:</b> <code>${formatPrice(market.coin_half)}</code>\n` +
    `🪙 <b>ربع سکه بهار آزادی:</b> <code>${formatPrice(market.coin_quarter)}</code>\n` +
    `🪙 <b>سکه یک گرمی:</b> <code>${formatPrice(market.coin_gram)}</code>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>برای دیدن آرشیو تاریخی و نمودار روند، روی دکمه‌های زیر کلیک کنید.</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 نمودار سکه امامی', callback_data: 'chart_coin' },
        { text: '📈 نمودار طلای ۱۸ عیار', callback_data: 'chart_gold' }
      ],
      [
        { text: '🌐 مشاهده نمودارهای تعاملی وب‌اپ', web_app: { url: WEBAPP_URL } }
      ],
      [
        { text: '💵 مشاهده ارزها', callback_data: 'rates_currencies' },
        { text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }
      ]
    ]
  };

  return { text, reply_markup: keyboard };
}

// Handler for message
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from ? msg.from.id : chatId;
  const userName = msg.from ? (msg.from.first_name || 'کاربر') : 'کاربر';
  const text = (msg.text || '').trim();

  // Enforce channel membership for all commands
  const isMember = await isChannelMember(userId);
  if (!isMember) {
    const joinUI = getJoinRequiredUI(userName);
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: joinUI.text,
      parse_mode: 'HTML',
      reply_markup: joinUI.reply_markup
    });
    return;
  }

  const market = await getMarketData();

  // /start or start command
  if (text.startsWith('/start') || text === 'منو' || text === 'menu') {
    const ui = getMainMenu(market);
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    return;
  }

  // Quick Currency checks
  if (text.includes('دلار') || text.toLowerCase() === 'usd') {
    const usdPrice = market.usd;
    // Check if it's an amount like "100 دلار" or "100 usd"
    const match = text.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const amount = parseFloat(match[1]);
      const totalToman = Math.round(amount * usdPrice);
      await tgCall('sendMessage', {
        chat_id: chatId,
        text: 
          `🧮 <b>محاسبه ارزش دلار:</b>\n\n` +
          `💵 <b>مقدار:</b> ${toFaDigits(amount.toLocaleString())} دلار\n` +
          `💲 <b>نرخ هر دلار:</b> ${formatPrice(usdPrice)}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>معادل کل:</b> <code>${formatPrice(totalToman)}</code>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 ماشین‌حساب پیشرفته وب‌اپ', web_app: { url: WEBAPP_URL } }],
            [{ text: '🔙 منوی اصلی', callback_data: 'menu_main' }]
          ]
        }
      });
      return;
    }

    const ui = getCurrenciesMenu(market);
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    return;
  }

  if (text.includes('طلا') || text.includes('سکه') || text.toLowerCase().includes('gold') || text.toLowerCase().includes('coin')) {
    const ui = getGoldMenu(market);
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    return;
  }

  // Number conversion fallback
  const numMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const amount = parseFloat(numMatch[1]);
    const usdPrice = market.usd || 1;
    const totalToman = Math.round(amount * usdPrice);
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: 
        `🧮 <b>تبدیل سریع:</b>\n\n` +
        `💵 ${toFaDigits(amount.toLocaleString())} دلار = <code>${formatPrice(totalToman)}</code>\n` +
        `<i>(بر اساس نرخ دلار لحظه‌ای ${formatPrice(usdPrice)})</i>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 ماشین‌حساب کامل تمام ارزها', web_app: { url: WEBAPP_URL } }],
          [{ text: '🔙 منوی اصلی', callback_data: 'menu_main' }]
        ]
      }
    });
    return;
  }

  // Default menu
  const ui = getMainMenu(market);
  await tgCall('sendMessage', {
    chat_id: chatId,
    text: ui.text,
    parse_mode: 'HTML',
    reply_markup: ui.reply_markup
  });
}

// Handler for callback query
async function handleCallbackQuery(cq) {
  const cqId = cq.id;
  const chatId = cq.message.chat.id;
  const userId = cq.from ? cq.from.id : chatId;
  const userName = cq.from ? (cq.from.first_name || 'کاربر') : 'کاربر';
  const messageId = cq.message.message_id;
  const data = cq.data;

  // Handle verify_join callback
  if (data === 'verify_join') {
    const isMember = await isChannelMember(userId);
    if (!isMember) {
      await tgCall('answerCallbackQuery', {
        callback_query_id: cqId,
        text: '❌ شما هنوز در کانال @rad_protocol عضو نشده‌اید!\nلطفاً ابتدا روی دکمه عضویت بزنید و عضو شوید.',
        show_alert: true
      });
      return;
    }
    await tgCall('answerCallbackQuery', {
      callback_query_id: cqId,
      text: '✅ عضویت شما تایید شد! به نبض بازار خوش آمدید.',
      show_alert: false
    });
    const market = await getMarketData();
    const ui = getMainMenu(market);
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    return;
  }

  // Enforce channel membership for all other buttons
  const isMember = await isChannelMember(userId);
  if (!isMember) {
    const joinUI = getJoinRequiredUI(userName);
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: joinUI.text,
      parse_mode: 'HTML',
      reply_markup: joinUI.reply_markup
    });
    await tgCall('answerCallbackQuery', {
      callback_query_id: cqId,
      text: '🔒 برای دسترسی به این بخش، ابتدا باید عضو کانال @rad_protocol شوید.',
      show_alert: true
    });
    return;
  }

  const market = await getMarketData();

  if (data === 'menu_main') {
    const ui = getMainMenu(market);
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    await tgCall('answerCallbackQuery', { callback_query_id: cqId });
    return;
  }

  if (data === 'rates_currencies') {
    const ui = getCurrenciesMenu(market);
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    await tgCall('answerCallbackQuery', { callback_query_id: cqId });
    return;
  }

  if (data === 'rates_gold') {
    const ui = getGoldMenu(market);
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    await tgCall('answerCallbackQuery', { callback_query_id: cqId });
    return;
  }

  if (data === 'rates_refresh') {
    // Clear cache to force refresh
    cacheData = null;
    cacheTime = 0;
    const freshMarket = await getMarketData();
    const ui = getMainMenu(freshMarket);
    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: ui.text,
      parse_mode: 'HTML',
      reply_markup: ui.reply_markup
    });
    await tgCall('answerCallbackQuery', {
      callback_query_id: cqId,
      text: '✅ نرخ‌های لحظه‌ای با موفقیت بروزرسانی شدند!',
      show_alert: false
    });
    return;
  }

  if (data === 'chart_usd') {
    await tgCall('answerCallbackQuery', { callback_query_id: cqId, text: '📈 در حال بارگذاری نمودار...' });
    const photoUrl = `${CHARTS_BASE}usd.png?t=${Date.now()}`;
    await tgCall('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption: 
        `📈 <b>نمودار ۳۰ روزه روند قیمت دلار آزاد</b>\n\n` +
        `💵 <b>نرخ فعلی:</b> ${formatPrice(market.usd)}\n` +
        `⏱ <b>تاریخ:</b> ${market.date_shamsi_full || ''}\n\n` +
        `🌐 <i>برای تحلیل تکنیکال و نمودار تعاملی، از وب‌اپ استفاده کنید:</i>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 ورود به وب‌اپ نبض بازار', web_app: { url: WEBAPP_URL } }],
          [{ text: '🔙 بازگشت به منو', callback_data: 'menu_main' }]
        ]
      }
    });
    return;
  }

  if (data === 'chart_gold') {
    await tgCall('answerCallbackQuery', { callback_query_id: cqId, text: '📊 در حال بارگذاری نمودار طلا...' });
    const photoUrl = `${CHARTS_BASE}gold_18k.png?t=${Date.now()}`;
    await tgCall('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption: 
        `📊 <b>نمودار ۳۰ روزه طلای ۱۸ عیار</b>\n\n` +
        `🟡 <b>نرخ فعلی:</b> ${formatPrice(market.gold_18k)}\n` +
        `⏱ <b>تاریخ:</b> ${market.date_shamsi_full || ''}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 ورود به وب‌اپ نبض بازار', web_app: { url: WEBAPP_URL } }],
          [{ text: '🔙 بازگشت به منو', callback_data: 'menu_main' }]
        ]
      }
    });
    return;
  }

  if (data === 'chart_coin') {
    await tgCall('answerCallbackQuery', { callback_query_id: cqId, text: '🪙 در حال بارگذاری نمودار سکه...' });
    const photoUrl = `${CHARTS_BASE}coin_emami.png?t=${Date.now()}`;
    await tgCall('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption: 
        `🪙 <b>نمودار ۳۰ روزه سکه تمام طرح جدید (امامی)</b>\n\n` +
        `🪙 <b>نرخ فعلی:</b> ${formatPrice(market.coin_emami)}\n` +
        `⏱ <b>تاریخ:</b> ${market.date_shamsi_full || ''}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 ورود به وب‌اپ نبض بازار', web_app: { url: WEBAPP_URL } }],
          [{ text: '🔙 بازگشت به منو', callback_data: 'menu_main' }]
        ]
      }
    });
    return;
  }

  if (data === 'calc_help') {
    const text = 
      `🧮 <b>راهنمای ماشین‌حساب و تبدیل ارز</b>\n\n` +
      `برای تبدیل سریع هر رقمی به تومان، کافیه عدد مورد نظرتون رو به همراه کلمه دلار در ربات بفرستید:\n\n` +
      `🔹 <b>نمونه‌ها:</b>\n` +
      `• <code>100 دلار</code>\n` +
      `• <code>500 usd</code>\n` +
      `• <code>1250</code>\n\n` +
      `ربات بلافاصله معادل ریالی و تومانی اون رو با آخرین نرخ بازار براتون محاسبه می‌کنه!\n\n` +
      `✨ <b>یا می‌تونید از ماشین‌حساب پیشرفته ۳۷ ارزی داخل وب‌اپ استفاده کنید:</b>`;

    await tgCall('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 باز کردن ماشین‌حساب وب‌اپ', web_app: { url: WEBAPP_URL } }],
          [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
        ]
      }
    });
    await tgCall('answerCallbackQuery', { callback_query_id: cqId });
    return;
  }

  await tgCall('answerCallbackQuery', { callback_query_id: cqId });
}

// Long Polling Runner
let lastUpdateId = 0;
let isPolling = false;

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  try {
    const res = await tgCall('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
      allowed_updates: ['message', 'callback_query']
    });

    if (res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        if (update.message) {
          handleMessage(update.message).catch(e => console.error('handleMessage error:', e.message));
        } else if (update.callback_query) {
          handleCallbackQuery(update.callback_query).catch(e => console.error('handleCallbackQuery error:', e.message));
        }
      }
    }
  } catch (err) {
    console.error('Polling cycle error:', err.message);
  } finally {
    isPolling = false;
    setTimeout(pollUpdates, 500);
  }
}

// Start
console.log('Starting RadProtocol USD & Gold Bot (@Nabs_usd_bot)...');
pollUpdates();
