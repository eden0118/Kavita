# 手機閱讀器上線準備結果

上線候選映像已完成，官方前後端版本均為 0.9.1.4，並保留目前部署的解析器修正。**目前尚未切換 1314。2026-10-15 NAS 已恢復，候選版本對實際書籍的 17 項瀏覽器測試也全部通過。**

- 候選映像：`kavita-local:0.9.1.4-mobile-reader-20261014`
- 官方前端 commit：`879b8b73eb41d66f88dde8eb874cc99a3397eb11`
- 生產後端 Server/Services DLL 校驗與候選映像一致。
- 1,245 個前端檔案逐一校驗通過。
- 候選容器健康檢查通過；17 項瀏覽器檢查通過，沒有未處理 JavaScript 例外。
- 資料庫副本 quick_check 為 ok，EF 遷移紀錄在啟動前後一致。
- 最新一致性備份：`data/config/backups/mobile-reader-release-20261014-234703/`。
- 驗證容器與本機預覽服務已關閉並移除，目前保留原服務。

閱讀器驗證使用自行產生的 EPUB/PDF 測試素材，配合正式資料庫的隔離副本；截圖中的閱讀內容不代表 NAS 原檔。最初 NAS 尚未掛載，因此先使用合成素材驗證；恢復掛載後，已另外完成同一候選映像對實際 NAS EPUB/PDF 的完整驗證。上線預檢會再次檢查來源可讀性。

網路紀錄中的三個 book-info/book-page 500 是故障注入，用來驗證重試；其餘紀錄為既有缺少使用者頭像的 404。相容版本不再請求 develop 專用的 Activity API。

[實際 NAS 驗證結果](real-nas/regression-results.json) · [部署／回滾步驟](../../tools/mobile-reader-release/README.md) · [映像與驗證紀錄](verification.json) · [瀏覽器結果](regression-results.json) · [預檢結果](preflight.txt)

截圖：[EPUB](epub-390.png)、[PDF](pdf-390.png)、[主題頁](smoke--theme.png)、[設定頁](smoke--settings.png)。

新增指定路徑 `/Volumes/Reference/Book_References` 已確認可讀，內有書籍／教材；用途待使用者確認，目前未變更掛載設定、資料庫位置或書庫註冊。
