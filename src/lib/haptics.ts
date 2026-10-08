import { WebHaptics, type HapticInput } from 'web-haptics';

export type HapticKind = 'drop' | 'note' | 'replay' | 'share' | 'tap';

const patterns: Record<HapticKind, HapticInput> = {
  drop: 'nudge',
  note: 'selection',
  replay: 'medium',
  share: 'rigid',
  tap: 'light',
};

type TriggerFn = (input?: HapticInput) => void | Promise<void>;

let engine: WebHaptics | null = null;
let triggerFn: TriggerFn | null = null;

function resolveTrigger(): TriggerFn | null {
  if (triggerFn) return triggerFn;
  if (typeof window === 'undefined') return null;
  try {
    if (!WebHaptics.isSupported) return null;
    if (!engine) engine = new WebHaptics();
    triggerFn = (input) => engine!.trigger(input);
    return triggerFn;
  } catch {
    return null;
  }
}

/** Fire a named haptic. No-ops when the API is missing or throws. */
export function haptic(kind: HapticKind = 'tap'): void {
  const t = resolveTrigger();
  if (!t) return;
  try {
    void t(patterns[kind]);
  } catch {
    /* unsupported / interrupted */
  }
}

/** Test seam. Pass null to restore the real engine. */
export function __setHapticTriggerForTest(fn: TriggerFn | null): void {
  triggerFn = fn;
  if (fn === null) engine = null;
}
