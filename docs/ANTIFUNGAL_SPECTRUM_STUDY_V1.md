# AST Pocket：抗真菌薬スペクトル比較表（学習モード）

## 目的
2026年10月17日にChatGPTで学習した**抗真菌薬8行×主要真菌6列**の一覧表を、以前の「◎・○・△・×・※」という記号と主要な比較結果を保存したままAST Pocketへ取り込む。

元の比較表から薬剤群・菌種の組み合わせを変更せず、計48マスそれぞれについて、2026年10月25日までに確認できた原典を参考に一般的な医学上の注意を追加。

## 操作方法
1. [AST Pocket](https://tutumi2011kt-gif.github.io/ast-pocket/)を開き、**📘 学習モード**に切り替える。
2. Homeの**「💊 10月17日の学習表 → 抗真菌薬スペクトル一覧」**のボタンをタップ。あるいは学習モードの分野別ノート、抗真菌薬スペクトルの統合テーマ、または検索（「スペクトル」「MCFG」「FLCZ」など）から開く。
3. **すべて（比較表）**なら8行×6列を横スクロールで表示。薬剤名は左列に固定する。
4. **Candida glabrata**など菌種チップを選べば、その1列と全8薬剤だけを表示して比較しやすくする。
5. 表中の**◎・○・△・×**をタップすると、それぞれの組み合わせで注意すべきことを確認できる。

## 凡例と臨床安全

- **◎**：活性があり、臨床の重要な治療選択肢。**全病型で第一選択という意味ではない**（例：L-AMBはCandidaに広い活性がある一方、Candida血症の通常の初期選択はエキノキャンディン系）。
- **○**：活性あり、条件により選択肢。
- **△**：限定的な活性／不確実な位置づけ。
- **×**：基本的に臨床効果を期待しない。
- **※**：併用や代替薬など重要な条件がある（個別セルの説明を優先）。

**よくある誤解を防ぐための補足**

- C. kruseiはFLCZに自然耐性。FLCZがC. glabrataに対し常に有効という意味でもない。
- MCFG/CPFGはAspergillusに活性があっても侵襲性肺アスペルギルス症の通常の初期単剤治療の第一選択ではない。
- VRCZはMucoralesに活性がなく、ムーコル症の治療薬として使用しない。
- Cryptococcus髄膜炎の導入期ではL-AMBと5-FCの併用が重要。5-FCの単剤使用を勧める表ではない。
- PSCZ・ISCZはMucoralesに活性があり、病型・剤形・国内承認・併用治療・感染源管理によって判断する。
- 真菌種を6分類にまとめた暗記表であり、C. parapsilosis、C. auris、各Aspergillus種、耐性などの個別事情は網羅しない。

## 出典（2026年10月25日に確認）

1. [IDSA Candidiasis 2016](https://www.idsociety.org/practice-guideline/candidiasis/) — エキノキャンディン・C. glabrata・C. krusei・FLCZ step-down。
2. [IDSA Aspergillosis 2016](https://www.idsociety.org/practice-guideline/aspergillosis/) — VRCZ、ISCZ、L-AMB、エキノキャンディン系の位置づけ。
3. [ASM/ECMM/ISHAM Cryptococcosis 2024](https://www.idsociety.org/practice-guideline/Diagnosis-and-Management-of-Cryptococcosis/) — L-AMB＋5-FC導入、FLCZ。
4. [ECMM Mucormycosis 2019](https://www.ecmm.info/guidelines/mucormycoses-2019/) — L-AMB・PSCZ・ISCZと早期の感染源管理。

出典へのリンクと各セルの一般的な説明は、**個別患者での感受性・用法用量・国内添付文書の検証を保証しない**。本表は学習用ドラフトであり、医学的な最終レビューは別途必要。

## 実装と保守
- 元表・注釈：`content/spectrum/antifungal-2026-10.json`
- 検証および安全な表示：`antifungal-spectrum.mjs`
- Home・学習分野別ノート・検索ルーティング：`app.js`
- iPhone向け固定薬剤列・横スクロール・菌種フィルタ・セル内説明：`styles.css`
- 自動検査：`scripts/test-antifungal-spectrum.mjs` と `scripts/test-antifungal-spectrum-ui.mjs`
- **臨床モードでは表の記号・解説・薬剤と菌種の対応を非表示**。既存50問の学習状況やAmpC10問、過去のWeeklyには手を加えない。
- API使用・ChatGPT履歴の自動取得・医学的自動承認は行わない。
