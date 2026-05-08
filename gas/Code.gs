/**
 * Nuae Nail Salon - Counseling JSON API (for Vercel frontend)
 *
 * このGASは Vercel から呼び出される JSON API として動作します。
 * フロントエンドは Vercel にホストされ、Vercel Serverless Function 経由で
 * このGASを叩きます。GAS自体のアクセスは「全員」に設定し、
 * API_SECRET (スクリプトプロパティ) によるトークン認証で保護します。
 *
 * セットアップ手順:
 * 1. Googleフォーム回答が記録されているスプレッドシートを開く
 * 2. 拡張機能 → Apps Script で本ファイルと appsscript.json を貼り付け
 * 3. 左メニューの「プロジェクトの設定」→「スクリプトプロパティ」で
 *    API_SECRET = <十分に長いランダム文字列> を追加
 * 4. デプロイ → 新しいデプロイ → ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 *      ※API_SECRETによる保護があるため、URLを知っていてもtokenがないと拒否
 * 5. 表示されたURLと API_SECRET を Vercel の環境変数に設定
 *    （README参照）
 */

const SHEET_NAME = '';

const NOTICE_ITEMS = [
  {
    title: 'アレルギー反応について',
    content: '体質や体調の変化により、これまで問題がなかった方でも、ジェルやアクリル、消毒液などによるアレルギー反応が起こる可能性がございます。施術中に痒み、痛み、腫れなどの異常を感じた場合は、すぐにお申し出ください。施術後に異常が現れた場合は、ご自身の判断で専門の医療機関を受診してください。'
  },
  {
    title: 'グリーンネイル（緑膿菌感染）について',
    content: 'ジェルネイルやスカルプチュアが浮いた（リフトした）まま放置すると、爪との隙間に水分が入り込み、細菌が繁殖して爪が緑色に変色する「グリーンネイル」になる場合がございます。リフトした場合は、ご自身で無理に剥がさず、お早めにご連絡の上、メンテナンスやオフ（除去）の施術をお受けください。'
  },
  {
    title: '爪への負担について',
    content: '丁寧な施術を心がけておりますが、ジェルネイルやスカルプチュアの施術、またオフ（除去）の際には、サンディング（爪の表面を削る作業）等により、自爪に多少の負担がかかることをご了承ください。'
  },
  {
    title: '施術後のご注意',
    content: 'ネイルを美しく保つため、また自爪の健康のため、以下の点にご注意ください。',
    list: [
      '爪先を道具のように使ったり、強い衝撃を与えたりしないでください。（例：シールを剥がす、缶のプルタブを開けるなど）',
      '長時間の水仕事やサウナ、プールなどのご利用は、ネイルが取れやすくなる原因となる場合がございます。',
      '乾燥はリフトやささくれの原因となります。キューティクルオイルやハンドクリームで、こまめに保湿をしてください。'
    ]
  },
  {
    title: 'お直し・保証について',
    list: [
      '施術には万全を期しておりますが、万が一、施術日より7日以内にジェルのリフトやストーンの脱落などがございましたら、無料でお直しさせていただきます。お手数ですが、7日以内にご連絡の上、ご来店ください。',
      'お客様ご自身の過失による破損（爪をぶつけた、挟んだ等）、デザインやカラーの変更、保証期間を過ぎてのご連絡は、保証対象外（有料）となります。',
      'いかなる場合も、施術料金の返金は致しかねますのでご了承ください。'
    ]
  },
  {
    title: '施術の中止',
    content: '施術中に、ネイリストがお客様の爪や皮膚の異常、または感染症の疑いなどを発見し、施術の続行が困難だと判断した場合は、やむを得ず施術を中止させていただくことがございます。'
  }
];

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    const provided = (e && e.parameter && e.parameter.token) || '';

    if (!expected) {
      return jsonResponse({ error: 'API_SECRET is not configured in script properties' });
    }
    if (!safeEquals(expected, provided)) {
      return jsonResponse({ error: 'Unauthorized' });
    }

    return jsonResponse({
      customers: getCustomers(),
      notices: NOTICE_ITEMS,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ error: String((err && err.message) || err) });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SHEET_NAME) {
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (sheet) return sheet;
  }
  return ss.getSheets()[0];
}

function getCustomers() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  return data
    .map((row, index) => buildCustomer(row, index + 2))
    .filter(c => c.name)
    .reverse();
}

function buildCustomer(row, rowId) {
  return {
    id: rowId,
    timestamp: formatDateTime(row[0]),
    name: String(row[1] || '').trim(),
    furigana: String(row[2] || '').trim(),
    address: String(row[3] || '').trim(),
    phone: String(row[4] || '').trim(),
    birthday: formatBirthday(row[5]),
    age: calculateAge(row[5]),
    snsConsent: String(row[6] || '').trim(),
    notesConfirmed: String(row[7] || '').trim(),
    initial: getInitial(row[2] || row[1])
  };
}

function getInitial(name) {
  const str = String(name || '').trim();
  return str ? str.charAt(0) : '？';
}

function formatDateTime(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  try {
    return Utilities.formatDate(new Date(date), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  } catch (err) {
    return String(date);
  }
}

function formatBirthday(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  try {
    return Utilities.formatDate(new Date(date), 'Asia/Tokyo', 'yyyy年M月d日');
  } catch (err) {
    return String(date);
  }
}

function calculateAge(birthday) {
  if (!birthday) return null;
  try {
    const birth = new Date(birthday);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 && age < 150 ? age : null;
  } catch (err) {
    return null;
  }
}
