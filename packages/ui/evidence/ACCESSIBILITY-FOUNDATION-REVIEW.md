# W01 accessibility foundation review

- **Checkpoint:** 2026-07-16
- **Scope:** design primitives and canonical Bun application template
- **Status:** `accessibility-foundation-review` accepted by human disposition on 2026-07-16

## Foundation delivered

- semantic `Button`, skip link, live status and section/article surface primitives;
- visible keyboard focus, 44 px minimum action target and padded header navigation targets;
- light/dark tokens, forced-colors borders and reduced-motion overrides;
- useful SSR/static landmarks, headings, navigation and links without JavaScript;
- progressive enhancement hides the inert action until hydration succeeds;
- no remote font, icon, stylesheet, script, CDN, cookie or tracker.

This is intentionally a small foundation, not an exhaustive component catalogue.

## Automated browser evidence

Playwright runs nine scenarios:

| Capability | Engines |
| --- | --- |
| SSR hydration, skip navigation and keyboard-triggered React Aria action | Chromium, Firefox, WebKit |
| JSON/static modes, security headers, local requests and static hydration | Chromium, Firefox, WebKit |
| useful content with JavaScript disabled and no inert enhanced control | Chromium |
| reduced-motion media emulation and computed duration | Chromium |
| installed static PWA shell available offline | Chromium |

On macOS, WebKit follows the operating-system full-keyboard-access preference for links. The fixture
therefore focuses the skip link explicitly before activating it with Enter; Chromium and Firefox
prove sequential Tab focus. All three engines prove keyboard activation and focus transfer.

## Contrast evidence

Calculated WCAG relative-contrast ratios for canonical pairs:

| Pair | Light | Dark |
| --- | ---: | ---: |
| ink / canvas | 16.11:1 | 16.82:1 |
| muted / canvas | 6.57:1 | 11.07:1 |
| accent / surface | 7.67:1 | 9.34:1 |
| button text / accent | 7.67:1 | 8.55:1 |
| focus / canvas | 4.78:1 | 10.33:1 |

## Retained manual follow-up checklist

The human disposition accepted this bounded foundation for integration while retaining these checks
for product-level accessibility qualification:

- [ ] navigation order and visible focus in a real desktop browser;
- [ ] 200% zoom and narrow viewport reflow without loss of content;
- [ ] accessible names and live announcement with a screen reader;
- [ ] forced-colors rendering on a supporting operating system;
- [ ] contrast calculation and target-size assumptions;
- [ ] no-JavaScript usefulness and wording quality;
- [ ] the foundation is sufficient but not falsely presented as complete WCAG conformance.

The repository owner accepted `accessibility-foundation-review` by explicit human disposition on
2026-07-16. This evidence still does not claim WCAG certification or completion of product-level
manual accessibility qualification.
