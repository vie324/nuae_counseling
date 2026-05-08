# Nuae Counseling - カウンセリング結果ビューア

ネイルサロン Nuae のお客様カウンセリング情報（Googleフォーム回答）を、視認性高く・お洒落に表示するためのウェブアプリです。

- **フロント**: Vercel（静的HTML/CSS/JS + Serverless Functions）
- **バックエンド**: Google Apps Script (JSON API)
- **データソース**: Googleフォーム → スプレッドシート
- **認証**: パスワード + 署名付きCookieセッション

## 構成

```
[Googleフォーム] → [スプレッドシート]
                         ↓ (GAS Web App / JSON API)
                   [Google Apps Script]
                         ↓ token認証付きで呼び出し
                  [Vercel /api/customers] ← Cookie認証
                         ↓
                   [Vercel /index.html] ← 静的フロント
                         ↓
                   [スタッフのブラウザ]
```

## ディレクトリ

```
.
├── public/                # Vercel静的フロント (outputDirectory)
│   ├── index.html         # ログイン + メインUI
│   ├── styles.css
│   └── app.js
├── api/                   # Vercel Serverless Functions
│   ├── _lib/
│   │   ├── auth.js        # Cookie署名・検証
│   │   └── gas.js         # GAS API呼び出し
│   ├── login.js           # POST /api/login
│   ├── logout.js          # POST /api/logout
│   └── customers.js       # GET /api/customers
├── gas/                   # Google Apps Script ソース（手動でGAS側に貼り付け）
│   ├── Code.gs
│   └── appsscript.json
├── package.json
├── vercel.json
├── .env.example           # 環境変数テンプレート
└── .gitignore
```

## セットアップ

### 1. GAS側

1. Googleフォーム回答が記録されているスプレッドシートを開く
2. 拡張機能 → Apps Script
3. `gas/Code.gs` の内容を `コード.gs` にコピー
4. `gas/appsscript.json` の内容を「プロジェクトの設定 → 『マニフェストファイルをエディタで表示する』」にコピー
5. プロジェクトの設定 → スクリプトプロパティ で以下を追加:
   - `API_SECRET` = 任意の長いランダム文字列（後でVercel側に同じ値を設定）
6. デプロイ → 新しいデプロイ → ウェブアプリ
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
     ※`API_SECRET` トークン認証で保護されているため、URLを知っていてもtokenがないと拒否される
7. 表示されたURL（末尾 `/exec`）をメモ

### 2. Vercel側

1. このリポジトリをGitHubにpushしてVercelに接続
2. Project Settings → Environment Variables に以下を登録（Production / Preview / Development全てに適用）:

   | 変数 | 値 |
   | --- | --- |
   | `APP_PASSWORD` | スタッフ用ログインパスワード |
   | `SESSION_SECRET` | Cookie署名用のランダム文字列（64文字以上推奨）<br>`openssl rand -hex 32` で生成 |
   | `GAS_URL` | 上記GASのデプロイURL（末尾 `/exec`） |
   | `GAS_API_TOKEN` | GASに設定した `API_SECRET` と同じ値 |

3. デプロイ完了後、表示されたURLにアクセス → パスワード入力でログイン

### 3. ローカル開発（任意）

```bash
npm i -g vercel
vercel link        # 既存プロジェクトと紐付け
vercel env pull    # 環境変数を .env.local にダウンロード
vercel dev         # http://localhost:3000 で起動
```

## 環境変数

| 変数 | 必須 | 用途 |
| --- | :---: | --- |
| `APP_PASSWORD` | ✓ | フロントログイン時のパスワード |
| `SESSION_SECRET` | ✓ | 認証Cookieの署名鍵（最低16文字、推奨64文字） |
| `GAS_URL` | ✓ | GAS Web AppのデプロイURL |
| `GAS_API_TOKEN` | ✓ | GAS側の `API_SECRET` と一致させる |

## API

| メソッド | パス | 用途 |
| --- | --- | --- |
| `POST` | `/api/login` | パスワード検証、認証Cookie発行 |
| `POST` | `/api/logout` | 認証Cookie削除 |
| `GET` | `/api/customers` | お客様一覧 + 注意事項取得（要Cookie認証） |

## スプレッドシートの想定列順

A 〜 H 列の順序がフォームの初期出力と一致している必要があります。

| 列 | 内容 |
| --- | --- |
| A | タイムスタンプ |
| B | お名前（フルネーム） |
| C | お名前（フリガナ） |
| D | ご住所 |
| E | 携帯電話番号 |
| F | 生年月日 |
| G | SNS掲載のご協力 |
| H | ご注意事項の確認 |

## カスタマイズ

- ブランドカラーは `public/styles.css` 冒頭の CSS変数 (`--color-primary` 等) で一括変更可能
- 注意事項の文言は `gas/Code.gs` の `NOTICE_ITEMS` 配列を編集
- 列順を変更したい場合は `gas/Code.gs` の `buildCustomer()` のインデックスを調整

## セキュリティ

- フロントはパスワード + 署名付きHttpOnly Cookieで保護
- GAS APIは独立トークン認証（`API_SECRET`）で保護、URLを知られても突破されない
- すべてのシークレットはVercel環境変数で管理、リポジトリには含めない
- Cookie有効期限は12時間（変更は `api/_lib/auth.js` の `TTL_HOURS`）
