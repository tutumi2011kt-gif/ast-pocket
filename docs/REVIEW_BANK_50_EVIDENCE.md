# AST Pocket — 復習問題50問とエビデンス管理（2026-10-11）

## 今回の範囲
既存の12問に38問を追加し、合計50問とした。既存の12問については`id`・`version`・設問・選択肢・正答の内容を維持し、回答履歴・バックアップとの互換性を保つ。

| 分野 (`domain`) | 問数 |
| --- | ---: |
| 血液培養・微生物 (`blood`) | 11 |
| 抗菌薬・耐性菌 (`antibiotic`) | 12 |
| 感染症・感染臓器 (`infection`) | 11 |
| AST実務・感染源評価 (`ast`) | 10 |
| TDM・腎機能・PK/PD (`tdm`) | 6 |
| **計** | **50** |

各問題の根拠候補URLを`candidate_evidence_urls`へ記録した。利用者は学習モードのReviewから「参考ガイドライン候補（照合前）」を展開して確認できる。

## 重要：現段階での医学的安全性
**全50問が `status: "draft"`、`evidence_state: "candidate_linked"`、`reviewed_at: null`、`evidence_url: null`。設問と解答を原典本文と一対一で照合し、レビューを完了した問題はまだない。**

参考URLを付しただけで、臨床上の正確性を保証しない。学習成績は練習状況（未学習／復習が必要／練習済み）としてのみ記録し、正式な医学的「理解確認済み」や「定着」へは昇格しない。臨床モードにはdraft問題・回答を流さない。

特に2026年にはIDSAのAMRガイダンス（7月）とIDSA/ESCMIDのS. aureus菌血症コンセンサス（9月）が公表されたため、これらを新しい候補出典に含めた。ただし、国内の抗菌薬承認状況・利用可能性・施設採用や最新の改訂は別途確認が必要。

## 保存データと後方互換性
- 出題問題の`id`と`version`が回答履歴のキー。既存12問は変更していないため、IndexedDBの記録やJSONバックアップはそのまま読める。
- 新規38問は新しいIDを採用。自動出題アルゴリズム・日本時間の平日5問／週末10問・間隔反復は変更しない。
- 当日分の問題セットは端末内に日付付きで保存する仕様。既に当日の問題を解いている端末は、その日の問題をそのまま継続し、翌日から拡充が反映される。
- 回答履歴は公開GitHubや外部APIへ送信しない。患者情報・院内情報は書き込まない。

## 原典確認・昇格の手順
1. 問題ごとに設問・選択肢・正答・解説と元の一次資料を比較し、根拠となる**節・推奨番号などの特定箇所**を記録する。候補URLの存在だけで承認しない。
2. 原著・ガイドラインの発行日と現行の更新状況、推奨の強さ、対象患者・適応、腎機能などの前提、日本国内での利用可否を確認する。
3. 必要に応じて設問を修正する際は、既存の学習履歴と意味が混在しないように`version`を増やす（自動で既存の「正解」を新バージョンに付け替えない）。
4. レビュアーが原典を自ら確認できた問題のみ、**以下のすべて**を1つの問題に保存し、コードレビューで差分を確認する。
5. すべてが揃ってから `status: "verified"`、`evidence_state: "human_reviewed"`に設定する。

```json
{
  "status": "verified",
  "evidence_state": "human_reviewed",
  "reviewed_at": "YYYY-MM-DD",
  "evidence_url": "https://一次資料の該当ページ",
  "verification": {
    "method": "human_original_review",
    "reviewer": "実際に確認した担当者",
    "evidence_locator": "該当の推奨番号・章など",
    "review_note": "設問・正答・対象患者・地域差を確認した内容"
  }
}
```

`validateQuestionBank`はこれらが不十分な `verified` を拒否する。`isMedicallyVerified`は実行時も同じ条件を要求する。ただし**これはデータ検証であって、担当者の本人認証・医学的正確性の自動判定ではない**。GitHubレビューと実際の担当者確認が必要。

## 出典候補
- [IDSA AMR guidance 2026](https://www.idsociety.org/practice-guideline/amr-guidance/)
- [IDSA/ESCMID SAB consensus 2026](https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/)
- [IDSA Candida](https://www.idsociety.org/practice-guideline/candidiasis/)
- [IDSA 2025 cUTI](https://www.idsociety.org/practice-guideline/complicated-urinary-tract-infections/)
- [IDSA/SHEA CDI](https://www.idsociety.org/practice-guideline/clostridioides-difficile-2021-focused-update/)
- [ASHP/PIDS/SIDP/IDSA VCM TDM](https://www.idsociety.org/practice-guideline/vancomycin/)
- [CDC血液培養汚染指標](https://www.cdc.gov/lab-quality/php/prevent-adult-blood-culture-contamination/primary-measure.html)
- [CDC Stewardship Core Elements](https://www.cdc.gov/antibiotic-use/hcp/core-elements/hospital.html)

詳しい候補文献と区分別の記述は `content/notes/review-source-topics.md`。

## 次の課題
- 医学的な一問ずつの根拠・正答のレビューと、日本国内の適用条件確認
- 回答結果の分野別集計・苦手問題の可視化
- 週次・日次学習ノートからの問題候補抽出（自動でverifiedにはしない）
- 端末間の安全な同期、実機iPhoneでの50問運用テスト

## 開発・テスト
```bash
node --check review-engine.mjs
node --check review-feature.mjs
node scripts/test-review-v2.mjs
node scripts/test-review-ui.mjs
```

この作業は別ブランチのドラフトPRで管理する。ユーザーの確認までmainにマージせず、本番サイトは変更しない。
