#!/usr/bin/env python3
"""Exercise the real server, signed exports, crash recovery, and static assets."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

binary = Path(sys.argv[1]).resolve()
is_chess = binary.name == 'myelin-chess'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
base = f'http://127.0.0.1:{port}'

def request(path, body=None, expected=200, headers=None):
    payload = None if body is None else json.dumps(body).encode()
    h = {'X-Myelin-Client': 'game', 'Content-Type': 'application/json'}
    h.update(headers or {})
    req = urllib.request.Request(base + path, data=payload, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            status, content, info = response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        status, content, info = error.code, error.read(), error.headers
    assert status == expected, (path, status, content[:200])
    return json.loads(content) if 'application/json' in info.get('Content-Type', '') else content

with tempfile.TemporaryDirectory(prefix=binary.name + '-test-') as tmp:
    env = dict(os.environ, PORT=str(port), DATA_DIR=tmp + '/data')
    log = open(tmp + '/server.log', 'w+')
    process = None
    def start():
        p = subprocess.Popen([str(binary)], env=env, stdout=log, stderr=log)
        for _ in range(150):
            if p.poll() is not None:
                log.seek(0)
                raise AssertionError(log.read())
            try:
                request('/api/state')
                return p
            except urllib.error.URLError:
                time.sleep(.05)
        p.terminate()
        raise AssertionError('Server did not start')
    try:
        process = start()
        html = request('/').decode()
        assert '<canvas' in html if not is_chess else 'id="board"' in html
        for file in ['/app.js', '/style.css', '/audio.js', '/assets/music.mp3']:
            assert len(request(file)) > 100
        for file in (['study.png', 'pieces.png'] if is_chess else ['islands.png', 'characters.png']):
            assert request('/assets/' + file).startswith(b'\x89PNG')
        state = request('/api/state')
        initial = state
        invalid = {'type': 'move', 'uci': 'e2e5'} if is_chess else {'type': 'launch', 'dx': -999999999, 'dy': 0}
        def command(action, current, expected=200):
            return request('/api/action', {'action': action, 'expected_block': current['session']['block_hash'], 'session_id': current['session']['id']}, expected)
        command(invalid, state, 400)
        assert request('/api/state') == state
        request('/api/new', {}, 400, {'Origin': 'https://example.invalid'})
        if is_chess:
            for move in ['f2f3', 'e7e5', 'g2g4', 'd8h4']:
                state = command({'type': 'move', 'uci': move}, state)
            assert state['game']['result'] == 'BlackCheckmates'
            command({'type': 'move', 'uci': 'a2a3'}, state, 400)
        else:
            state = command({'type': 'launch', 'dx': -116, 'dy': 16}, state)
            assert state['game']['won']
            state = command({'type': 'next'}, state)
            state = command({'type': 'launch', 'dx': -116, 'dy': 20}, state)
            assert state['game']['won']
            state = command({'type': 'next'}, state)
            state = command({'type': 'launch', 'dx': -48, 'dy': 68}, state)
            state = command({'type': 'launch', 'dx': -116, 'dy': -16}, state)
            assert state['game']['won'] and state['game']['level'] == 3
        command(invalid, initial, 400)
        receipt = request('/api/replay', {})
        assert receipt['verified'] and receipt['frames'] == state['session']['actions']
        assert receipt['state_root'] == state['session']['state_root']
        export = request('/api/export')
        evidence = Path(tmp) / 'session.json'
        evidence.write_text(json.dumps(export))
        verified = subprocess.run([str(binary), 'verify', str(evidence)], capture_output=True, text=True, check=True)
        assert json.loads(verified.stdout)['state_root'] == state['session']['state_root']
        altered = dict(export)
        altered['blocks'] = list(export['blocks'])
        record = bytearray.fromhex(altered['blocks'][0])
        record[-1] ^= 1
        altered['blocks'][0] = record.hex()
        evidence.write_text(json.dumps(altered))
        assert subprocess.run([str(binary), 'verify', str(evidence)], capture_output=True).returncode != 0
        # Terminate without a graceful application shutdown: sync commits must recover.
        process.terminate()
        process.wait(timeout=10)
        process = start()
        assert request('/api/state') == state
        assert request('/api/replay', {})['verified']
        fresh = request('/api/new', {})
        assert fresh['session']['id'] != state['session']['id']
        assert fresh['session']['actions'] == 0
        if os.name == 'posix':
            assert (Path(tmp) / 'data/authority.key').stat().st_mode & 0o777 == 0o600
        print(f'{binary.name}: gameplay, assets, stale/illegal rejection, export verification, tamper rejection, and restart passed')
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        log.close()
