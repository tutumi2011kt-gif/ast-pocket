# AST Pocket：6分野の詳細型ノート共通化と章別自動整理（2026-10-11）

## 開発内容

MSSA菌血症で採用した「8章、要点／詳しく、前回の続きから再開」を共通部品化。

- organism（菌）：菌の特徴、定着・汚染、感染症、耐性機序、薬剤、AST、症例、根拠
- drug（抗菌薬）：作用機序、スペクトラム、適応、用量、腎肝透析、PK/PD、副作用、根拠
- infection（感染症）：病態、診断、薬剤、感染源、治療期間、AST、症例、根拠
- culture（検査）：基本、採取、Gram染色、菌種、解釈、再検査、AST、根拠
- ast（AST実務）：初期対応、患者情報、培養、抗菌薬、感染源、提案、症例、根拠
- cross（横断）：基礎、機序、評価、治療、投与設計、リスク、AST、根拠

現在のMSSAノートは専用画面を維持し、従来の読書位置を保持します。登録済みS. maltophiliaノート、およびWeeklyから生成するCandida血症・AST・血培などのテーマに新しい共通画面を適用します。登録情報がない章は空欄のままとし、架空の臨床情報は補いません。

## Weeklyの学習候補を章へ振り分ける

既存の scripts/organize-weekly.mjs と scripts/propose-integrations.mjs に、notebook-templates.mjs の規則ベースの章判定を追加します。

1. content/index.json に登録された匿名化済み・公開可能なWeekly Markdownだけを入力する。
2. 既存のテーマ判定と安定IDによる重複整理を維持する。
3. 章分類として target_chapter と routing を各factへの参照リンクに追加する。
4. ルールで判定できないときは unclassified とし、確認待ち欄に保持する。
5. 元Weeklyへの参照ポインタだけを生成JSONに格納し、医学的記述を複製しない。
6. GitHub Pagesのビルド時に候補を再生成するが、元のノートMarkdownは自動変更しない。

例：ST合剤の高K → drugの副作用、VCMのAUC → drugのPK/PD、MSSAの再血培 → infectionの診断。曖昧な表現は未分類に残る。これは医学的な意味を判断するAIではなく、辞書・キーワードによる暫定分類です。

## データ安全と後方互換

すべての自動分類候補は原典未確認のdraftとして扱います。いわゆるverifiedの文字列が既存ノートに記録されていても、原典と承認の証跡がない内容を臨床モードで正式情報として見せません。

新しい読書位置は端末内のlocalStorageに、ノートID・表示深度・章ID・スクロール数値のみ保存します。患者情報や自由記述欄は作りません。MSSA専用の読書位置キーは変更せず、50問ReviewのIndexedDBとJSONバックアップも変更しません。既存Markdownの未分類の見出しも捨てずに表示します。

## テスト

- node scripts/organize-weekly.mjs --write
- node scripts/propose-integrations.mjs --write
- node --check notebook-templates.mjs
- node scripts/test-notebook-templates.mjs
- node scripts/test-integrations.mjs
- node scripts/test-integration-ui.mjs
- node scripts/test-mssa-notebook.mjs

CIでは旧UIとMSSAの回帰テストも実行します。

## 未実装の範囲

- 過去24時間のChatGPT学習会話からの自動取り込みと安全なWeekly登録を含めた全工程の運用保証
- 意味的な重複判定、矛盾判定、医学的原典の自動承認
- 臨床用30秒要約・投与量・期間の医学的妥当性を検証した更新
- 端末間の読書位置の自動同期
- 登録済み候補への手動カテゴリ修正UI

次はiPhoneで、S. maltophiliaなどの登録済みノートとCandida血症などのWeekly由来ノートについて8章・切替・読書位置・元Weekly参照を確認し、分類漏れや誤分類を評価します。
