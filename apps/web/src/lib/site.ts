/**
 * The public origin of the site, for the absolute URLs in robots.txt, sitemap.xml, llms.txt and
 * the structured data. Hardcoded: every build, dev included, names the public domain.
 */
export const siteOrigin = 'https://piccoloetterem.hu';

/** The pages a crawler should index, as paths. `/megrendeles` is the ordering page. */
export const sitePaths = ['/', '/megrendeles'] as const;
