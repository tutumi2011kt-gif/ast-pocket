# 復習問題50問：原典突合 第1回（2026-10-11）

50問版は本番へ公開済み。ここでは、**医学的な誤情報を減らすための原典照合作業**を別ブランチで開始する。

## 原典との照合結果（6問）

| 問題ID | 出典 | 編集上の暫定評価 | 次に確認したい点 |
|---|---|---|---|
| `mssa-persistent` | [IDSA/ESCMID SAB Consensus 2026](https://www.idsociety.org/practice-guideline/staphylococcus-aureus-bacteremia/) | 全体的には整合 | 再血培48時間以降の陽性に対する感染源評価と、抗菌薬再評価の根拠を分ける |
| `mssa-followup-self` | 同上 Statement 2 | 全体的には整合 | 血培陰性化を確認する頻度と治療期間の起点、適用集団を明確化 |
| `infection-candida-follow` | [IDSA Candidiasis 2016](https://www.idsociety.org/practice-guideline/candidiasis/) Recommendation 11 | 原典に具体的記載あり | 陰性化確認の頻度（毎日か隔日）と非好中球減少患者の対象条件 |
| `infection-candida-duration` | 同上 Recommendation 12 | **補足が必要** | 合併症のない血症では「血培陰性化と症状消失後2週間」の条件を、正答と解説へ明示 |
| `tdm-vcm-auc` | [ASHP/PIDS/SIDP/IDSA VCM 2020](https://www.idsociety.org/practice-guideline/vancomycin/) Executive Summary | 原典に具体的記載あり | 重症MRSA感染症、MIC=1mg/Lという前提、AUC24 400–600 mg·h/L、他病態への外挿禁止 |
| `infection-cuti-oral` | [IDSA cUTI 2025](https://www.idsociety.org/practice-guideline/complicated-urinary-tract-infections/) IV-to-oral Recommendation I | 条件付きで整合 | 改善、内服可能、有効な経口薬、除外条件・尿路閉塞や感染源管理 |

記録の機械可読版：`content/review/evidence-audit-2026-10-11.json`

## ここでは実施しないこと

- **人による原典レビューがまだない段階での `verified` 化**
- 50問を黙って書き換え、既存の回答履歴の意味を変えること
- 国内の添付文書や診療実務を確認せず、海外指針を一律に国内推奨として扱うこと
- 医学的な結論を、URLの存在・引用だけから自動確定すること

今回の記録はAIが公開ページの本文と設問を照合した**編集上の予備確認**であり、担当薬剤師等の独立した医学的承認ではない。現時点の正式承認数は **0/50問**。特に Candida 血症の期間に関する解説は、次回の問題改訂候補として優先する。

## 次の手順

最終確認担当者が原典本文（対象患者、ガイドラインの改訂日、推奨番号、条件、国内適用）と各設問の正答を照合する。必要な設問は問題バージョンを更新し、旧履歴とは区別する。適用条件と引用箇所・レビュー者・日付・注記がそろったもののみ、別PRで `verified` に格上げする。確認状況をユーザーが追えるよう、次のUI段階で「候補」「原典確認済み」を明確に区別する。
