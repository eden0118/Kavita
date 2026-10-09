# 在 OrbStack 執行 Kavita

此設定執行官方發行映像 `jvmilazz0/kavita:latest`。

在本專案目錄執行：

```sh
docker --context orbstack compose up -d
```

開啟 http://localhost:1314，首次使用時建立管理員帳號。

手機連到與電腦相同的區網後，可開啟 `http://192.168.1.200:1314`。這是目前電腦的區網 IP；若 IP 改變，可用 `ipconfig getifaddr en0` 查詢。手機上的 `localhost` 代表手機本身，請使用電腦的 IP。

書籍來源為 NAS 的 `smb://192.168.1.250/Books`，在 macOS 掛載到 `/Volumes/Books`；在 Kavita 新增書庫時選擇容器內的 `/library`。書籍資料以唯讀方式掛載。帳號、資料庫和設定儲存在本機 `data/config/`，已排除於 Git。

漫畫來源為同一台 NAS 的 `smb://192.168.1.250/Comics`，在 macOS 掛載到 `/Volumes/Comics`，以唯讀方式掛載到容器內的 `/comics`。在 Kavita 新增漫畫書庫時選擇 `/comics` 或其中的子資料夾，並依內容選擇 Manga、Comic 等書庫類型。

啟動前請先在 Finder 掛載 NAS：

```sh
open smb://192.168.1.250/Books
open smb://192.168.1.250/Comics
```

確認 `/Volumes/Books` 和 `/Volumes/Comics` 都已掛載後，再執行 `docker --context orbstack compose up -d`。設定會在來源資料夾不存在時拒絕建立容器，避免產生空的本機資料夾。電腦重新開機後若 NAS 尚未掛載，請先掛載，再執行 `docker --context orbstack compose up -d --force-recreate`。

常用操作：

```sh
# 查看狀態
docker --context orbstack compose ps

# 查看日誌
docker --context orbstack compose logs --tail 100 kavita

# 停止服務（保留資料）
docker --context orbstack compose down

# 更新官方映像並重啟；更新前請備份 data/config
docker --context orbstack compose pull
docker --context orbstack compose up -d
```

服務會在 OrbStack 啟動後自動重啟（除非手動停止），將容器 5000 連接埠發布到電腦自訂的 1314，供本機及區網裝置存取。

官方安裝文件：https://wiki.kavitareader.com/installation/docker/
