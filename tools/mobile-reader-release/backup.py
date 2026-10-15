#!/usr/bin/env python3
"""Create a consistent online database backup and deployment rollback metadata."""
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'data/config'


def main():
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    target = CONFIG / 'backups' / ('mobile-reader-release-' + stamp)
    target.mkdir(mode=0o700)
    # Run SQLite in the Docker VM so WAL locking uses the same OS as the server.
    backup_code = """import sqlite3,os
source=sqlite3.connect('file:/config/kavita.db?mode=ro',uri=True,timeout=30)
destination=sqlite3.connect('/backup/kavita.db')
source.backup(destination,pages=4096)
assert destination.execute('PRAGMA quick_check').fetchall()==[('ok',)]
destination.close();source.close();os.chmod('/backup/kavita.db',0o600)
print('SQLite online backup check: ok')
"""
    subprocess.run(['docker', 'run', '--rm', '--network', 'none',
        '--mount', f'type=bind,source={CONFIG},target=/config,readonly',
        '--mount', f'type=bind,source={target},target=/backup',
        'python:3.12-alpine', 'python', '-c', backup_code], check=True)
    os.chmod(target / 'kavita.db', 0o600)
    for name in ['appsettings.json', 'themes', 'templates', 'fonts', 'images', 'bookmarks', 'favicons']:
        original = CONFIG / name
        if original.is_dir():
            shutil.copytree(original, target / name)
        elif original.is_file():
            shutil.copy2(original, target / name)
            os.chmod(target / name, 0o600)
    shutil.copy2(ROOT / 'compose.yaml', target / 'compose.yaml')
    image = json.loads(subprocess.check_output(['docker', 'inspect', 'kavita', '--format',
        '{"image":"{{.Config.Image}}","image_id":"{{.Image}}"}'], text=True))
    (target / 'rollback.json').write_text(json.dumps({
        **image, 'database_check': 'ok', 'database_backup': 'SQLite online backup',
        'covers': 'Existing covers retained; frontend-only release does not modify them.',
        'rollback': 'docker compose -f compose.yaml up -d --no-build kavita',
    }, indent=2) + '\n')
    print(target)


if __name__ == '__main__':
    main()
