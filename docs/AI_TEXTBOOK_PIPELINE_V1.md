# AST Pocket 自動教科書の開発（2026-10-21）

## ねらいと正確な到達点

今後の完成目標は、①ChatGPTの感染症・抗菌薬学習の継続的取り込み、②8章構成の教科書的な学習ノートのAI生成・差分改訂、③国内外の原典照合と矛盾検知です。

**今回のPRは、これらを統合するための安全な「実行できる基礎部品」です。3機能すべてが完全自動運転できる状態にはまだ達していません。**

## 1. ChatGPTの毎日の会話取得：現状と現実的な経路

ChatGPTのアカウント全履歴をGitHub Actionsが直接読み出すための、公認かつこの環境で利用可能なインターフェースは確認されていません。ChatGPTの既存3:00 JSTタスクは、取得できる範囲の会話だけを扱い、網羅を主張できません。

**信頼できる代替入力**：ChatGPT設定の「データ管理 → データをエクスポート」でダウンロードできる公式エクスポートを本人がローカルで保管します。ZIPから取り出す conversations.json はGitHubに置かないでください。別のconversation JSONファイルがある場合も同じです。

今回追加した `scripts/read-private-chat-export.mjs` は、公式エクスポートから会話IDを確認し、**本人が指定した会話IDと期間の、感染症関連のユーザーメッセージだけをローカルに取り出す**機能です。画像・添付・音声・アシスタントメッセージは抽出しません。医学的内容の認定や匿名化はしません。元のチャット内容に患者情報が含まれる場合もあるので、この抽出ファイルをGitHubに追加したり、AI APIへそのまま送ることは禁止です。

実行例（ローカル）：

```bash
mkdir -p local-intake
# 個人データZIPを展開し、conversations.jsonをlocal-intake/にコピー（外部には非公開）
node scripts/read-private-chat-export.mjs --input local-intake/conversations.json --list
node scripts/read-private-chat-export.mjs --input local-intake/conversations.json --id 選択した会話ID --from 2026-10-20T03:00:00+09:00 --to 2026-10-21T03:00:00+09:00 --out local-intake/selected-questions.json
```

ユーザーが**一般化・公開安全性・学習ポイント・章・出典の抜粋を確認した後**に、入力の `local-intake/study-packet.json` を作成します。ここまでの取り込みは、全会話自動取得の代替となる手動ステップが必要です。

## 1.5. 公開済みWeeklyからAI草案用データを作る

取得済みWeeklyとソースポインタから、学習テーマごとにAIに入力する候補データを自動組み立てできます。以下の入力は**すでに公開されている、匿名化済みのWeeklyに限ります**。取り込み漏れは推測補完しません。

```bash
node scripts/organize-weekly.mjs --write
node scripts/propose-integrations.mjs --write
node scripts/weekly-to-study-packet.mjs --topic infection-pneumonia --date 2026-10-15 --out local-intake/pneumonia-packet.json
```

生成されるJSONの `public_safe_reviewed` は意図的に `false` です。章を分類できない項目は元Weeklyに残し、AIによる無理な分類は避けます。入力を人が再確認し、項目・根拠資料を付記してからAI生成へ進めてください。これで**Weeklyから詳細草案の入力までの書式変換**はつながりますが、原典の内容の自動保証や臨床用の自動公開までは行いません。

## 2. 学習ノートのAI詳細生成と改訂候補

`scripts/study-pipeline-core.mjs` は安全な入力とモデル出力の形式を検証し、6分類・各8章の見出しを使った**教科書草案Markdown**を組み立てます。学習項目のID・章ID・出典IDは既存のものだけが許可され、余分なIDを生成したAI出力はエラーになります。全ての草案に「医学的未承認／人手確認待ち」を明記し、正式ノートを上書きしません。根拠不足・矛盾・照合候補の状態も表示します。

`scripts/ai-study-draft.mjs` は別途利用権限を持つAPIキーを設定した場合に、**OpenAI Responses API**で章別草案を作成します。標準モデル名は `gpt-5-mini` ですが、利用可能なモデルと料金はアカウント側で確認する必要があります。ChatGPTの利用プランとAPIの料金は別です。

```bash
# CLI実行環境のみ。キーそのものをGitHub・チャットに貼らない。
export OPENAI_API_KEY=＜各自のAPIキー＞
node scripts/ai-study-draft.mjs --input local-intake/study-packet.json --out local-intake/ai-draft.md
```

生成結果は `local-intake/` に書くだけです（.gitignore登録済み）。`content/notes/` や臨床Knowledgeを自動更新しません。過去の原稿に対する差分の評価と取り込みは、まだ将来の実装対象です。

### study-packetの入力契約

必須フィールド：`schema_version:1`, `date`（JST日付）, `origin`（user_reviewed_export または task_accessible_partial）, `public_safe_reviewed:true`, `topic_id`, `title`, `category`, `learning`（id, point, chapter_id）, `sources`（id, title, url, published_date, accessed_date, excerpt, check_status）。

- 出典はHTTPSの公開URLで、認証情報・検索パラメータなし。患者情報・施設の秘密・個人会話リンクは禁止。
- `manually_excerpt_matched` は、人が原典とその抜粋が合うかを確認した**状態のみ**を示すもので、医学的な推奨を承認したという意味ではありません。
- 裏付け不足や矛盾がある場合は `insufficient_evidence` または `contradiction` と明記。モデルによる分類は人の確認に代わりません。
- AIが生成した新規事実や出典IDの捏造は安全検査で拒否しますが、文章の医学的な誤りが完全に防げるわけではありません。

## 3. 原典との照合を支援する処理

`scripts/check-guideline-excerpts.mjs` は出典URLの**公式ドメイン**を限定して、HTMLページ上に入力された短い原典抜粋があるかを検査します。

```bash
node scripts/check-guideline-excerpts.mjs --input local-intake/study-packet.json --out local-intake/evidence-check.json
```

結果例：`excerpt_present_not_medically_verified`、`excerpt_not_found`、`redirect_manual_review`、`pdf_manual_review`、`http_error`、`network_error`。

**抜粋がページにあることは、治療判断を裏付ける証明ではありません。** 日本国内の添付文書・学会GL・IDSA・感染部位や重症度・耐性機序の差異、文書の新旧の判定は、現状では人による医学的確認が必要です。PDF、学会認証が必要な資料、動的ページは安易に「照合済み」にしません。

## 4. 完成までの次のステップ

1. **取得の安定化**：ChatGPT側で毎日の学習を確実に取り出せる仕組み（本人の許可があるデータエクスポートやサポート対象の連携経路）を決める。現在のChatGPTタスクは網羅性を保証しない。まず会話取得とGitHub保存の経路が成立するかを小規模に検証する。
2. **詳細本文を自動更新**：新しい草案と既存の詳細ノートを差分比較し、同一内容はまとめ、矛盾・古い推奨は保留、ドラフトPRで変更箇所を可視化する。
3. **医学的評価を強化**：原典の版・更新日時・該当章/ページ・推奨・例外条件・国内添付文書との差異を構造化した照合履歴として蓄積する。
4. **本番承認ゲート**：AIが正しいと自己判定しただけでは正式Knowledgeへ反映しない。公開PRを含む情報保護と医学的レビューを行い、承認後に本番へ反映する。

## データ安全とCI

- 生のChatGPTエクスポート、患者情報、秘密ファイル、原典の長文抜粋、生成草案は**公開GitHubにアップロードしない**。
- このPRのテストは架空の一般化したデータと擬似API応答のみ。実際のAPIキー、患者情報、ユーザー会話は一切含まない。
- 既存のMSSA読書履歴・50問復習履歴・Weekly・臨床モードを変更しない。
- コードと安全検査のテスト成功は、医学的な品質保証とは別。
