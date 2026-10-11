# AST Pocket：夜間の感染症学習取り込み（第1段階）

## 概要

登録済みのWeeklyから6分野・8章へ振り分ける仕組みは公開済みです。本工程は、その前段である**学習記録の作成・重複排除・安全チェック・既存ファイルへの追加**を共通化します。

対象はChatGPTで学んだ**一般化・匿名化された医学知識**のみです。生の会話全文、診療録、患者固有の病歴、氏名・ID、院内限定情報、APIキー等は公開GitHubへ送らないでください。

**重要：GitHubリポジトリは公開です。ドラフトPR・別ブランチであっても、そこに書き込んだデータは公開されます。** コードによるキーワード検査は誤検出・見逃しがあるため、公開前に内容そのものの目視確認も必要です。

## 毎日3:00 JSTの想定フロー

1. ChatGPTの既存の定期タスクが、アクセスできる直近24時間の感染症・抗菌薬・AST学習だけを確認する。**会話の取得が不完全ならその事実を明記する。**
2. 会話から公開可能な一般的知識に抽象化し、患者・職員・施設の個別情報は完全に除去する。不安があれば取り込みを止める。長文の生ログは使わない。
3. 取り込める新しい内容が0件なら、空のWeeklyや架空の復習問題を作らない。
4. 次のJSONフォーマットに整形して、公開安全性のチェック後に変換する。データは原典未確認のdraftとして扱う。
5. 取り込みエンジンが重複を除外し、当日の content/weekly/YYYY-MM-DD.md があれば**追記統合**する。元の content/index.json のweekly一覧は新しい日付順に更新する。
6. 可能なら別ブランチ＋ドラフトPRで差分とCI結果を提示する。**公開リポジトリであるためPR作成前の匿名化と情報保護が必須**。内容が曖昧なら公開先には書き込まず、実行報告だけを行う。
7. PRが承認されて本番に取り込まれた場合、既存のGitHub Pagesの自動分類から各章に学習候補が表示される。臨床モードの情報は未承認のため更新しない。

## JSONの入力仕様（例示のみ：臨床用推奨ではない）

以下は安全な公開用に一般化した**架空の学習記録例**です。日付・期間は実行時のものを使用してください。

```json
{
  "schema_version": 1,
  "date": "2026-10-11",
  "coverage": "accessible_context_only",
  "public_release_reviewed": true,
  "window_start_jst": "2026-10-10T03:00:00+09:00",
  "window_end_jst": "2026-10-11T03:00:00+09:00",
  "learning": [
    {
      "topic": "MSSA菌血症",
      "point": "MSSA菌血症について再血培と感染源の確認の意義を学んだ",
      "question": "再血培が持続陽性なら何を再評価する？",
      "answer": "感染源、深部感染、感受性および抗菌薬の投与設計について再評価する。",
      "source_urls": [
        "https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/"
      ]
    }
  ]
}
```

- coverageは必ず`accessible_context_only`（アクセス可能な一部の会話）または`user_reviewed_export`（本人が確認して渡した学習要約）とします。すべての会話を取得したという宣言には使いません。
- public_release_reviewedは公開安全性のチェックが完了したことの**入力者による申告**です。プログラムはその真偽を保証しません。
- learningは最大25件、空配列なら何も作りません。各項目のtopicとpointが必須で、question/answerは必ずペアで指定します。
- source_urlsは公開HTTPSの原典候補を最大3個。**引用元を見つけただけでは医学的verifiedにしません**。
- ChatGPT会話URL、カルテ内容、メールアドレス、秘密情報などは入力禁止です。

## ローカルでの使い方

データを一時的なJSONファイルへ保存して、次のコマンドを実行します。**公開するJSON自体をGitHubへコミットする必要はありません**。

```bash
node scripts/import-daily-learning.mjs --input /private/path/daily.json --check
node scripts/import-daily-learning.mjs --input /private/path/daily.json --write
node scripts/validate-content.mjs
node scripts/check-weekly-safety.mjs
node scripts/organize-weekly.mjs --write
node scripts/propose-integrations.mjs --write
node scripts/test-integrations.mjs
```

writeはローカルの content/weekly と content/index.json を変更するだけで、GitHubにpushしません。**公開PRへ送る前にdiffを目視確認**してください。相反するQ&Aや機微情報の疑いがあればエラーにして自動上書きしません。

GitHubから直接ファイルを更新する夜間タスクでは、同じフォーマットとチェック条件を守り、必ず生成後のGitHub Actions Validateを確認してください。GitHub Actionsが成功しても個人情報の完全な除去は保証されません。

## 今回できるようになること

- アクセスできた学習要約→Weeklyへ**規則に沿って整形**する共通処理
- 同じ日のファイルへ重複なく追記する処理
- 重複学習を追加しない／異なる回答は自動上書きせず停止
- 0件時に新しいファイルを作らない／プレビューでは何も変更しない
- 患者ID・連絡先・秘密情報・生の会話URL等の疑いを検出して止めるチェック
- 原典未確認・部分的な会話取得の状態を明示
- 既存ノート・Review50問・読書位置・索引ルールを変更せずに動作

## 今回まだできないこと

- **ChatGPTの全会話履歴を完全・網羅的にプログラムから取得すること**
- 読み取れなかった会話から学習を自動的に補完すること
- 個人情報の混入が100％ないと機械的に保証すること
- 提案を医学的に原典承認済みへ自動昇格すること
- 毎日必ず本番へ自動マージすること（安全上、まずPR・差分確認を優先）

## 次の運用

現状の3:00 JST定期タスクは有効です。本コードの承認・公開後に、タスクの更新手順をこのJSON/Weekly仕様に合わせて改定できます。ただし実行時の会話取得可能範囲と書き込み権限は毎回確認が必要です。
