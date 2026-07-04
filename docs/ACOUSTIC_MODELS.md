# Acoustic Models Reference

This document describes the mathematical models used in the simulation engine.
All formulas are ported from the mk2-reference-loudspeaker repository and
standard loudspeaker engineering references.

## Thiele-Small Parameters

### Sealed Box

Box volume:
```
Vb = Vas / ((Qtc/Qts)^2 - 1)
```

System resonance:
```
Fc = Fs * (Qtc / Qts)
```

-3 dB frequency:
```
F3 = Fc * f(Qtc)
```

where f(Qtc) is a function of the system Q:
- Qtc = 0.707 (Butterworth): F3 = Fc, maximally flat
- Qtc < 0.707 (overdamped): F3 > Fc, better transients
- Qtc > 0.707 (underdamped): F3 < Fc, bass peak

### Ported Box (Bass Reflex)

Alignments based on Qts:
- Qts < 0.38: QB3 (quasi-3rd-order Butterworth)
- Qts 0.38-0.55: SBB4 (4th-order Super Butterworth)
- Qts > 0.55: C4 (Chebyshev)

Port length:
```
L = (c / (2*pi*fb))^2 * A / Vb - 0.847 * sqrt(A/pi)
```
where A = port cross-section area, Vb = box volume, c = speed of sound

### Transmission Line

Line length (1/4 wavelength, adjusted for stuffing):
```
L = (c / (4*Fs)) * 0.85
```

Line area: typically 1-3x Sd (piston area)

## Baffle Step Diffraction

When wavelength > baffle dimension: omnidirectional (4pi)
When wavelength < baffle dimension: forward-focused (2pi)
Transition: +6dB shelf centered at:

```
f_step = c / (2*pi*baffle_dimension)
```

Model: first-order shelf filter + edge diffraction ripples

## Crossover Filters

### Biquad implementation

2nd-order Butterworth:
```
H(s) = wc^2 / (s^2 + s*wc/Q + wc^2)
Q = 1/sqrt(2) for Butterworth
```

Linkwitz-Riley = (Butterworth)^2:
- LR2: Q=0.5, 12 dB/oct
- LR4: 2x BW2 cascaded, 24 dB/oct
- LR8: 4x BW2 cascaded, 48 dB/oct

### Transfer function evaluation

```
H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
```

Magnitude at frequency f:
```
|H(e^jw)| where w = 2*pi*f/fs
```

## Piston Directivity

Circular piston in infinite baffle:
```
P(theta) = 2 * J1(k*a*sin(theta)) / (k*a*sin(theta))
```
where k = 2*pi*f/c, a = piston radius, J1 = Bessel function

- Low freq / small piston: P ≈ 1 (omnidirectional)
- High freq / large piston: narrow beam with sidelobes

## Spinorama (CEA-2034)

Standard curves from horizontal + vertical off-axis data:
- On-Axis: 0° H, 0° V
- Listening Window: ±10° H/V average (9 points)
- Early Reflections: weighted average of floor, ceiling, side wall, front/back wall reflections
- Sound Power: solid-angle-weighted average of all angles
- Directivity Index: On-axis - Sound Power
- Predicted In-Room: weighted combination

## Vertical Lobing

Two sources separated by distance d at crossover frequency fc:
```
theta_null = arcsin(lambda / (2*d))
```
where lambda = c/fc

First null occurs when path difference = half wavelength.
For LR4 (even order): sources in-phase, null at 90° when d = lambda/2
