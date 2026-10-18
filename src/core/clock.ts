import type { Stamp } from './types';

const MS_LEN = 9;
const CTR_LEN = 4;

function encode(ms: number, ctr: number, device: string): Stamp {
  return `${ms.toString(36).padStart(MS_LEN, '0')}.${ctr.toString(36).padStart(CTR_LEN, '0')}.${device}`;
}

function decode(stamp: Stamp): { ms: number; ctr: number } {
  const [ms, ctr] = stamp.split('.');
  return { ms: parseInt(ms, 36) || 0, ctr: parseInt(ctr, 36) || 0 };
}

/**
 * Hybrid logical clock: wall time when it moves forward, a counter when it
 * does not, and it never goes behind any stamp it has observed. That keeps a
 * device with a slow clock from losing edits made after it saw newer data.
 */
export class Clock {
  private ms = 0;
  private ctr = 0;

  constructor(
    readonly device: string,
    last: Stamp = '',
    private readonly wall: () => number = Date.now,
  ) {
    if (last) this.observe(last);
  }

  now(): Stamp {
    const t = this.wall();
    if (t > this.ms) {
      this.ms = t;
      this.ctr = 0;
    } else {
      this.ctr++;
    }
    return encode(this.ms, this.ctr, this.device);
  }

  observe(stamp: Stamp | undefined) {
    if (!stamp) return;
    const { ms, ctr } = decode(stamp);
    if (ms > this.ms || (ms === this.ms && ctr > this.ctr)) {
      this.ms = ms;
      this.ctr = ctr;
    }
  }

  /** Serializable position of the clock. */
  get last(): Stamp {
    return encode(this.ms, this.ctr, this.device);
  }
}

export function stampTime(stamp: Stamp | undefined): number {
  return stamp ? decode(stamp).ms : 0;
}
