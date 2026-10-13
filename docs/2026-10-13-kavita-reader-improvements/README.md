# Kavita 手機閱讀器優化

完成於 2026-10-14。這一輪依照手機閱讀器稽核，優先改善翻頁、工具列、返回與下一章。

## 已實作

- EPUB 手機工具列改成返回、系列／章節標題與「更多」選單。主要按鈕與選單項目至少 44px，圖示按鈕有可讀名稱。
- PDF 使用同樣的手機導覽，將頁碼、主題、版面等操作放入文字選單；完整 PDF 工具列可透過進階工具開啟，桌面仍保留原工具列。
- PDF 底部新增上一章／下一章、頁碼、最後一章完成提示，以及章節查詢失敗的重試。切換章節保留無痕與閱讀清單參數。
- 返回閱讀器入口；直接開啟閱讀網址時，返回該章節所屬系列，避免依瀏覽器歷史退到其他系列。
- EPUB/PDF 章節載入失敗會顯示重試與返回選項。EPUB 翻頁失敗重試同一頁；失敗時隱藏無效頁碼。章節查詢失敗也會解除載入狀態。
- 關閉「更多」選單的 Esc 不再同時觸發退出閱讀器；選單內鍵盤操作與閱讀快捷鍵分開處理。
- 舊後端缺少選用的 Activity API 時，停止該頁面的後續快照請求，保留既有即時通知。其他 404 與登入錯誤照常處理。

## 驗證

Angular production build 通過，13 項瀏覽器整合檢查全部通過，沒有未處理的 JavaScript 例外。實際 Chromium 瀏覽器對本機 production build 和現有後端執行整合測試，測試結果見 [regression-results.json](regression-results.json)。

手機寬度涵蓋 320、390、430px，桌面涵蓋 1440px。驗證翻頁、選單觸控尺寸／可讀名稱、Esc、返回正確系列、PDF 實際渲染／頁碼輸入／下一章保留無痕模式，以及模擬 HTTP 500 後重試。NAS 檔案和已存閱讀進度不會因測試改寫。

截圖：[EPUB 手機](epub-390.png)、[EPUB 選單](epub-menu.png)、[EPUB 錯誤恢復](epub-info-error.png)、[PDF 手機](pdf-390.png)、[PDF 選單](pdf-menu.png)、[PDF 桌面](pdf-desktop.png)。

網路紀錄中的 book-info/book-page 500 是測試刻意注入。user-cover 404 是既有缺少頭像；Activity 404 表示目前部署的後端未提供該選用 API。這些沒有被列為已修復的媒體或後端問題。

## 部署狀態與範圍

本次完成原始碼和 production build；localhost:1314 的容器尚未替換前端。這份 checkout 的前端比目前 0.9.1.4 後端新，已處理這次遇到的 Activity 相容性差異，但沒有驗證所有管理功能的跨版本相容性。部署時需選擇相同版本的完整前後端，或另外完成舊版前端的回移驗證，不能把閱讀器測試通過視為全站版本相容。

驗證工具及重跑說明位於 [tools/mobile-reader-tests](../../tools/mobile-reader-tests/README.md)。測試使用臨時本機預覽伺服器，不建立新的 OrbStack 服務。這輪未處理其他頁面的大型資訊架構調整，也未以實體 iPhone/Safari 驗證；觸控測試使用 Chromium 模擬。
