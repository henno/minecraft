import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

/**
 * NoiseGenerator wraps simplex-noise with layered octaves for natural terrain.
 *
 * Uses 2D noise (NOT 3D) — height maps only. No caves in v1.
 * 3D noise is ~3x slower per sample; 2D is sufficient for surface terrain.
 *
 * Seeded with alea() for deterministic worlds.
 */
export class NoiseGenerator {
  private readonly noise2D: ReturnType<typeof createNoise2D>;

  constructor(seed: string = 'tseburek') {
    // alea(seed) returns a PRNG function; createNoise2D(prng) seeds the noise
    this.noise2D = createNoise2D(alea(seed));
  }

  /**
   * Sample terrain height at world-space (wx, wz).
   * Returns a value in [0, 1] where 0 = minimum terrain and 1 = maximum.
   *
   * Uses 4 octaves of simplex noise (FBM — Fractal Brownian Motion):
   *   Octave 1: large continental features  (scale 0.003, amplitude 0.5)
   *   Octave 2: hills and ridges            (scale 0.010, amplitude 0.3)
   *   Octave 3: surface roughness           (scale 0.030, amplitude 0.15)
   *   Octave 4: fine detail                 (scale 0.080, amplitude 0.05)
   *
   * Amplitudes sum to 1.0 so output stays in [0, 1] after normalisation.
   */
  sample2D(wx: number, wz: number): number {
    const n1 = this.noise2D(wx * 0.003, wz * 0.003) * 0.5;
    const n2 = this.noise2D(wx * 0.010, wz * 0.010) * 0.3;
    const n3 = this.noise2D(wx * 0.030, wz * 0.030) * 0.15;
    const n4 = this.noise2D(wx * 0.080, wz * 0.080) * 0.05;
    // noise2D returns [-1, 1]; sum and remap to [0, 1]
    return (n1 + n2 + n3 + n4 + 1.0) * 0.5;
  }
}
