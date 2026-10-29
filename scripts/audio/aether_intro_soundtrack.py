"""Original procedural soundtrack for the AETHER intro (no samples, no third-party music).

  python scripts/audio/aether_intro_soundtrack.py <out.wav>
  ffmpeg -i out.wav -af loudnorm=I=-20:TP=-2:LRA=11 -ar 48000 -codec:a libmp3lame -b:a 160k public/audio/aether-intro.mp3

Cue times come from src/lib/intro-timeline.json so sound, Blender animation and the web
overlay share one clock. Pure numpy: additive synthesis, state-variable filters, FFT reverb.
"""

import json
import os
import sys
import wave

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(ROOT, "src", "lib", "intro-timeline.json"), encoding="utf-8") as fh:
    TL = json.load(fh)
CUE = TL["cues"]
SR = 48000
DUR = TL["duration"] + 1.5
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(1028)


def env(points):
    """Piecewise-linear envelope from (time, value) pairs."""
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def smooth(e0, e1):
    x = np.clip((t - e0) / (e1 - e0), 0, 1)
    return x * x * (3 - 2 * x)


def saw(freq, harmonics=24, detune=0.0):
    phase = 2 * np.pi * np.cumsum(np.broadcast_to(freq * (1 + detune), t.shape)) / SR
    out = np.zeros(N)
    for n in range(1, harmonics + 1):
        out += np.sin(n * phase + rng.random() * 6.28) / n
    return out


def sine(freq, phase0=0.0):
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(freq, t.shape)) / SR + phase0)


def svf(x, cutoff, q=0.7, mode="lp"):
    """Time-varying state-variable filter (Chamberlin)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    f = 2 * np.sin(np.pi * np.minimum(cutoff, SR / 6) / SR)
    low = band = 0.0
    out = np.empty_like(x)
    damp = 1 / q
    for i in range(len(x)):
        low += f[i] * band
        high = x[i] - low - damp * band
        band += f[i] * high
        out[i] = low if mode == "lp" else band if mode == "bp" else high
    return out


def onepole(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def pan(x, p):
    p = np.broadcast_to(p, x.shape)
    return np.stack([x * np.cos((p + 1) * np.pi / 4), x * np.sin((p + 1) * np.pi / 4)])


def burst(start, length, attack=0.005):
    """Envelope for a one-shot event."""
    a = np.clip((t - start) / attack, 0, 1)
    d = np.exp(-np.maximum(t - start, 0) / length)
    return np.where(t >= start, a * d, 0.0)


def pluck(freq, start, length=1.2, level=0.2, bright=4):
    e = burst(start, length, 0.004)
    tone = sum(np.sin(2 * np.pi * freq * k * (t - start)) * (0.6**k) for k in range(1, bright + 1))
    return tone * e * level


mix = np.zeros((2, N))
send = np.zeros((2, N))  # reverb bus

# 1 ─ low cinematic bed: sub + slow D-minor pad whose filter opens with the reveal
sub = (sine(36.71) * 0.5 + sine(73.42) * 0.35) * env([(0, 0), (1.2, 0.5), (12.8, 0.75), (14.0, 1.0), (17.2, 0.5), (DUR, 0)])
mix += pan(sub * 0.16, 0)
chord = [73.42, 110.0, 146.83, 174.61, 220.0]
pad = np.zeros(N)
for i, f in enumerate(chord):
    for d in (-0.004, 0.0, 0.0045):
        pad += saw(f, harmonics=22 if f < 120 else 14, detune=d) * (0.75 if i < 2 else 0.55)
cut = env([(0, 160), (CUE["crane"], 380), (CUE["chase"], 900), (CUE["pullback"], 1700), (CUE["logo"], 2600), (DUR, 700)])
pad = svf(pad / 12, cut, q=0.9)
pad *= env([(0, 0), (0.6, 0.25), (CUE["crane"], 0.5), (CUE["chase"], 0.65), (CUE["logo"] - 0.6, 0.5), (CUE["logo"], 0.95), (16.4, 0.8), (DUR, 0)])
mix += pan(pad * 0.5, np.sin(t * 0.21) * 0.3)
send += pan(pad * 0.25, 0)

# 2 ─ system activation: soft FM chime and a rising sine glide
fm_env = burst(CUE["wake"], 1.4, 0.02)
mod = np.sin(2 * np.pi * 1320 * (t - CUE["wake"])) * 1.1 * burst(CUE["wake"], 0.35)
chime = np.sin(2 * np.pi * 880 * (t - CUE["wake"]) + mod) * fm_env * 0.045
glide = sine(env([(0, 220), (CUE["wake"], 220), (CUE["wake"] + 0.9, 880), (DUR, 880)])) * burst(CUE["wake"] + 0.15, 0.6, 0.25) * 0.035
mix += pan(chime + glide, -0.2)
send += pan((chime + glide) * 1.6, 0.2)

# 3 ─ pulse: the scan wave leaving the drone pad
p0 = CUE["pulse"]
thoom = sine(env([(0, 70), (p0, 70), (p0 + 0.6, 42), (DUR, 42)])) * burst(p0, 0.7, 0.01) * 0.3
air = svf(rng.standard_normal(N), env([(0, 3000), (p0, 3000), (p0 + 1.4, 500), (DUR, 500)]), 1.4, "bp") * burst(p0, 0.9, 0.05) * 0.05
mix += pan(thoom, 0) + pan(air, np.clip((t - p0) * 0.8 - 0.6, -0.7, 0.7))
send += pan(air * 2, 0)

# 4 ─ camera whooshes (crane rise, final pull-back)
for start, length, peak in ((CUE["crane"], 2.2, 0.09), (CUE["pullback"] - 0.1, 2.0, 0.07)):
    centre = env([(0, 250), (start, 250), (start + length * 0.55, 2400), (start + length, 600), (DUR, 600)])
    shape = np.clip((t - start) / (length * 0.55), 0, 1) ** 2 * np.exp(-np.maximum(t - start - length * 0.55, 0) / (length * 0.3))
    shape = np.where(t >= start, shape, 0)
    w = svf(rng.standard_normal(N), centre, 1.8, "bp") * shape * peak
    mix += pan(w, np.clip((t - start) / length * 1.4 - 0.7, -0.7, 0.7))
    send += pan(w * 0.8, 0)

# 5 ─ rotors: four slightly detuned motors spool up; restrained, receding as the camera pulls away
spool = smooth(CUE["spinup"], CUE["spinup"] + 1.2)
bpf = 18 + 77 * spool + 6 * smooth(CUE["liftoff"], CUE["liftoff"] + 0.8)  # blade-pass frequency
rotor = np.zeros(N)
for k, det in enumerate((0.0, 0.013, -0.009, 0.021)):
    ph = sine(bpf * (1 + det), k)
    rotor += ph * 0.5 + sine(bpf * 2 * (1 + det)) * 0.25 + sine(bpf * 6.2 * (1 + det)) * 0.08
hiss = svf(rng.standard_normal(N), 1800, 0.8, "bp") * (0.6 + 0.4 * sine(bpf))
rotor_level = spool * env([(0, 1), (CUE["chase"], 1), (CUE["chase"] + 1.5, 0.55), (CUE["pullback"], 0.5), (CUE["pullback"] + 2.5, 0.08), (DUR, 0)])
r = (svf(rotor / 4, 900, 0.7) + hiss * 0.15) * rotor_level * 0.13
mix += pan(r, np.clip(np.sin(t * 0.9) * 0.3, -0.4, 0.4))
send += pan(r * 0.3, 0)

# 6 ─ scanning: a quiet swept tone with fine accelerating ticks travelling left → right
s0, s1 = CUE["scan"], CUE["incident"] + 1.2
sweep = sine(env([(0, 520), (s0, 520), (s1, 1240), (DUR, 1240)])) * (smooth(s0, s0 + 0.3) - smooth(s1 - 0.3, s1)) * 0.018
ticks = np.zeros(N)
tt = s0
gap = 0.16
while tt < s1:
    ticks += np.sin(2 * np.pi * 2600 * (t - tt)) * burst(tt, 0.006, 0.0005) * 0.05
    tt += gap
    gap = max(0.05, gap * 0.92)
mix += pan(sweep + ticks, np.clip((t - s0) / (s1 - s0) * 1.6 - 0.8, -0.8, 0.8))
send += pan((sweep + ticks) * 1.5, 0)

# 7 ─ illustrative disruption flagged: a soft mallet interval, then the route resolves upward
mix += pan(pluck(440.0, CUE["incident"], 1.4, 0.06) + pluck(349.23, CUE["incident"] + 0.2, 1.6, 0.06), 0.3)
send += pan(pluck(440.0, CUE["incident"], 1.4, 0.08), 0)
for i, f in enumerate((293.66, 349.23, 440.0, 587.33)):
    p = pluck(f, CUE["route"] + i * 0.13, 1.1, 0.045, 3)
    mix += pan(p, -0.4 + i * 0.25)
    send += pan(p * 1.5, 0)

# 8 ─ reveal: reverse swell into a soft impact, then an open D-major shimmer (resolution)
L = CUE["logo"]
swell = svf(rng.standard_normal(N), env([(0, 300), (L - 1.2, 300), (L, 5000), (DUR, 5000)]), 0.9) * np.where(t < L, np.clip((t - (L - 1.2)) / 1.2, 0, 1) ** 3, 0) * 0.08
impact = sine(env([(0, 58), (L, 58), (L + 0.5, 36), (DUR, 36)])) * burst(L, 0.9, 0.004) * 0.42
knock = onepole(rng.standard_normal(N) * burst(L, 0.05, 0.001), 600) * 0.5
shimmer = sum(saw(f, 8, d) for f in (293.66, 369.99, 440.0, 659.25) for d in (-0.003, 0.003)) / 12
shimmer = svf(shimmer, env([(0, 800), (L, 800), (L + 1.2, 3800), (DUR, 2000)]), 0.8) * (smooth(L, L + 0.4) * env([(0, 1), (16.3, 1), (DUR, 0)])) * 0.12
tag = pluck(880.0, CUE["tagline"], 2.2, 0.03, 2) + pluck(1318.5, CUE["tagline"] + 0.09, 2.0, 0.018, 2)
mix += pan(swell, 0) + pan(impact + knock, 0) + pan(shimmer, 0) + pan(tag, 0.15)
send += pan(swell * 1.2 + shimmer * 1.4 + tag * 2 + knock * 0.4, 0)

# reverb: decorrelated exponentially decaying noise, darkened over time
irn = int(SR * 3.2)
it = np.arange(irn) / SR
ir = []
for ch in range(2):
    noise = rng.standard_normal(irn) * np.exp(-it / 0.85)
    ir.append(onepole(noise, 5200) * 0.03)
size = 1 << int(np.ceil(np.log2(N + irn)))
wet = np.stack([np.fft.irfft(np.fft.rfft(send[c], size) * np.fft.rfft(ir[c], size), size)[:N] for c in range(2)])
out = mix + wet * 0.55

# master: gentle fade, soft clip, -1 dBFS peak
out *= env([(0, 0), (0.05, 1), (DUR - 1.2, 1), (DUR, 0)])
out = np.tanh(out * 1.4) / 1.4
out *= 10 ** (-1 / 20) / np.max(np.abs(out))
path = sys.argv[1] if len(sys.argv) > 1 else "aether-intro.wav"
with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out.T * 32767).astype("<i2").tobytes())
print("WROTE", path, f"{DUR:.1f}s", "rms", float(np.sqrt(np.mean(out**2))))
