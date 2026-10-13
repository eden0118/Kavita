# Kavita：手機閱讀 Human-Centered UI Audit

## 文件資訊

| 項目 | 內容 |
|---|---|
| 日期 | 2026-10-13，Asia/Taipei |
| 原始碼 | commit `0e4467307`；UI package 為 Angular 22，package version 欄位為舊值 0.7.12.1，不作部署版本依據 |
| 執行版本 | compose 指向 `kavita-local:0.9.1.4-media-parser-fix`，本次檢查 localhost:1314 現有部署 |
| 使用者優先任務 | 翻頁、工具列、返回、接續下一章；次要為找書與繼續閱讀 |
| 範圍 | 手機模擬 320×844、390×844、430×844、844×390；首頁、系列頁、PDF、EPUB；Manga 讀取器僅靜態檢查 |
| 方式 | 文件優先探索、原始碼、Chromium/Brave 無頭瀏覽器、截圖、DOM hit box、accessibility tree、翻頁及返回、注入 500 |
| 變更範圍 | 產出分析與稽核文件；以 incognitoMode 開閱讀器，攔截 reader 非 GET 寫入；不驗證進度持久化 |
| 未涵蓋 | 實體 iPhone Safari／Android Chrome、VoiceOver／TalkBack、完整鍵盤走查、真實章末與全庫閱讀、對比測量、文字 200%／400% 縮放、手機鍵盤與安全區、所有主題 |

## 執行摘要

主要問題集中在閱讀控制、方向感、格式間一致性及錯誤恢復。已確認頁面能在所測 viewport 維持整頁寬度，EPUB 下一頁成功從 1/155 變成 2/155；「手機完全不能用」不是本次結論。改善優先為：縮減第一層工具列並增大高頻 hit box、補 EPUB 按鈕名稱、明確顯示作品與章節、定義返回契約、替 PDF 加章節接續、增加就地重試。

沒有證據支持先全面換皮或增加動畫。建議使用既有服務及選單，逐步改善；不需要購買 Kavita+ 才能修改這些本地 UI。無障礙方面有明確的控制名稱缺失，但本報告不宣稱已完成 WCAG 2.2 AA 合規或法律判定。

## 專案文件依據

先檢查根目錄及祖先 AGENTS.md，未發現適用檔案。稽核開始時沒有 docs/、doc/ 或同義的需求／設計目錄；檔名探索未發現現行 PRD、Design、Requirements、研究或 persona。本次新建立的 docs 是交付物，不倒推為既有需求。

| 文件 | 角色與可信度 | 採用依據／差異 |
|---|---|---|
| README.md | 現行產品描述，中高可信度 | 承諾跨裝置 responsive reader、連續閱讀、可自訂首頁與側欄；不是已驗證可用性成果 |
| UI/Web/README.md | 開發說明，中等可信度 | Angular CLI 11 說明與現行 Angular 22 package 不一致；避免把舊 README 当現行 UI 規格 |
| compose.yaml | 本機部署事實，高可信度 | 1314→5000、config 持久化、NAS 唯讀；不能單靠它證明瀏覽器已載入所有 repo UI 改動 |
| tools/media-parser-fix/README.md | 解析器修復紀錄，高可信度但窄範圍 | PDF／EPUB 解析與完整性檢查；不是手機設計需求 |
| 使用者本次回覆 | 本次稽核任務來源，高可信度 | 將閱讀器翻頁／工具列／返回／接續下一章放在第一優先；不推測其他使用者的偏好 |

原始碼與部署並非同一份完整前端 build。下列每項都注明静態或執行證據；例如 repo 的新 Activity widget 已有 aria-live／中斷工作／待執行區，不能沿用之前舊版的抱怨而聲稱目前 repo 完全沒做狀態回饋。

## Kavita 架構與任務地圖

[互動架構圖](2026-10-13-kavita-analysis/architecture.html)｜[架構圖驗證回條](2026-10-13-kavita-analysis/architecture-delivery.json)

圖是本機部署與邏輯服務摘要，節點不代表各自獨立容器，連線不是完整 API sequence。解析服務供閱讀快取與背景掃描共用。核心事實：

- Angular 負責手機導覽、卡片及三種閱讀器；閱讀內容不需要經 Kavita+。
- ASP.NET Core 的 BookController／ReaderController 處理權限、章節資訊、PDF／EPUB 內容與進度。`BookService`、`CacheService` 處理原檔與快取。
- EF Core 使用 `config/kavita.db`（Kavita.Database/Extensions/ApplicationServiceExtensions.cs:33），保存目錄、系列、章節及閱讀資料。
- Hangfire 同一應用程式執行背景工作；Startup.cs:202–217 使用 InMemoryStorage，勿誤畫成 durable SQLite 工作佇列。重啟後工作狀態及排程恢復需另外驗證。
- SignalR `hubs/messages`（Startup.cs:387）傳送狀態。圖把事件發布歸在後端，沒有假設 SQLite 自己直接推通知。
- NAS 是唯讀來源；config 目錄包含快取、封面、資料庫與備份。系統備份不取代 NAS 原檔備份。

| 任務 | 入口與主要步驟 | 成功、等待、錯誤、離開 | 覆蓋 |
|---|---|---|---|
| 找書／續讀 | 首頁 On Deck → 卡片 → 詳情 → Read | 長標題及 hover 閱讀快捷入口；詳情可見 Read | 執行與靜態；搜尋開鍵盤未測 |
| EPUB 翻頁 | 章節連結 → info／進度／目錄 → 正文 → Next Page | 實測 1/155→2/155；500 時欠缺就地恢復 | 執行、AX tree、故障注入 |
| PDF 閱讀 | 章節連結 → PDF.js 類讀取器 → 下載與繪製 → 頁級控制 | 能顯示漫畫；載入中可見正文；密集工具列 | 多 viewport 執行；完整下載耗時未量測 |
| 接續下一章 | EPUB／Manga 有章節導航；PDF 缺章節級入口 | 應分清本頁／本章結束及最後一章 | 靜態；真實章末未測 |
| 離開閱讀器 | Close Reader → ReaderService.closeReader | 依 history 返回，直接連結可回另一作品 | 執行與靜態；外站歷史未測 |
| 管理與掃描 | 管理者 Activity／書庫操作 | 完成、問題、中斷與待執行有不同狀態 | 靜態與歷史背景；本次不觸發掃描 |

## 面向總覽

| 面向 | 狀態 | 證據與首要改善 |
|---|---|---|
| 情感設計 | 需改善 | 故障時沒有可理解的恢復畫面；信任影響為合理推論，先改善狀態而非增加裝飾 |
| 行為設計 | 需改善 | 翻頁能成功，但工具尺寸、返回與跨章控制不一致 |
| 認知設計 | 需改善 | 手機書名隱藏、圖示過多、頁與章的層級不夠明確 |
| 簡約設計 | 需改善 | PDF 第一層控制過密；不是全站卡片都要刪除 |
| 無障礙 | 不通過（已檢查的 EPUB 控制名稱） | AX tree 有 5 個空名稱按鈕；其他準則未完成全站驗證 |

## 重要發現

### R01｜PDF 手機工具列過密，觸控目標偏小

- 位置：`UI/Web/src/app/pdf-reader/_components/pdf-reader/pdf-reader.component.html:56`。
- 面向：行為／認知／簡約。
- 嚴重度：P1。
- 證據信心：已確認。
- 證據：mobile-pdf-320.png；mobile-runtime.json 的 mobile-pdf-320／mobile-pdf-landscape；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：320 px 寬度可見 11 個工具按鈕；多數為 24×27 或 24×29 CSS px。橫向可見按鈕增至 18 個。
- 使用者影響：手機閱讀的高頻任務與縮放、雙頁、主題、快捷鍵等控制共占第一層；單手誤觸風險是合理推論，尚無實際使用者的誤觸率。
- 改善建議：第一層保留「返回、章節／頁碼、更多」，低頻設定移到既有抽屜或底部選單。高頻觸控區採至少 44×44 CSS px，保持閱讀畫面可用面積；不要只放大圖示。
- 驗證方式：在 320／390／430 px 及橫向測量 hit box；以單手完成開書、換頁、跳頁、返回；計錄任務時間與誤觸。44 px 是本次 UX 目標與 SC 2.5.5 AAA 強化目標，AA SC 2.5.8 是 24 px 並有間距例外，不能因 27 px 高就宣稱 AA 失敗。
- 參考依據：https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html。

### R02｜EPUB 多個控制沒有可存取名稱

- 位置：`UI/Web/src/app/book-reader/_components/book-reader/book-reader.component.html:60`。
- 面向：無障礙／行為。
- 嚴重度：P1。
- 證據信心：已確認。
- 證據：mobile-runtime.json → accessibility → book；mobile-book-390.png；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：Chrome accessibility tree 的 8 個 EPUB 按鈕中，5 個 name 為空。原始碼的選單、書籤、註記、目錄、關閉按鈕僅含 aria-hidden 圖示，沒有 aria-label 或隱藏文字。
- 使用者影響：使用 VoiceOver／TalkBack 或語音控制時難以辨識操作；這是明確的名稱缺失，尚未執行真正的 screen reader 流程。
- 改善建議：改用具有翻譯鍵的原生 button，加上 aria-label；「更多」可減少常駐圖示，但不能犧牲名稱、展開狀態及焦點返回。
- 驗證方式：逐一查 accessibility tree，名稱不得空白或只叫 button；補做 VoiceOver／TalkBack、Tab／Enter／Space 及關閉後焦點返回測試。
- 參考依據：https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html。

### R03｜手機 EPUB 隱藏作品脈絡與不記錄進度模式

- 位置：`UI/Web/src/app/book-reader/_components/book-reader/book-reader.component.scss:97`。
- 面向：認知／行為。
- 嚴重度：P1。
- 證據信心：已確認。
- 證據：mobile-book-390.png；HTML:65–84 的書名與 incognito 指示放在 center-group；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：875 px 以下 center-group 為 display:none，書名與同群組的 incognito 指示一併消失。實測頂列只有圖示，頁碼在底列。
- 使用者影響：跨章、切換格式或從分享連結開書後，需要額外確認自己在哪一本；對進度是否記錄的疑惑屬合理推論。
- 改善建議：頂列保留短書名＋當前章節；點擊可開章節選擇。不記錄進度用獨立可見狀態，勿隨書名一起隱藏。小螢幕只在次要區域收合作者等資訊。
- 驗證方式：320 px 下可辨識作品／章節，長書名可展開完整內容；切到不記錄模式後狀態持續可見，橫直向切換不得遺失。
- 參考依據：https://www.nngroup.com/articles/ten-usability-heuristics/。

### R04｜PDF 缺少與其他格式一致的接續下一章入口

- 位置：`UI/Web/src/app/pdf-reader/_components/pdf-reader/pdf-reader.component.ts:315`。
- 面向：行為／一致性。
- 嚴重度：P1。
- 證據信心：已確認（靜態功能差異）；章末實測未完成。
- 證據：PDF HTML 的 multiToolbar 與 TS 全檔；對照 manga-reader.component.html:143–155 與 BookReader TS:1211；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：PDF 有頁級控制，但這個元件沒有取得／載入下一章的流程；getNextChapterUrl 的唯一呼叫是切換 incognito 模式。Manga 與 EPUB 已有章節接續實作。
- 使用者影響：使用者每讀完一個 PDF，需要重新找下一卷的可能性較高；本次沒有讀完 178 頁或實際測試章末，因此不把實際所需點擊數寫成已確認。
- 改善建議：共用 ReaderService 的 getNextChapter／getPrevChapter，將 PDF 也接入章節級控制。章末顯示「本章結束、下一章名稱、繼續閱讀」，沒有下一章時顯示已讀完；不可默默把下一頁變成新章而不提示。
- 驗證方式：以兩章小型 fixture 驗證每種格式：第一章尾端、最後一章、讀取失敗、閱讀清單模式、不記錄進度模式。確認新章名稱、頁碼與進度歸屬都正確。
- 參考依據：https://www.nngroup.com/articles/ten-usability-heuristics/。

### R05｜關閉閱讀器依瀏覽歷史返回，脈絡可能不一致

- 位置：`UI/Web/src/app/_services/reader.service.ts:377`。
- 面向：行為／認知。
- 嚴重度：P1。
- 證據信心：已確認機制；期望影響為合理推論。
- 證據：mobile-runtime.json → interactions：PDF 關閉回 Series 1189；EPUB 1215 關閉也回 Series 1189；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：closeReader 在 history.length>1 時直接 location.back()，沒有判斷前一筆是否屬於本作品／本應用。實測先在 Series 1189，再直接開 Series 1215 的 EPUB，關閉回到 Series 1189。
- 使用者影響：這是現行「回上一個瀏覽位置」機制，不一定對每位使用者都錯；但按鈕叫關閉時，返回目標不明，分享連結與連續讀章的結果容易難以預測。
- 改善建議：定義返回契約：一般從書架進入時保存合法的站內 returnUrl 和捲動位置；直接連結／無有效入口時回本作品章節列表。將「返回入口」與「上一章」分開，避免只以全域 history.length 判斷。
- 驗證方式：測試書架→閱讀、搜尋→閱讀、分享連結、跨章 replaceState、外站歷史、閱讀清單；返回後卡片位置與焦點恢復。本次普通 PDF 返回成功應保留。
- 參考依據：https://www.nngroup.com/articles/ten-usability-heuristics/。

### R06｜開書失敗沒有就地錯誤恢復狀態

- 位置：`UI/Web/src/app/book-reader/_components/book-reader/book-reader.component.ts:998`。
- 面向：行為／情感／無障礙。
- 嚴重度：P1。
- 證據信心：已確認（瀏覽器注入故障＋靜態證據）。
- 證據：mobile-error-runtime.json；mobile-book-error-500.png；error.interceptor.ts:119–136；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：在測試瀏覽器攔截 book-info，回 500＋空 JSON，5 秒後仍是空白閱讀區及工具列，無可見原因、重試或返回文字。外層 subscribe 沒有 error handler；內層 forkJoin 失敗則 200 ms 後關閉。通用 interceptor 的某分支只記 console。
- 使用者影響：使用者無法分辨等待、檔案失敗與連線問題；此前使用者貼過類似 500，是歷史背景，不能等同本次自然發生的故障。信任影響為合理推論。
- 改善建議：使用 loading／ready／error 狀態，所有初始化鏈結有取消與錯誤處理。錯誤頁保留作品、章節、目前進度，提供「重試」「回章節列表」；若只缺目錄可降級閱讀，避免所有 forkJoin 失敗都退出。
- 驗證方式：在瀏覽器分別注入 info／chapters／progress 失敗、斷線與恢復；狀態應可讀、可重試且成功後恢復正文。失敗不得保存錯誤章節進度或無理由自動離開。
- 參考依據：https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html。

### R07｜書架快速閱讀依賴 hover，手機辨識成本較高

- 位置：`UI/Web/src/app/cards/entity-card/entity-card.component.scss:191`。
- 面向：行為／認知。
- 嚴重度：P2。
- 證據信心：已確認樣式與可見性；操作影響為合理推論。
- 證據：首頁實測 cardReadVisible:false；entity-card.component.html:80–97；CSS:209–219；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：閱讀快捷按鈕預設 display:none，hover 才顯示。手機可點封面進詳情，不是整張卡片不能使用；但「直接繼續閱讀」不是常駐可見操作。另有 300–1000 ms 長按選取邏輯。
- 使用者影響：高頻接續閱讀需辨認封面、詳情與閱讀入口；長按誤入選取的風險未做使用者測試，不認定必然發生。
- 改善建議：只在「繼續閱讀」卡片提供常駐、具文字的閱讀操作或整卡明確續讀；一般書架維持點擊詳情。保留大量選取，但改明確模式或入口，不新增每張卡片上的全套操作。
- 驗證方式：touch 裝置且 hover:none 時，不靠懸停完成續讀；比較首頁續讀步驟、長按、垂直／橫向捲動，並保留桌面鍵盤操作。
- 參考依據：https://www.nngroup.com/articles/ten-usability-heuristics/。

### R08｜長標題只有截斷與 hover 提示，手機难以分辨版本

- 位置：`UI/Web/src/app/cards/entity-card/entity-card.component.scss:66`。
- 面向：認知／簡約。
- 嚴重度：P2。
- 證據信心：已確認樣式與畫面；混淆影響為合理推論。
- 證據：mobile-home-390.png；entity-card.component.html:126–138；附件位於 `docs/2026-10-13-kavita-analysis/`。
- 問題：卡片標題 white-space:nowrap／overflow:hidden，完整標題依 tooltip。首頁可見 Hello,_He...，中文多卷／同名不同格式也需要辨識。
- 使用者影響：縮短標題雖節省空間，但失去辨識資訊；本次沒有測量使用者選錯作品的比率。
- 改善建議：手機允許兩行標題，保留格式標籤；章節卡片優先顯示卷／章號。一般卡片進詳情後顯示全名，不以更多 badge 補救截斷。
- 驗證方式：以長繁中、長英文、同名 PDF／EPUB 及系列＋章節名稱驗證可辨識性，不產生整頁橫向溢出。
- 參考依據：https://www.nngroup.com/articles/ten-usability-heuristics/。

## 過度設計刪除測試

| 元素 | 支援的價值 | 建議 | 移除風險 |
|---|---|---|---|
| PDF 多個常駐設定按鈕 | 進階閱讀個人化 | 收進既有更多選單，保留少數高頻控制 | 不可刪除縮放、選取等能力；鍵盤與可存取操作仍要存在 |
| EPUB 快捷鍵說明按鈕 | 桌面學習／外接鍵盤 | 手機降級到更多選單 | 行動裝置也可能接鍵盤，不能因手機模式彻底刪除 |
| 作品與章節標題 | 閱讀方向感 | 保留、縮短顯示並可展開 | 刪除會增加記憶負擔，不能以簡約為理由隱藏 |
| 頁码、章末狀態 | 進度與接續 | 保留，區分頁與章 | 頁碼不能完全由不透明手勢取代 |
| 系列頁 metadata／rating | 判斷是否閱讀 | 更多資料漸進揭露；Read 保持醒目 | 年齡限制與重要識別資訊不可一律收合 |
| 封面卡片、格式標籤、On Deck | 找書與辨識／恢復任務 | 保留；縮減重複角標與 hover-only 操作 | 改成單純列表未必適合漫畫，需真實使用者驗證 |
| 更多／設定 drawer | 承載低頻功能 | 優先重用，避免每項設定增加新 dialog | 層層選單會抵銷減少常駐圖示的收益 |

## 建議的手機閱讀操作契約

這是待實作的最小改善方案，不是已部署 UI：

1. 頂列：**返回、短書名＋章節、更多**。更多面板保留目錄／章節、書籤／註記和依格式適用的設定。工具的可存取名稱一致。
2. 阅讀中：正文為主，轻觸中央切換控制顯隱。左右翻頁需尊重阅讀方向；连續滾動、分頁、長條漫画分別維持适合的行為，不硬把 PDF 與文字 EPUB 改成完全相同的排版。
3. 底列：上一頁、頁码／跳頁、下一頁；高频觸控區至少 44×44，分頁模式有可見替代操作。手機安全區與瀏覽器工具列實機驗證後調整。
4. 章末：顯示下一章名稱與「繼續閱讀」；不存在下一章時明確告知讀完。等候與失敗都保留返回及重試。
5. 返回：使用明確的站內阅讀入口资料與 scroll/focus 恢復；直接連結以本作品為 fallback。進度失败要可見，不能為簡化画面而假報「已保存」。

優先調整現有 `book-reader`、`pdf-reader`、`manga-reader` 的外層操作，再復用 `ReaderService` 章節查詢。不要在同一次優化中重寫 PDF.js、EPUB 排版或 metadata parser。後端章節解析、檔案分組及本次 UI 摩擦應分別驗證。

## 無障礙查核摘要

| 項目 | 狀態 | 證據／準則 |
|---|---|---|
| 語意與名稱 | EPUB 控制不通過；其他部分檢查 | AX tree 5 空名稱；SC 4.1.2。全站名稱未完整檢查 |
| 觸控目標 | 需改善 | PDF 多數約 24×27、EPUB 44×36；44 px 是本次 UX／AAA 目標，不冒稱全數違反 AA 2.5.8 |
| 鍵盤與焦點 | 部分靜態，完整未檢查 | 卡片 read span 有 Enter 而無 Space；建議原生 button／APG Button Pattern；未執行完整 Tab 流程 |
| reflow | 所測整頁未溢出；完整準則未檢查 | 320／390／430／844 viewport 的 scrollWidth 不超過 innerWidth；不等于正文、所有控制或 400% zoom 均符合 SC 1.4.10 |
| 狀態與錯誤 | 阅讀初始化需改善 | 故障注入沒有可見重試；repo Activity 與搜尋已使用 aria-live，應保留；SC 4.1.3 |
| 減少動態 | 靜態已存在；執行未檢查 | styles.scss:145–150 已有 prefers-reduced-motion，不建议再加入干扰動画 |
| 對比、200% 文字放大、VoiceOver／TalkBack | 未檢查 | 截圖不能替代對比測量或 screen reader 實測 |
| 安全區、鍵盤、PWA、瀏覽器底部工具列 | 未檢查 | index.html:7 未設定 viewport-fit=cover，源码未見 safe-area-inset 使用；僅是待實機驗證项，不能據此認定內容必被遮挡 |

## 值得保留的設計

- 多格式讀者、目錄、書籤、註記、阅讀方向與连續章節已有基礎，優化不應刪除這些能力。
- EPUB 下一頁實际成功，PDF 可以顯示漫画；所測整頁無橫向溢出。
- On Deck 為接續阅讀提供入口；首頁／侧栏可自訂，應该優先調整已有排序。
- 搜寻元件有 combobox、listbox、aria-activedescendant、loading 與 live status（repo 新實現），保留這些語意。
- repo Activity widget 已區分离線、工作、問題、待執行、中斷狀態及 live announcement；改善入口辨識比重建第二個工作面板更适合。
- Reduced motion 與不記錄進度模式已有基礎。

## 改善順序

### 立即處理

1. R02：补 EPUB 按钮的名稱與原生語意；以 AX tree 和鍵盤檢查。
2. R01、R03：簡化手機第一層工具列、增大 hit box、保留章節脉络與 incognito 狀態；不同時更改阅讀排版。
3. R06：将所有初始化失败收敛為可重试錯誤画面；保留內容上下文。

### 下一階段

1. R04：PDF 接上章節級導航及所有格式一致的章末卡片。
2. R05：定義入口返回契約、恢復捲動／焦點，區分返回與上一章。
3. R07、R08：完善可見續讀、两行標題與移動端選擇模式。

### 觀察與驗證

- 真機 Safari／Chrome 先各走完「找書→打開→翻頁→下一章→返回→再次續讀」，再評估是否需要底部全站導航；当前證據不足以直接全面改成 App tab bar。
- 用短章節與錯誤 fixture 驗證邊界，避免反覆讀完大型漫画。進度持久化须在測试资料库驗證，不能把本次被拦截的寫入当成功保存。
- 記錄相同任務的完成率、操作數、錯誤數與返回位置；沒有基線數據前不宣稱某改版減少百分之几操作。

## 交付與驗證

- 架構 HTML、JSON、SHA256 回條、四張深淺色截圖及 browser receipt 位于同一附件目錄。
- Archify `deliver`：9/9 showcase，0 errors／0 warnings；`visual-check`：1440×900、1600×1000、1920×1080、2048×1320 全部 containment 通過。
- 四张端點深／浅色架构截圖经圖像檢查，未見遮挡、交叉或明顯空白下带；小尺寸上下文文字仍宜使用 Viewer zoom 阅讀。此审查不构成 UI 無障礙合规。
- 圖文為繁體中文；Archify 固定 Viewer UI 與 html lang 回退英文，未設置 unsupported zh-TW locale。
- 手機 DOM 證據：`mobile-runtime.json`；模拟故障：`mobile-error-runtime.json`；各 viewport 截圖與翻頁後截圖同目錄。照片與書名属本地资料，未上传外部服務。
- 所用 headless 瀏覽器以独立 profile 运行併在 finally 關閉，不新增常驻容器或服務。

## 參考依據

- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
- https://www.w3.org/WAI/ARIA/apg/patterns/button/
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- https://www.w3.org/WAI/WCAG22/Understanding/reflow.html

## 限制與未確認事項

本報告提供既有介面的分析與建議，並非新介面設計稿、效能基準或完整 WCAG 合规評估。截圖主要是現有深色主題；僅架构 Viewer 两种主題都驗證。未實測圖像／CBZ 的 Manga reader、最後一章、弱網整檔下载、撤销、真實辅助技术或 iPhone 瀏海／home indicator。關閉返回到先前作品的行為已重現，但使用者對不同入口的预期還需驗證。章節接續差異由源代码證實，未将未執行的章末流程寫成實測結果。報表中的 UX 指標均是建议驗收，不是已经取得的使用者研究數據。
