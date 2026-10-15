#!/usr/bin/env python3
"""Build the pinned official frontend with the reviewed reader backport. Does not deploy."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BUILD = HERE / '.build'
COMMIT = '879b8b73eb41d66f88dde8eb874cc99a3397eb11'
ARCHIVE_SHA = 'ea21e7b4fda9e0923b59ea698265403a9188237721879c3dc0b4b96752447a33'
BASE_IMAGE = 'kavita-local:0.9.1.4-media-parser-fix'
BASE_ID = 'sha256:2b5f6c8bb90b305e83ec3b2b25fc75aee1d6a0851a8ae084d586b648bc5efcec'
IMAGE = 'kavita-local:0.9.1.4-mobile-reader-20261014'


def run(*args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, check=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    BUILD.mkdir(exist_ok=True)
    actual = subprocess.check_output(['docker', 'image', 'inspect', BASE_IMAGE, '--format', '{{.Id}}'], text=True).strip()
    if actual != BASE_ID:
        raise SystemExit('Base image differs from reviewed release; stop and review.')
    archive = BUILD / 'official-source.tar.gz'
    run('curl', '-fL', f'https://codeload.github.com/Kareadita/Kavita/tar.gz/{COMMIT}', '-o', str(archive))
    if sha(archive) != ARCHIVE_SHA:
        raise SystemExit('Official source archive checksum mismatch.')
    with tempfile.TemporaryDirectory(prefix='source-', dir=BUILD) as task_dir:
        with tarfile.open(archive) as tar:
            top = tar.getmembers()[0].name
            tar.extractall(task_dir, filter='data')
        source = Path(task_dir) / top
        # Normalize patch targets only; the reviewed patch is generated against LF text.
        for line in (HERE / 'reader.patch').read_text().splitlines():
            if line.startswith('--- a/'):
                target = source / line[6:]
                target.write_text(target.read_text())
        run('patch', '--batch', '--forward', '--fuzz=0', '-p1', '-i', str(HERE / 'reader.patch'), cwd=source)
        web = source / 'UI/Web'
        run('npm', 'ci', '--legacy-peer-deps', '--ignore-scripts', '--no-audit', '--no-fund', cwd=web)
        run('npm', 'run', 'build', '--', '--configuration', 'production', cwd=web)
        destination = BUILD / 'wwwroot'
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(web / 'dist/browser', destination)
    files = sorted(p for p in destination.rglob('*') if p.is_file())
    manifest = BUILD / 'wwwroot.sha256'
    manifest.write_text(''.join(f'{sha(p)}  {p.relative_to(destination).as_posix()}\n' for p in files))
    run('docker', 'build', '-t', IMAGE, str(HERE))
    image_id = subprocess.check_output(['docker', 'image', 'inspect', IMAGE, '--format', '{{.Id}}'], text=True).strip()
    (BUILD / 'release.json').write_text(json.dumps({
        'official_commit': COMMIT, 'archive_sha256': ARCHIVE_SHA,
        'patch_sha256': sha(HERE / 'reader.patch'), 'frontend_manifest_sha256': sha(manifest),
        'frontend_files': len(files), 'base_image': BASE_IMAGE, 'base_image_id': BASE_ID,
        'image': IMAGE, 'image_id': image_id,
        'node': subprocess.check_output(['node', '--version'], text=True).strip(),
        'npm': subprocess.check_output(['npm', '--version'], text=True).strip(),
        'database_migration': False,
    }, indent=2) + '\n')
    print('Candidate image built; production has not been changed.')


if __name__ == '__main__':
    main()
