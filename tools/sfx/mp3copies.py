# mp3 copies of the loops, the last the game asks for (goosesounds.ts), for a device that decodes no Ogg: a gap at the
# wrap, if its decoder leaves one, and not a silence. Made from the masters: each checked against the ogg the game
# ships, so a master that has since changed stops it.
#   python ../tools/sfx/mp3copies.py
# Run from _sfx/, where the masters are kept out of git, after ambience.py, swarm.py or build.py.
import os
import subprocess
import numpy as np

GAME = os.path.join('..', 'public', 'sounds', 'goose')
SR = 48000
# Each loop and where it is made from: wind and leaves came from the tree page with no master, only their ogg.
LOOPS = {
    'fire_crackling': os.path.join('master', 'fire_crackling.wav'),
    'fire_calm': os.path.join('master', 'fire_calm.wav'),
    'river_calm': os.path.join('master', 'river_calm.wav'),
    'winch_3': os.path.join('master', 'winch_3.wav'),
    'swarm_far': os.path.join('swarm', 'swarm_far.wav'),
    'swarm_near': os.path.join('swarm', 'swarm_near.wav'),
    'swarm_edge': os.path.join('swarm', 'swarm_edge.wav'),
    'wind': os.path.join(GAME, 'wind.ogg'),
    'leaves': os.path.join(GAME, 'leaves.ogg'),
}


def decoded(path):
    """The file as mono floats at SR."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def same_sound(a, b, name):
    """Stops unless the two are one sound, whatever a coder's delay has moved it by."""
    n = min(len(a), len(b), SR * 10)
    x, y = a[:n], b[:n]
    spectrum = np.fft.irfft(np.fft.rfft(x, 2 * n) * np.conj(np.fft.rfft(y, 2 * n)))
    match = np.abs(spectrum).max() / (np.linalg.norm(x) * np.linalg.norm(y) + 1e-12)
    if match < 0.9:
        raise SystemExit(f'{name}: its master is not what the game ships (match {match:.3f})')
    return match


for name, source in LOOPS.items():
    shipped = os.path.join(GAME, name + '.ogg')
    match = same_sound(decoded(source), decoded(shipped), name)
    mp3 = os.path.join(GAME, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', source, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-q:a', '4', mp3], check=True)
    print(f'{name:16s} match {match:.3f}  ogg {os.path.getsize(shipped) // 1024:4d} KB  mp3 {os.path.getsize(mp3) // 1024:4d} KB')
