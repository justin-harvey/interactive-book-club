// Optional "Support Isotopia" link — a Ko-fi / GitHub Sponsors / Stripe Payment
// Link URL injected at BUILD TIME from the SUPPORT_URL env var (see
// rollup.config.*.js; only https:// URLs are accepted). Leave it unset and every
// support link in the game and teacher portal stays hidden, so forks and
// un-configured builds show nothing.
//
// The in-app links go to our own support.html (what the project is, what support
// pays for), which holds the actual payment button — nobody is sent straight to a
// payment page from inside the game.

declare const process: { env: Record<string, string | undefined> };

export const SUPPORT_URL: string = process.env.SUPPORT_URL || '';

export function supportEnabled(): boolean {
    return SUPPORT_URL.length > 0;
}

/** Relative link to the support/about page (works from index.html and teacher.html). */
export const SUPPORT_PAGE = 'support.html';
