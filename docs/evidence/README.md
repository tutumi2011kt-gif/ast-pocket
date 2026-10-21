# AST Pocket 感染症学習ノートの記述別根拠台帳（第1版）

## 目的

GPC clustersとMSSA菌血症の教科書型草案（各8章）の**重要な主張17件**について、以下の情報を検査できるようにしました。

- どの草案ファイルの、どの8章の、どの記述（完全一致する短いアンカー）か。
- どの公的GL・学会コンセンサス・査読総説・系統的レビューが参照候補か。
- その出典の公開URL・出版日・観測した最終更新日・確認日。
- 原典の該当節やPubMed抄録の識別子、照合状況。
- 臨床的に慎重なレビューが必要な程度（high/medium/low）。

2026-10-21時点で、17件の追跡記録が**2つの学習ノート計16章すべてに最低1件**存在するようにしました。

**16章すべての本文・事実・出典が医学的に照合完了したという意味ではありません。** これは章ごとに高優先度の根拠追跡対象を少なくとも1件確保した状態です。

### 出典の位置づけ

1. [IDSA/ESCMID 2026 SAB Part 1](https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/) — 2026-09-09公表・更新。成人/小児のSAB、リスク層別化・再血培・心エコー・画像・治療期間のコンセンサス。**MSSA/MRSAの個別薬剤推奨はPart 1では扱われない。**
2. [SCCM/IDSA 2023 ICU発熱評価](https://www.idsociety.org/practice-guideline/new-fever-in-critically-ill-patients/) — 2023-11-17公表。成人ICUでの発熱・採血に関する推奨（2セット採取、汚染の扱い等）。**ICU以外に無条件で一般化しない。**
3. [JAMA 2025 SAB総説](https://pubmed.ncbi.nlm.nih.gov/40193249/) — 2025-09-02公表。MSSAのβラクタム標的治療やsource controlのレビュー。**総説を2026 IDSAコンセンサスの個別薬剤推奨と取り違えない。**
4. [2025 CEZ比較系統的レビュー](https://pubmed.ncbi.nlm.nih.gov/40349971/) — 2025-05-09オンライン公表。主として観察研究に基づく比較。研究限界や実際の感染巣、国内添付文書の情報が必要。

### プログラム・データ

- `docs/evidence/sab-2026-10-21.json`：4資料の版情報と17件の記述の原典対応。
- `scripts/check-evidence-ledger.mjs`：ID・URL・日付・章・記述位置をチェックし、改訂日が変われば元記述を再確認対象とする。
- `scripts/test-evidence-ledger.mjs`：日付の改訂・欠落・架空出典・誤った章割り当て・医学的承認の偽装を拒否するテスト。
- `scripts/watch-official-sab-guideline.mjs`：IDSA 2026 SAB Part 1の公式HTMLに表示された更新日だけを取得して、台帳の登録日と比較。本文・文献の内容を自動解析するものではない。
- `scripts/test-guideline-version-watch.mjs`：新しい版、同じ版、取得エラー、公開ページが解析不能なケース等のテスト。
- `.github/workflows/sab-guideline-version-watch.yml`：**PR公開後**に毎週月曜05:45 JSTを目安に確認するGitHub Actions。GitHubの定期実行は遅れることがあります。

### ローカルでの確認

```bash
node scripts/test-evidence-ledger.mjs
node scripts/check-evidence-ledger.mjs
node scripts/test-guideline-version-watch.mjs
node scripts/watch-official-sab-guideline.mjs
```

公式ページの更新日が変わった場合、診療上の推奨が実際に変更されたかどうかは**人による最新版と旧版の照合が必要**です。URLが生きていても出典の内容が現在正しいことは証明できません。GitHub Actionsの取得失敗は「改訂なし」ではなく「不明」として失敗終了にします。

## 公開安全と医学的なレビュー

- 公開済みのGPC/MSSA草案のみを入力に使用。個人のChatGPT生会話、職場の診療情報、患者情報は登録しません。
- 自動テストが通っても、`medically_verified: false` と `auto_publish_allowed: false` を維持します。
- 16章全体の内容を承認したとは言えません。要確認箇所を優先して増やしていく途中です。
- IDSA Part 1と既存JAMA総説の記載が異なるように見える場合、原典の適用対象・推奨の種類・発行日を比較し、矛盾が解決するまで臨床用へ反映しません。
- 国内の添付文書、用量・感染部位ごとの適用条件、原著論文の全文、各資料の詳細節は引き続き確認が必要です。

## 次の工程

（1）高リスク記述を優先して全項目の医学的な根拠と例外条件を精査する。（2）原典の改訂検出時、影響範囲の差分と要確認事項をドラフトPRとして整理する。（3）ユーザーの承認を受け、学習ノート本文の安全な差分へ移す。（4）03:00 ChatGPT学習取得は独立した課題であり、根拠監査の成功を会話取得成功とみなさない。
