# Weekly自動整理の仕様（Ver.2・第1段階）

## できること
- Weeklyの「今週の学習」「今週の重要ポイント」「正式ノート候補」を6カテゴリに自動分類。
- 分類根拠として元のWeeklyのパス・項目を紐付ける。原文は重複保存しない。
- 辞書153件と手動分類ルールを使って別名・略称も判定。
- 既存の統合ノート（MSSA菌血症など）へのリンク。
- Pages公開時に node scripts/organize-weekly.mjs --write を自動実行し、content/organized.json を公開サイトに生成。
- GitHub Actions Validateでは node scripts/test-organizer.mjs で品質テストを実行。

## 安全・制約
- 現段階の分類はルールと別名の文字列照合。AIによる意味理解や自動要約は未実装。
- 分類された学習ログは draft として表示。確認済みKnowledgeを自動上書きしない。
- 投稿済みWeekly自体から個人情報を除去する機能はない。患者情報・院内限定情報を公開GitHubへ保存しない。
- ノートに未検証の治療推奨、用量、投与期間を加えない。
- 保存済みのWeeklyの分類結果はPagesへの次のデプロイ時に更新される。
- ChatGPT会話からのWeekly自動保存は別の予約タスク。過去の会話を漏れなく読み取り、GitHubへ書き込めることまでは保証しない。

## 実装ファイル
- data/topic-rules.json: 6分類と個別テーマ名・別名
- scripts/organize-weekly.mjs: 公開用索引の自動生成
- scripts/test-organizer.mjs: 分類精度とdraftの回帰検証
- .github/workflows/pages.yml: Pagesデプロイ時の索引生成
- app.js: Home、分野別一覧、Weekly・統合ノートへのリンク
- styles.css: 分類一覧画面の表示

## 今後の拡張
- 未分類項目を確認待ち一覧へ表示。
- 原典照合済みの追記案を作り、重要変更だけ承認する。
- 自動統合の精度評価と同義語・誤分類対策。
