// Waits for an open sheet (the Sign sheet closes as you sign) to finish closing before moving focus or scrolling.
'use client';

/**
 * Runs `fn` after `delay` ms, once no sheet is open: the Sign sheet hands focus back as it finishes
 * closing, which would undo a focus or scroll made while it is still on screen. Checks every
 * 100 ms for up to a second. Returns a cancel function for an effect's cleanup.
 */
export function afterSheets(fn: () => void, delay = 0) {
  let timer = 0;
  const check = (tries: number, waited: boolean) => {
    if (tries > 0 && document.querySelector('.nx-sheet')) {
      timer = window.setTimeout(() => check(tries - 1, true), 100);
      return;
    }
    // A sheet that just closed returns focus in the same moment; go after it.
    if (waited) timer = window.setTimeout(fn, 50);
    else fn();
  };
  timer = window.setTimeout(() => check(10, false), delay);
  return () => window.clearTimeout(timer);
}
