/**
 * lighthouse.mjs — the four category scores plus the lab Core Web Vitals.
 *
 * Runs against its own Chromium, launched with a remote debugging port and
 * nothing else open. Sharing the browser with the axe pass would be cheaper and
 * would also mean measuring performance on a warmed cache with another tab
 * alive next door, which makes the number a story rather than a measurement.
 *
 * Default Lighthouse config = mobile emulation with throttling. That is the
 * right default here: a prospect's customers are mostly on phones, and the
 * good/needs-improvement/poor bands below are the mobile ones.
 */
import net from 'node:net';
import lighthouse from 'lighthouse';
import { launchBrowser } from './collect.mjs';

/** Google's published thresholds. good ≤ first, poor > second. */
export const CWV_BANDS = {
  lcp: { good: 2500, poor: 4000, unit: 'ms' },
  cls: { good: 0.1, poor: 0.25, unit: '' },
  tbt: { good: 200, poor: 600, unit: 'ms' },
};

export function bandFor(metric, value) {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  const b = CWV_BANDS[metric];
  if (value <= b.good) return 'good';
  if (value <= b.poor) return 'needs-improvement';
  return 'poor';
}

export async function runLighthouse(url, { timeoutMs }) {
  const port = await freePort();
  const browser = await launchBrowser([`--remote-debugging-port=${port}`]);

  try {
    const { lhr } = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      maxWaitForLoad: timeoutMs,
    });

    if (lhr.runtimeError?.code && lhr.runtimeError.code !== 'NO_ERROR') {
      throw new Error(lhr.runtimeError.message ?? lhr.runtimeError.code);
    }

    const score = (id) => {
      const raw = lhr.categories?.[id]?.score;
      return raw == null ? null : Math.round(raw * 100);
    };
    const numeric = (id) => {
      const v = lhr.audits?.[id]?.numericValue;
      return Number.isFinite(v) ? v : null;
    };

    const lcp = numeric('largest-contentful-paint');
    const cls = numeric('cumulative-layout-shift');
    const tbt = numeric('total-blocking-time');

    return {
      lighthouseVersion: lhr.lighthouseVersion,
      fetchTime: lhr.fetchTime,
      finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? url,
      formFactor: lhr.configSettings?.formFactor ?? 'mobile',
      scores: {
        performance: score('performance'),
        accessibility: score('accessibility'),
        bestPractices: score('best-practices'),
        seo: score('seo'),
      },
      metrics: {
        lcp: { value: lcp, band: bandFor('lcp', lcp), unit: 'ms' },
        cls: { value: cls, band: bandFor('cls', cls), unit: '' },
        tbt: { value: tbt, band: bandFor('tbt', tbt), unit: 'ms' },
        // Context, not headline numbers.
        fcp: { value: numeric('first-contentful-paint'), unit: 'ms' },
        speedIndex: { value: numeric('speed-index'), unit: 'ms' },
      },
      // The one SEO fact Lighthouse decides better than a regex over the head.
      isIndexable: lhr.audits?.['is-crawlable']?.score === 1,
      error: null,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
