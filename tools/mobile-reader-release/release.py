#!/usr/bin/env python3
"""Read-only preflight by default; changing production requires --apply or --rollback."""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PROOF = ROOT / 'docs/2026-10-14-kavita-release/verification.json'
BASE = ['docker', 'compose', '-f', str(ROOT / 'compose.yaml')]
CANDIDATE = BASE + ['-f', str(ROOT / 'compose.mobile-reader.yaml')]


def command(args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def health(timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen('http://localhost:1314/api/health', timeout=5) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError('Production health check timed out.')


def preflight():
    metadata = json.loads((HERE / '.build/release.json').read_text())
    actual = command(['docker', 'image', 'inspect', metadata['image'], '--format', '{{.Id}}'])
    if actual != metadata['image_id']:
        raise RuntimeError('Candidate image changed after preparation.')
    proof = json.loads(PROOF.read_text())
    if proof['image_id'] != actual or not proof['isolated_verification_passed']:
        raise RuntimeError('Candidate has not passed isolated verification.')
    manifest_sha = hashlib.sha256((HERE / '.build/wwwroot.sha256').read_bytes()).hexdigest()
    if manifest_sha != metadata['frontend_manifest_sha256']:
        raise RuntimeError('Frontend manifest changed after preparation.')
    command(CANDIDATE + ['config', '--quiet'])
    current = command(['docker', 'inspect', 'kavita', '--format', '{{.Image}}'])
    if current not in [metadata['base_image_id'], actual]:
        raise RuntimeError('Production image differs from reviewed release.')
    print('PASS candidate image, verification record and Compose configuration')
    missing = []
    db = sqlite3.connect('file:' + str(Path(proof['backup_path']) / 'kavita.db') + '?mode=ro&immutable=1', uri=True)
    for share, prefix in [('Books', '/library/'), ('Comics', '/comics/')]:
        mount = Path('/Volumes') / share
        rows = db.execute('SELECT FilePath FROM MangaFile WHERE FilePath LIKE ? LIMIT 50', (prefix + '%',)).fetchall()
        readable = False
        if mount.is_dir():
            for row in rows:
                path = mount / row[0][len(prefix):]
                try:
                    with path.open('rb') as media:
                        readable = bool(media.read(1))
                    if readable:
                        break
                except OSError:
                    pass
        if not readable:
            missing.append(str(mount))
        else:
            print('PASS media files readable from ' + str(mount))
    db.close()
    if missing:
        raise RuntimeError('NAS mounts or media unavailable: ' + ', '.join(missing) + '. Production has not been changed.')
    health(10)
    print('PASS existing production health; ready to apply on port 1314')


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    if args.rollback:
        subprocess.run(BASE + ['up', '-d', '--no-build', 'kavita'], cwd=ROOT, check=True)
        health()
        print('Rollback healthy on port 1314.')
        return
    preflight()
    if not args.apply:
        return
    subprocess.run(['python3', str(HERE / 'backup.py')], cwd=ROOT, check=True)
    try:
        subprocess.run(CANDIDATE + ['up', '-d', '--no-build', 'kavita'], cwd=ROOT, check=True)
        health()
    except Exception:
        print('Deployment failed; attempting rollback to the original image.')
        subprocess.run(BASE + ['up', '-d', '--no-build', 'kavita'], cwd=ROOT, check=True)
        health()
        raise
    print('Mobile reader release healthy on port 1314.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error))
