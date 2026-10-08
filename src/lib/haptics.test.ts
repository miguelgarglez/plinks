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
});
