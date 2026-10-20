import type { AllergenCode } from '@piccolo/core';
import type { ReactNode } from 'react';

/**
 * One pictogram per EU allergen, hand-drawn for the O2 mockup to a shared 24 × 24 box,
 * monochrome in `currentColor`. Generated from the mockup's `ALLERGEN_GLYPHS`; do not redraw.
 */
export const allergenGlyphs: Readonly<Record<AllergenCode, ReactNode>> = {
  gluten: (
    <>
      <path d="M12 21.4V7.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 19.6c-2.5 0-4-2.1-4-4.8 2.5 0 4 2.1 4 4.8zm0 0c2.5 0 4-2.1 4-4.8-2.5 0-4 2.1-4 4.8zm0-5.4c-2.5 0-4-2.1-4-4.8 2.5 0 4 2.1 4 4.8zm0 0c2.5 0 4-2.1 4-4.8-2.5 0-4 2.1-4 4.8z" />
      <path d="M12 3.2c1.5 1.4 2.3 3.1 2.3 4.7 0 1-.8 1.9-2.3 2.7-1.5-.8-2.3-1.7-2.3-2.7 0-1.6.8-3.3 2.3-4.7z" />
    </>
  ),
  crustaceans: (
    <>
      <path d="M12 8.8c3.4 0 6.1 2.5 6.1 5.5 0 2.6-2.7 4.5-6.1 4.5s-6.1-1.9-6.1-4.5c0-3 2.7-5.5 6.1-5.5z" />
      <path d="M9.9 8.6V6.6M14.1 8.6V6.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9.9" cy="5.2" r="1.3" />
      <circle cx="14.1" cy="5.2" r="1.3" />
      <path
        d="M6.5 12.6C4.3 12.2 2.9 10.4 3.2 8.3c2.1.3 3.5 1.9 3.6 3.9M17.5 12.6c2.2-.4 3.6-2.2 3.3-4.3-2.1.3-3.5 1.9-3.6 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.7 16.6 4 18.6M17.3 16.6 20 18.6M9.4 18.6 8.6 21.2M14.6 18.6l.8 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  ),
  eggs: (
    <>
      <path
        d="M12 2.6c3.8 0 6.8 5.4 6.8 10 0 4.4-3 7.6-6.8 7.6s-6.8-3.2-6.8-7.6c0-4.6 3-10 6.8-10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.6 12.2l2.7 1.7 1.6-2.3 2.1 2.5 1.7-2.3 2.3 2.3 2.3-1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </>
  ),
  fish: (
    <>
      <path
        d="M21 12c-1.9 2.8-4.8 4.5-7.9 4.5-2.4 0-4.6-1-6.2-2.6L3.2 17l1.2-5-1.2-5 3.7 3.1c1.6-1.6 3.8-2.6 6.2-2.6 3.1 0 6 1.7 7.9 4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="16.4" cy="10.6" r="1" />
    </>
  ),
  peanuts: (
    <>
      <path
        d="M12 2.9c2.7 0 4.8 2 4.8 4.5 0 1.4-.6 2.5-1 3.4-.4.8-.6 1.3-.6 2.1s.2 1.3.6 2.1c.4.9 1 2 1 3.4 0 2.5-2.1 4.5-4.8 4.5s-4.8-2-4.8-4.5c0-1.4.6-2.5 1-3.4.4-.8.6-1.3.6-2.1s-.2-1.3-.6-2.1c-.4-.9-1-2-1-3.4C7.2 4.9 9.3 2.9 12 2.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="7.3" r="1.9" />
      <circle cx="12" cy="16.7" r="1.9" />
    </>
  ),
  soybeans: (
    <>
      <g transform="rotate(-35 12 12)">
        <rect
          x="3.4"
          y="8.4"
          width="17.2"
          height="7.2"
          rx="3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="8" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="16" cy="12" r="1.6" />
      </g>
    </>
  ),
  milk: (
    <>
      <path
        d="M6.9 9.2 12 3.3l5.1 5.9v9.9c0 1.2-1 2.2-2.2 2.2H9.1c-1.2 0-2.2-1-2.2-2.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M6.9 9.2h10.2M12 3.3v5.9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.6 12.4h4.8v3.4H9.6z" />
    </>
  ),
  nuts: (
    <>
      <path d="M12 21.4c-3.7 0-6.7-3-6.7-6.8 0-2.7 1.6-5.1 3.9-6.2h5.6c2.3 1.1 3.9 3.5 3.9 6.2 0 3.8-3 6.8-6.7 6.8z" />
      <rect x="4.9" y="5.4" width="14.2" height="3" rx="1.5" />
      <path d="M12 5.2V2.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  celery: (
    <>
      <path
        d="M12 21.4V9.4M9.2 21.4c-.6-4.2-.4-7.8.6-10.9M14.8 21.4c.6-4.2.4-7.8-.6-10.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 9.8C10.9 7 9.2 5.5 7 5.2c.4 2.7 2 4.3 5 4.6zm0 0c1.1-2.8 2.8-4.3 5-4.6-.4 2.7-2 4.3-5 4.6zm0-.6c-.2-2.6.6-4.6 2.2-5.9.7 2.6.1 4.7-2.2 5.9z" />
    </>
  ),
  mustard: (
    <>
      <path
        d="M10.8 2.6h2.4v2.2l2.9 3.5c.5.6.8 1.4.8 2.2v8.6c0 1.3-1 2.3-2.3 2.3H9.4c-1.3 0-2.3-1-2.3-2.3v-8.6c0-.8.3-1.6.8-2.2l2.9-3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="8.7" y="12.3" width="6.6" height="4.8" rx="1.2" />
    </>
  ),
  sesame: (
    <>
      <ellipse cx="8" cy="7.4" rx="2" ry="3" transform="rotate(-25 8 7.4)" />
      <ellipse cx="15.8" cy="8.4" rx="2" ry="3" transform="rotate(22 15.8 8.4)" />
      <ellipse cx="11.7" cy="13.6" rx="2" ry="3" transform="rotate(-6 11.7 13.6)" />
      <ellipse cx="17.2" cy="16" rx="2" ry="3" transform="rotate(40 17.2 16)" />
      <ellipse cx="6.9" cy="16.6" rx="2" ry="3" transform="rotate(-44 6.9 16.6)" />
    </>
  ),
  sulphites: (
    <>
      <path
        d="M9.6 3.4h4.8v4.8l4.6 8.7c.9 1.7-.3 3.7-2.2 3.7H7.2c-1.9 0-3.1-2-2.2-3.7l4.6-8.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M7.4 13.6h9.2l1.8 3.3c.9 1.7-.3 3.7-2.2 3.7H7.8c-1.9 0-3.1-2-2.2-3.7z" />
      <path d="M8.8 3.2h6.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  lupin: (
    <>
      <path d="M12 21.4v-6.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.5" cy="13.4" r="1.8" />
      <circle cx="14.5" cy="13.4" r="1.8" />
      <circle cx="10.3" cy="9.4" r="1.7" />
      <circle cx="13.7" cy="9.4" r="1.7" />
      <circle cx="12" cy="5.6" r="1.6" />
      <path d="M12 19.6c-2 0-3.5-1.3-3.9-3.1 2.2-.4 3.9.9 3.9 3.1z" />
    </>
  ),
  molluscs: (
    <>
      <path
        d="M20.4 12c0 4.6-3.8 8.4-8.4 8.4S3.6 16.6 3.6 12 7.2 3.9 11.4 3.9s7.2 3 7.2 6.8c0 3.1-2.5 5.6-5.6 5.6-2.6 0-4.7-2.1-4.7-4.7 0-2.1 1.7-3.8 3.8-3.8 1.7 0 3 1.4 3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </>
  ),
};
