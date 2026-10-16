# 0.9.1.4 手機閱讀器上線包

本部署包將閱讀器修改回移到官方 **v0.9.1.4** 的固定 commit `879b8b73eb41d66f88dde8eb874cc99a3397eb11`，共修改 11 個前端檔案。它不帶入 develop 的 Activity API 或其他開發版功能。

候選映像：`kavita-local:0.9.1.4-mobile-reader-20261014`。後端沿用目前的 `kavita-local:0.9.1.4-media-parser-fix`，Dockerfile 會驗證 Server/Services DLL 的 SHA256，保留既有 PDF xref 與 EPUB NAV 解析器修正。前端 1,245 個檔案也逐一驗證 SHA256。

## 目前狀態

映像建置、容器健康檢查、17 項隔離瀏覽器測試通過；測試涵蓋閱讀器、首頁、書庫、主題與設定。測試使用資料庫副本及自行產生的 EPUB/PDF 素材，沒有改寫正式資料庫的書籍或閱讀進度。啟動前後 EF 資料庫遷移紀錄相同，副本的 SQLite quick_check 為 ok。

**正式服務尚未切換。** 2026-10-15 已恢復 Books、Comics 掛載，候選映像對實際 NAS EPUB/PDF 的 17 項瀏覽器測試也全部通過。上線工具仍會再次檢查掛載與檔案可讀性。新增指定路徑 `/Volumes/Reference/Book_References` 的用途尚待確認，目前沒有改動該路徑或原資料位置。

完整證據在 [release report](../../docs/2026-10-14-kavita-release/README.md)。

## 上線

在專案根目錄執行。先重新掛載 Books 和 Comics，再跑唯讀預檢：

```sh
python3 tools/mobile-reader-release/release.py
```

檢查通過後，實際部署使用：

```sh
python3 tools/mobile-reader-release/release.py --apply
```

部署會再次備份資料庫與設定，以同一個 `kavita` 容器替換映像，沿用 **1314:5000**、原設定目錄與兩個唯讀 NAS 掛載。健康檢查失敗時會嘗試自動回滾。它不執行掃描、不新增常駐服務，也不升級後端資料庫結構。

已先建立備份：`data/config/backups/mobile-reader-release-20261014-234703/`。SQLite 備份在 Docker VM 內執行，與運行服務使用相同的 WAL 鎖定環境。設定、主題、模板等也會備份；封面保留在現有位置，這次前端部署不改寫封面。

## 回滾

```sh
python3 tools/mobile-reader-release/release.py --rollback
```

使用原本 `compose.yaml` 還原舊映像，並驗證 1314 健康狀態。資料庫格式未改變，回滾不會以舊資料庫覆蓋新的閱讀進度。原映像必須保留。

## 重建與重驗

```sh
python3 tools/mobile-reader-release/prepare.py
```

需要 Node/npm、Python 3、curl、patch 與 Docker。它會下載官方固定版本，檢查來源 SHA256，以零 fuzz 套用 `reader.patch`，依官方 lockfile 安裝依賴、編譯，再建置映像。`.build` 是產物，不提交至 Git。

重新建置會更新映像與 manifest；必須對新映像重做驗證並更新驗證紀錄。上線工具會拒絕使用與已驗證映像不一致的建置。

如需直接驗證候選前端，預覽工具支援 `KAVITA_PREVIEW_ROOT` 指向 `.build/wwwroot`。瀏覽器整合測試工具支援 `KAVITA_TEST_URL`、`KAVITA_TEST_DB` 等參數，見 [test instructions](../mobile-reader-tests/README.md)。驗證運行中的副本時，帳戶與書籍 ID 應從停止寫入的備份讀取；不要在容器運行時用主機 SQLite 修改它的資料庫檔案。
