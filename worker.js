const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DATA_URL = 'https://raw.githubusercontent.com/arianf3/usd/main/market.json';
const WEBAPP_URL = 'https://arianf3.github.io/usd/';
const CHANNEL_LINK = 'https://t.me/rad_protocol';
const REQUIRED_CHANNEL = '@rad_protocol';

function toPersianDigits(num) {
  if (num === null || num === undefined) return '';
  const fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return num.toString().replace(/[0-9]/g, w => fa[+w]);
}

function formatPrice(val, unit = 'تومان') {
  if (!val && val !== 0) return 'در حال استعلام';
  const formatted = typeof val === 'number' && !Number.isInteger(val)
    ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : parseInt(val).toLocaleString('en-US');
  return `${toPersianDigits(formatted)} ${unit}`;
}

async function tgCall(method, payload) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function fetchMarketData() {
  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error('Fetch failed');
    return await res.json();
  } catch (err) {
    console.error('Market data fetch error:', err);
    return null;
  }
}

function getMainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '🌐 ورود به وب‌اپ نبض بازار (نمودار و ابزارها)', web_app: { url: WEBAPP_URL } }
      ],
      [
        { text: '💵 ارزهای شاخص (دلار، یورو، درهم)', callback_data: 'rates_currencies' },
        { text: '🪙 طلا و انواع مسکوکات', callback_data: 'rates_gold' }
      ],
      [
        { text: '📈 نمودار ۳۰ روزه دلار', callback_data: 'chart_usd' },
        { text: '📊 نمودار طلا و سکه', callback_data: 'chart_gold' }
      ],
      [
        { text: '🔄 استعلام لحظه‌ای نرخ‌ها', callback_data: 'rates_refresh' },
        { text: '🧮 راهنمای محاسبه‌گر سریع', callback_data: 'calc_help' }
      ],
      [
        { text: '📢 کانال رسمی (@rad_protocol)', url: CHANNEL_LINK }
      ]
    ]
  };
}

function getMainMessage(data, name = 'کاربر عزیز') {
  const time = data ? toPersianDigits(data.time || '--:--') : '--:--';
  const dateShamsi = data ? (data.date_shamsi_full || data.date_shamsi || '') : '';
  const usdPrice = data && data.usd ? formatPrice(data.usd) : 'در حال دریافت...';
  const goldPrice = data && data.gold_18k ? formatPrice(data.gold_18k) : 'در حال دریافت...';
  const emamiPrice = data && data.coin_emami ? formatPrice(data.coin_emami) : 'در حال دریافت...';

  return (
    `سلام <b>${name}</b> به <b>نبض بازار | RadProtocol</b> خوش آمدید! 📊\n\n` +
    `⚡️ <b>آخرین خلاصه وضعیت بازار ایران:</b>\n` +
    `📅 تاریخ: <b>${dateShamsi}</b> | ساعت: <b>${time}</b>\n\n` +
    `🇺🇸 <b>دلار آزاد:</b> <code>${usdPrice}</code>\n` +
    `🟡 <b>طلای ۱۸ عیار:</b> <code>${goldPrice}</code>\n` +
    `🪙 <b>سکه امامی:</b> <code>${emamiPrice}</code>\n\n` +
    `👇 <i>برای مشاهده تمام قیمت‌ها، نمودارهای تحلیلی و ابزارها از گزینه‌های زیر استفاده کنید:</i>`
  );
}

function getCurrenciesMessage(data) {
  const time = data ? toPersianDigits(data.time || '--:--') : '--:--';
  const date = data ? (data.date_shamsi_full || '') : '';
  return (
    `💵 <b>نرخ زنده ارزهای شاخص (بازار آزاد تهران)</b>\n` +
    `⏱ آخرین آپدیت: <b>${time}</b> (${date})\n\n` +
    `🇺🇸 <b>دلار آمریکا:</b> <code>${formatPrice(data?.usd)}</code>\n` +
    `🇪🇺 <b>یورو اروپا:</b> <code>${formatPrice(data?.eur)}</code>\n` +
    `🇦🇪 <b>درهم امارات:</b> <code>${formatPrice(data?.aed)}</code>\n` +
    `🇬🇧 <b>پوند انگلیس:</b> <code>${formatPrice(data?.gbp)}</code>\n` +
    `🇹🇷 <b>لیر ترکیه:</b> <code>${formatPrice(data?.try)}</code>\n` +
    `🇨🇦 <b>دلار کانادا:</b> <code>${formatPrice(data?.cad)}</code>\n` +
    `🇨🇳 <b>یوان چین:</b> <code>${formatPrice(data?.cny)}</code>\n` +
    `🇮🇶 <b>صد دینار عراق:</b> <code>${formatPrice(data?.iqd)}</code>\n` +
    `🇷🇺 <b>روبل روسیه:</b> <code>${formatPrice(data?.rub)}</code>\n\n` +
    `🌐 <i>برای لیست ۳۷ ارز جهانی و تبدیل قیمت روی وب‌اپ کلیک کنید.</i>`
  );
}

function getGoldMessage(data) {
  const time = data ? toPersianDigits(data.time || '--:--') : '--:--';
  const date = data ? (data.date_shamsi_full || '') : '';
  return (
    `🪙 <b>نرخ زنده طلا و انواع مسکوکات</b>\n` +
    `⏱ آخرین آپدیت: <b>${time}</b> (${date})\n\n` +
    `🪙 <b>سکه طرح جدید (امامی):</b> <code>${formatPrice(data?.coin_emami)}</code>\n` +
    `🪙 <b>سکه طرح قدیم (بهار آزادی):</b> <code>${formatPrice(data?.coin_bahar)}</code>\n` +
    `🪙 <b>نیم سکه:</b> <code>${formatPrice(data?.coin_half)}</code>\n` +
    `🪙 <b>ربع سکه:</b> <code>${formatPrice(data?.coin_quarter)}</code>\n` +
    `🪙 <b>سکه گرمی:</b> <code>${formatPrice(data?.coin_gram)}</code>\n` +
    `🟡 <b>هر گرم طلای ۱۸ عیار:</b> <code>${formatPrice(data?.gold_18k)}</code>\n` +
    `⚖️ <b>یک مثقال طلا:</b> <code>${formatPrice(data?.gold_mesghal)}</code>\n` +
    `🌐 <b>انس طلای جهانی:</b> <code>${formatPrice(data?.usd_xau || data?.gold_ounce, 'دلار')}</code>\n` +
    `🛢 <b>نفت برنت:</b> <code>${formatPrice(data?.oil, 'دلار')}</code>\n\n` +
    `📈 <i>برای مشاهده تاریخچه و نوسانات ۳۰ روزه روی دکمه‌های زیر بزنید:</i>`
  );
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'alive',
        service: 'RadProtocol USD & Gold Telegram Bot',
        bot: '@Nabs_usd_bot',
        time: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      // 1. Handle Callback Queries
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = cq.message?.chat?.id;
        const messageId = cq.message?.message_id;
        const data = cq.data;
        const fromName = cq.from?.first_name || 'کاربر عزیز';

        // Acknowledge callback query
        await tgCall('answerCallbackQuery', { callback_query_id: cq.id });

        if (data === 'menu_main') {
          const mData = await fetchMarketData();
          await tgCall('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: getMainMessage(mData, fromName),
            parse_mode: 'HTML',
            reply_markup: getMainMenuMarkup()
          });
        } else if (data === 'rates_currencies') {
          const mData = await fetchMarketData();
          await tgCall('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: getCurrenciesMessage(mData),
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📈 نمودار تغییرات دلار', callback_data: 'chart_usd' }],
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
              ]
            }
          });
        } else if (data === 'rates_gold') {
          const mData = await fetchMarketData();
          await tgCall('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: getGoldMessage(mData),
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📊 نمودار طلا ۱۸', callback_data: 'chart_gold' },
                  { text: '🪙 نمودار سکه امامی', callback_data: 'chart_coin' }
                ],
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
              ]
            }
          });
        } else if (data === 'rates_refresh') {
          const mData = await fetchMarketData();
          await tgCall('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: getMainMessage(mData, fromName),
            parse_mode: 'HTML',
            reply_markup: getMainMenuMarkup()
          });
        } else if (data === 'chart_usd') {
          const chartUrl = 'https://raw.githubusercontent.com/arianf3/usd/main/charts/usd.png';
          await tgCall('sendPhoto', {
            chat_id: chatId,
            photo: chartUrl,
            caption: '📈 <b>نمودار نوسانات ۳۰ روز اخیر دلار آمریکا (تومان)</b>\n\nمنبع: @rad_protocol',
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 باز کردن در وب‌اپ و تحلیل کامل', web_app: { url: WEBAPP_URL } }],
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
              ]
            }
          });
        } else if (data === 'chart_gold') {
          const chartUrl = 'https://raw.githubusercontent.com/arianf3/usd/main/charts/gold_18k.png';
          await tgCall('sendPhoto', {
            chat_id: chatId,
            photo: chartUrl,
            caption: '📊 <b>نمودار تغییرات ۳۰ روز اخیر طلای ۱۸ عیار</b>\n\nمنبع: @rad_protocol',
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 باز کردن در وب‌اپ و تحلیل کامل', web_app: { url: WEBAPP_URL } }],
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
              ]
            }
          });
        } else if (data === 'chart_coin') {
          const chartUrl = 'https://raw.githubusercontent.com/arianf3/usd/main/charts/coin_emami.png';
          await tgCall('sendPhoto', {
            chat_id: chatId,
            photo: chartUrl,
            caption: '🪙 <b>نمودار تغییرات ۳۰ روز اخیر سکه تمام امامی</b>\n\nمنبع: @rad_protocol',
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 باز کردن در وب‌اپ و تحلیل کامل', web_app: { url: WEBAPP_URL } }],
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
              ]
            }
          });
        } else if (data === 'calc_help') {
          await tgCall('sendMessage', {
            chat_id: chatId,
            text: (
              `🧮 <b>ماشین‌حساب و تبدیل سریع ارز</b>\n\n` +
              `کافیه مقدار مورد نظرت رو برام بفرستی! مثلاً بنویس:\n` +
              `• <code>100 usd</code> یا <code>100 دلار</code>\n` +
              `• <code>50 eur</code> یا <code>50 یورو</code>\n` +
              `• <code>500 aed</code> یا <code>500 درهم</code>\n\n` +
              `یا می‌تونی روی دکمه زیر کلیک کنی تا ماشین‌حساب گرافیکی و پیشرفته در وب‌اپ برات باز بشه:`
            ),
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📱 باز کردن ماشین‌حساب وب‌اپ', web_app: { url: WEBAPP_URL } }],
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
              ]
            }
          });
        }

        return new Response('OK');
      }

      // 2. Handle Text Messages
      if (update.message) {
        const msg = update.message;
        const chatId = msg.chat?.id;
        const text = (msg.text || '').trim();
        const fromName = msg.from?.first_name || 'کاربر عزیز';

        if (text.startsWith('/start') || text === 'منوی اصلی' || text === 'شروع') {
          const mData = await fetchMarketData();
          await tgCall('sendMessage', {
            chat_id: chatId,
            text: getMainMessage(mData, fromName),
            parse_mode: 'HTML',
            reply_markup: getMainMenuMarkup()
          });
          return new Response('OK');
        }

        // Quick conversion parser: e.g. "100 usd" or "100 دلار" or "50 eur"
        const match = text.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z\u0600-\u06FF]+)$/);
        if (match) {
          const amount = parseFloat(match[1]);
          const unit = match[2].toLowerCase();
          const mData = await fetchMarketData();
          if (mData) {
            let rate = null;
            let unitName = '';

            if (['usd', 'دلار', 'dollar'].includes(unit)) {
              rate = mData.usd;
              unitName = 'دلار آمریکا';
            } else if (['eur', 'یورو', 'euro'].includes(unit)) {
              rate = mData.eur;
              unitName = 'یورو اروپا';
            } else if (['aed', 'درهم', 'dirham'].includes(unit)) {
              rate = mData.aed;
              unitName = 'درهم امارات';
            } else if (['gbp', 'پوند', 'pound'].includes(unit)) {
              rate = mData.gbp;
              unitName = 'پوند انگلیس';
            } else if (['try', 'لیر', 'lira'].includes(unit)) {
              rate = mData.try;
              unitName = 'لیر ترکیه';
            } else if (['cad', 'دلار کانادا'].includes(unit)) {
              rate = mData.cad;
              unitName = 'دلار کانادا';
            }

            if (rate) {
              const total = Math.round(amount * rate);
              await tgCall('sendMessage', {
                chat_id: chatId,
                text: (
                  `🧮 <b>نتیجه تبدیل آنلاین:</b>\n\n` +
                  `💰 <b>${toPersianDigits(amount)} ${unitName}</b> = <code>${formatPrice(total)}</code>\n\n` +
                  `⏱ نرخ هر واحد: <code>${formatPrice(rate)}</code>\n` +
                  `منبع: @rad_protocol`
                ),
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🌐 باز کردن در وب‌اپ', web_app: { url: WEBAPP_URL } }],
                    [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'menu_main' }]
                  ]
                }
              });
              return new Response('OK');
            }
          }
        }

        // Default response: show main menu
        const mData = await fetchMarketData();
        await tgCall('sendMessage', {
          chat_id: chatId,
          text: getMainMessage(mData, fromName),
          parse_mode: 'HTML',
          reply_markup: getMainMenuMarkup()
        });
      }

      return new Response('OK');
    } catch (err) {
      console.error('Webhook execution error:', err);
      return new Response('OK');
    }
  }
};
