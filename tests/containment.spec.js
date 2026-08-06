import { test, expect } from '@playwright/test';

/**
 * Wave 1 regression suite — "the runtime does not silently destroy what it was asked to show".
 *
 * Three of these behaviours were blockers in the frontend design review, and all three share
 * a failure mode: the UI discarded information without saying so. Content taller than the
 * frame was clipped with no scrollbar; panels were `display:none`d at common viewport sizes;
 * and the outcome of an action existed for 4200ms and then did not. None of them threw, none
 * logged, and the existing smoke suite passed throughout — which is precisely why they need
 * assertions of their own rather than a visual check.
 *
 * The rule these encode: bounded is fine, clipped is not. A pane may constrain its content,
 * but the content must always remain reachable.
 */

const boot = async page => {
  await page.goto('/index.html?skipWelcome=1', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), {
    timeout: 15_000,
    message: 'runtime never booted',
  }).toBe(true);
};

test.describe('Wave 1 · scroll containment (finding 01)', () => {
  test('the main region is a real scroller, not a clip', async ({ page }) => {
    await boot(page);

    // shared/shell.js has always rendered `class="dgo-main dgo-scroll"`. Before this fix no
    // `.dgo-scroll` rule existed anywhere in the stylesheets and `.dgo-main` carried
    // `overflow:hidden !important`, so the class was a request the CSS never answered.
    const overflowY = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.dgo-main')).overflowY);
    expect(['auto', 'scroll']).toContain(overflowY);
  });

  test('content taller than the frame can be reached', async ({ page }) => {
    await boot(page);

    // Force genuine overflow rather than hoping a route supplies it, so the assertion is
    // about the container's behaviour and not about how much data happens to be seeded.
    const result = await page.evaluate(() => {
      const main = document.querySelector('.dgo-main');
      const probe = document.createElement('div');
      probe.style.cssText = 'block-size:4000px;inline-size:1px;';
      probe.dataset.overflowProbe = 'true';
      (main.querySelector('.route-stage') || main).appendChild(probe);
      const scrollable = main.scrollHeight > main.clientHeight + 1;
      main.scrollTop = 500;
      const moved = main.scrollTop;
      probe.remove();
      main.scrollTop = 0;
      return { scrollable, moved };
    });

    expect(result.scrollable, 'main never reports overflow, so its content is being clipped').toBe(true);
    expect(result.moved, 'main reports overflow but refuses to scroll to it').toBeGreaterThan(0);
  });

  test('the page itself still does not scroll, and the footer stays visible', async ({ page }) => {
    await boot(page);

    // The containment model this fix preserves: one scroller inside a fixed frame. If the
    // document scrolls, the footer leaves the viewport and the fix has overshot.
    const { docScrolls, footerInView } = await page.evaluate(() => {
      const footer = document.querySelector('.dgo-footer').getBoundingClientRect();
      return {
        docScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
        footerInView: footer.bottom <= window.innerHeight + 1 && footer.height > 0,
      };
    });

    expect(docScrolls, 'the page scrolls — the shell frame is no longer contained').toBe(false);
    expect(footerInView, 'the footer is not visible within the viewport').toBe(true);
  });
});

test.describe('Wave 1 · reflow instead of deletion (finding 02)', () => {
  // 1366×768 is the review's reference laptop; 1440×900 is the size the recreation was drawn
  // at. Both previously deleted the panel naming the product's own framing concept.
  for (const [w, h] of [[1440, 900], [1366, 768], [1280, 720]]) {
    test(`the four ingestion sources survive at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page);

      const strip = page.locator('.cc-source-strip');
      await expect(strip, 'the ingestion-sources panel is not rendered at all').toHaveCount(1);
      const display = await strip.evaluate(el => getComputedStyle(el).display);
      expect(display, `.cc-source-strip is display:none at ${w}x${h}`).not.toBe('none');
    });
  }

  test('every action card is kept at a short viewport', async ({ page }) => {
    // The `max-height:640px` rule removed `:nth-child(n+5)` — Dispatch & Archive, an entire
    // stage of the workflow — along with the body copy of every card.
    await page.setViewportSize({ width: 1280, height: 620 });
    await boot(page);

    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.action-card.cc-action'))
        .filter(el => getComputedStyle(el).display === 'none').length);
    const total = await page.locator('.action-card.cc-action').count();

    expect(total, 'the Command Center rendered no action cards').toBeGreaterThan(0);
    expect(hidden, 'action cards are being deleted to fit a short viewport').toBe(0);
  });

  test('the guidance panels are not deleted at a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await boot(page);

    const support = page.locator('.cc-support-panels');
    if (await support.count()) {
      const display = await support.evaluate(el => getComputedStyle(el).display);
      expect(display, '.cc-support-panels is display:none at 1280x700').not.toBe('none');
    }
  });
});

test.describe('touch-target floor (finding 20)', () => {
  /**
   * `--dgo-control-target-min` is 44px and is the platform's own declared minimum for
   * anything that receives pointer input. Three rules undercut it in the narrow
   * breakpoints — the sidebar items to 36px, the icon buttons to 34px, the persona button
   * to 40px — and they undercut it in the one context where the floor is load-bearing
   * rather than decorative: a touch device.
   *
   * The defect was invisible to review because it was not a contradiction on the page. The
   * token was set correctly at the declaration and overridden 300 lines later in a media
   * query, so both rules read as reasonable in isolation.
   *
   * Measured from the rendered result rather than asserted against the stylesheet text: the
   * property that matters is what a finger meets, and a future refactor is free to reach it
   * a different way.
   */
  const FLOOR = 44;

  for (const [w, h, label] of [[900, 500, 'phone landscape'], [1100, 700, 'small tablet']]) {
    test(`no navigation item falls below the touch floor at ${w}x${h} (${label})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page);

      const undersized = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.dgo-sidebar__item'))
          .map(el => ({ label: (el.textContent || '').trim().slice(0, 24), h: el.getBoundingClientRect().height }))
          .filter(x => x.h > 0 && x.h < 44));

      expect(undersized, `navigation items under ${FLOOR}px: ` +
        undersized.map(u => `${u.label}=${u.h.toFixed(1)}px`).join(', ')).toEqual([]);
    });

    test(`no topbar control falls below the touch floor at ${w}x${h} (${label})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page);

      const undersized = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.dgo-iconbtn,.dgo-search-trigger,.dgo-persona-button'))
          .map(el => {
            const r = el.getBoundingClientRect();
            return { sel: el.className, w: r.width, h: r.height };
          })
          .filter(x => x.w > 0 && x.h > 0 && (x.w < 44 || x.h < 44)));

      expect(undersized, `topbar controls under ${FLOOR}px: ` +
        undersized.map(u => `${u.sel}=${u.w.toFixed(0)}x${u.h.toFixed(0)}`).join(', ')).toEqual([]);
    });
  }
});

test.describe('Wave 1 · durable feedback (finding 03)', () => {
  test('a toast is recorded, survives a route change, and can be dismissed', async ({ page }) => {
    await boot(page);

    // Raise a message through the same entry point every module uses.
    await page.evaluate(() => document.querySelector('dgo-shell').toast('Dispatch recorded', 'success'));

    const trigger = page.locator('[data-notify-open]');
    await expect(trigger).toHaveCount(1);

    // The transient toast is gone well before this; the record must not be.
    await page.waitForTimeout(4600);
    await page.evaluate(() => { location.hash = '#/approvals'; });
    await page.waitForTimeout(400);

    await trigger.click();
    const panel = page.locator('[data-notify-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Dispatch recorded')).toBeVisible();

    await panel.locator('[data-notify-dismiss]').first().click();
    await expect(panel.getByText('Dispatch recorded')).toHaveCount(0);
  });

  test('an error raises an unread badge that clearing resolves', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => document.querySelector('dgo-shell').toast('Sync failed', 'error'));

    const badge = page.locator('[data-notify-badge]');
    await expect(badge, 'an error produced no unread badge').toBeVisible();
    await expect(badge).toHaveText('1');

    // Opening the panel is the act of reading; the badge must clear on it.
    await page.locator('[data-notify-open]').click();
    await expect(badge).toBeHidden();
  });

  test('history persists across a full reload', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => document.querySelector('dgo-shell').toast('Approval granted', 'success'));

    await page.reload({ waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__DGO_BOOTED__ === true), { timeout: 15_000 }).toBe(true);

    await page.locator('[data-notify-open]').click();
    await expect(page.locator('[data-notify-panel]').getByText('Approval granted')).toBeVisible();
  });
});

test.describe('Wave 1 · navigation states (finding 06)', () => {
  test('an unknown route explains itself rather than redirecting', async ({ page }) => {
    // Asserted because the review reported the opposite. The router has always rendered this
    // view; the test exists so that stays true.
    await boot(page);
    await page.evaluate(() => { location.hash = '#/not-a-real-route'; });
    await expect(page.locator('.dgo-main')).toContainText('Workspace not found');
    expect(page.url()).toContain('not-a-real-route');
  });

  test('the shell exposes a pending signal while a route mounts', async ({ page }) => {
    await boot(page);

    // The attribute is what the progress bar hangs off. Driving the timing directly keeps
    // this from being a race against a route that mounts in single-digit milliseconds.
    const held = await page.evaluate(async () => {
      const shell = document.querySelector('dgo-shell');
      shell.toggleAttribute('data-route-pending', true);
      const bar = getComputedStyle(shell.querySelector('.dgo-workarea'), '::after').content;
      shell.toggleAttribute('data-route-pending', false);
      return bar;
    });

    expect(held, 'no ::after is drawn for a pending route').not.toBe('none');
  });

  test('the outlet reports busy state to assistive technology', async ({ page }) => {
    await boot(page);
    const busy = await page.evaluate(() => document.querySelector('[data-outlet]').getAttribute('aria-busy'));
    expect(busy, 'the outlet never declares an aria-busy state').not.toBeNull();
  });
});
