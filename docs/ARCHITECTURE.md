# AST Pocket Architecture

## 設計原則
1. Knowledge（現在使う確認済み知識）と Weekly（学習履歴）を分離する。
2. AI生成内容を自動で verified にしない。
3. 各Knowledgeに `status`, `last_reviewed`, `source` を持たせる。
4. 検索は文字列完全一致ではなく、医療用語辞書 + 正規化 + fuzzy search を使う。
5. 患者情報、症例特定情報、院内限定資料、秘密情報はGitHubに保存しない。

## 将来拡張
- GitHub ActionsでMarkdownから検索indexを自動生成
- 毎週金曜12時にChatGPT学習履歴をWeekly Markdown化
- verified候補の差分レビュー
- ガイドライン更新検知
- PWA / オフライン
- 自分のノートを優先しつつ必要時にWeb検索する軽いAIハーネス
