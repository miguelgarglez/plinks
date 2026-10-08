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
let iosSwitch: HTMLInputElement | null = null;

function hasVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * iOS has no Vibration API. A checkbox with the `switch` attribute still trips
 * the Taptic Engine when toggled. Keep it offscreen (not display:none) so WebKit
 * treats the programmatic click as real.
 */
function iosTap(): void {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const id = 'plinks-haptic-switch';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;left:-100vw;top:0;width:2px;height:2px;opacity:0.01;overflow:hidden;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = input;
  }
  try {
    iosSwitch.click();
  } catch {
    /* ignore */
  }
}

function resolveTrigger(): TriggerFn | null {
  if (triggerFn) return triggerFn;
  if (typeof window === 'undefined') return null;
  try {
    // Do not gate on WebHaptics.isSupported — that is only navigator.vibrate,
    // which iPhone lacks. Always construct and call trigger.
    if (!engine) engine = new WebHaptics({ showSwitch: false });
    const vibrate = hasVibrate();
    triggerFn = (input) => {
      if (!vibrate) iosTap();
      return engine!.trigger(input);
    };
    return triggerFn;
  } catch {
    return null;
  }
}

/** Fire a named haptic. No-ops when the API throws. */
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
  if (fn === null) {
    engine = null;
    iosSwitch = null;
  }
}
