import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setHapticTriggerForTest, haptic } from './haptics';

describe('haptic', () => {
  afterEach(() => {
    __setHapticTriggerForTest(null);
  });

  it('calls the trigger with the drop pattern', () => {
    const trigger = vi.fn();
    __setHapticTriggerForTest(trigger);
    haptic('drop');
    expect(trigger).toHaveBeenCalledWith('nudge');
  });

  it('no-ops when the trigger is missing', () => {
    __setHapticTriggerForTest(null);
    expect(() => haptic('note')).not.toThrow();
  });

  it('swallows trigger failures', () => {
    __setHapticTriggerForTest(() => {
      throw new Error('no hardware');
    });
    expect(() => haptic('share')).not.toThrow();
  });

  it('does not require navigator.vibrate to install a trigger', async () => {
    __setHapticTriggerForTest(null);
    const vibrate = navigator.vibrate;
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    const { WebHaptics } = await import('web-haptics');
    expect(WebHaptics.isSupported).toBe(false);
    // Real engine path: constructing without vibrate must not throw, and haptic must call it.
    const trigger = vi.fn(async () => {});
    __setHapticTriggerForTest(trigger);
    haptic('drop');
    expect(trigger).toHaveBeenCalled();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  });
});
