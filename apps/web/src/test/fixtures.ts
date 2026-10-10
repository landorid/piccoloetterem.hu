/**
 * The O2 mockup's week (docs/design/megrendeles/mockup.html, `WEEK`) as the API serves it: ISO week
 * 2026/37, Monday 7 to Saturday 12 September, with Monday and Tuesday already past. Also Piccolo's
 * public config. Tests and the local fixture API read it.
 *
 * Only `import type` here: Node strips the types and runs this file as is, without a build.
 */
import type { AllergenCode, Category, MenuItem } from '@piccolo/core';
import type { OpenMenu, PublicConfig } from '../lib/api';

export const publicConfig: PublicConfig = {
  name: 'Piccolo Club Étterem',
  contact: {
    address: '9700 Szombathely, Mátyás Király utca 12.',
    phone: '+36 30 490 1122',
    openingHours: 'Hétfő–szombat 11:00–16:00',
    intakeWindow: { from: '07:30', until: '09:30' },
  },
  pickupEnabled: false,
  pricing: { noSoupDiscount: 100, soupPrice: 650, deliveryFee: 150, minimumOrder: 2200 },
  extras: [
    { key: 'doboz', name: 'Doboz', price: 100 },
    { key: 'kenyer', name: 'Kenyér', price: 50 },
    { key: 'ketchup', name: 'Ketchup', price: 400 },
    { key: 'tartarmartas', name: 'Tartármártás', price: 400 },
  ],
};

/** The mockup numbers allergens by their place in the EU list. */
const eu: Record<number, AllergenCode> = {
  1: 'gluten',
  3: 'eggs',
  4: 'fish',
  7: 'milk',
  8: 'nuts',
  9: 'celery',
  10: 'mustard',
  12: 'sulphites',
};

interface Options {
  description?: string;
  weekend?: number | null;
  allergens?: number[];
  variations?: string[];
  requiresSide?: boolean;
  soldOut?: boolean;
}

let order = 0;

function item(id: string, category: Category, name: string, price: number, o: Options = {}) {
  const dish: MenuItem = {
    id,
    category,
    name,
    description: o.description ?? null,
    priceWeekday: price,
    priceWeekend: o.weekend ?? null,
    variations: o.variations ?? [],
    allergens: (o.allergens ?? []).map((n) => eu[n] as AllergenCode),
    soupIncluded: category === 'daily_main',
    requiresSide: o.requiresSide ?? false,
    soldOut: o.soldOut ?? false,
    active: true,
    sortOrder: order++,
  };
  return dish;
}

const soup = (id: string, name: string, allergens: number[]) =>
  item(id, 'daily_soup', name, 0, { allergens });

/** A daily main: the mockup charges 100 Ft more on the weekend unless it says otherwise. */
const main = (id: string, name: string, description: string, price: number, o: Options = {}) =>
  item(id, 'daily_main', name, price, { weekend: price + 100, ...o, description });

const schnitzel = (id: string, price: number, weekend?: number) =>
  main(id, 'Rántott szelet', 'Friss citrommal', price, {
    variations: ['Sertéskaraj', 'Csirkemell', 'Trapista sajt'],
    requiresSide: true,
    allergens: [1, 3, 7],
    ...(weekend === undefined ? {} : { weekend }),
  });

const huslevesFor = (day: string) => soup(`${day}-husleves`, 'Húsleves cérnametélttel', [1, 3, 9]);

export const openMenu: OpenMenu = {
  state: 'open',
  orderableDates: ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'],
  closedDates: [],
  weekLabel: '2026/37. hét (09.07 – 09.12)',
  menu: {
    isoYear: 2026,
    isoWeek: 37,
    weekLabel: '2026/37. hét (09.07 – 09.12)',
    days: {
      1: {
        date: '2026-09-07',
        soups: [huslevesFor('h'), soup('h-karfiol', 'Karfiolkrémleves', [7, 9])],
        mains: [
          schnitzel('h-rantott-szelet', 1020),
          main('h-sertesporkolt', 'Sertéspörkölt', 'Nokedlivel, csemege uborkával', 1020, {
            allergens: [1, 3],
          }),
          main('h-csirkecomb', 'Sült csirkecomb', 'Fokhagymásan, ropogósra sütve', 1120, {
            requiresSide: true,
          }),
          main('h-rakott-krumpli', 'Rakott krumpli', 'Kolbásszal, tejföllel', 1120, {
            allergens: [3, 7],
          }),
          main('h-gombas-csirkemell', 'Gombás csirkemell', 'Sajttal gratinírozva', 1170, {
            requiresSide: true,
            allergens: [7],
            soldOut: true,
          }),
        ],
      },
      2: {
        date: '2026-09-08',
        soups: [
          soup('k-zoldbab', 'Zöldbableves', [1, 7, 9]),
          soup('k-paradicsom', 'Paradicsomleves', [1, 9]),
        ],
        mains: [
          main('k-bolognai', 'Bolognai spagetti', 'Reszelt sajttal', 1020, {
            allergens: [1, 3, 7],
          }),
          main('k-toltott-kaposzta', 'Töltött káposzta', 'Tejföllel, friss kenyérrel', 1120, {
            allergens: [1, 7],
          }),
          main('k-rantott-csirkemell', 'Rántott csirkemell', 'Panírozva, frissen sütve', 1120, {
            requiresSide: true,
            allergens: [1, 3, 7],
          }),
          main('k-szekelykaposzta', 'Székelykáposzta', 'Sertéslapockából', 1020, {
            allergens: [7],
          }),
          main('k-pisztrang', 'Grillezett pisztráng', 'Citrommal, olívaolajjal', 1170, {
            requiresSide: true,
            allergens: [4],
          }),
        ],
      },
      3: {
        date: '2026-09-09',
        soups: [huslevesFor('sze'), soup('sze-brokkoli', 'Brokkolikrémleves', [7, 9])],
        mains: [
          schnitzel('sze-rantott-szelet', 1020),
          main('sze-paprikas-csirke', 'Paprikás csirke', 'Galuskával, savanyúsággal', 1020, {
            allergens: [1, 3, 7],
          }),
          main('sze-sertessult', 'Sertéssült', 'Majorannás, hagymás lével', 1120, {
            requiresSide: true,
            allergens: [10],
          }),
          // Five allergens: the one dish of the week past three chips.
          main('sze-lasagne', 'Lasagne', 'Bolognai raguval, besamellel', 1120, {
            allergens: [1, 3, 7, 9, 12],
          }),
          main('sze-gombas-csirkemell', 'Gombás csirkemell', 'Sajttal gratinírozva', 1170, {
            requiresSide: true,
            allergens: [7],
            soldOut: true,
          }),
        ],
      },
      4: {
        date: '2026-09-10',
        soups: [
          soup('cs-gulyas', 'Gulyásleves', [1, 9]),
          soup('cs-sargaborso', 'Sárgaborsó-krémleves', [7, 9]),
        ],
        mains: [
          main('cs-milanoi', 'Milánói makaróni', 'Sonkával, gombával', 1020, {
            allergens: [1, 3, 7],
          }),
          main('cs-rantott-sajt', 'Rántott sajt', 'Rizzsel vagy hasábbal', 1120, {
            requiresSide: true,
            allergens: [1, 3, 7],
          }),
          main('cs-csirkepaprikas', 'Csirkepaprikás', 'Nokedlivel', 1020, { allergens: [1, 3, 7] }),
          main('cs-oldalas', 'Sült oldalas', 'Mézes-mustáros pácban', 1170, {
            requiresSide: true,
            allergens: [10],
          }),
          main('cs-rakott-zoldbab', 'Rakott zöldbab', 'Tejföllel, füstölt sajttal', 1120, {
            allergens: [3, 7],
          }),
        ],
      },
      5: {
        date: '2026-09-11',
        soups: [huslevesFor('p'), soup('p-paloc', 'Palócleves', [1, 7, 9])],
        mains: [
          schnitzel('p-rantott-szelet', 1020),
          main('p-halaszle', 'Halászlé', 'Pontyból, gyufatésztával', 1170, { allergens: [1, 4] }),
          main('p-turos-csusza', 'Túrós csusza', 'Tepertővel', 1020, { allergens: [1, 3, 7] }),
          main('p-ciganypecsenye', 'Cigánypecsenye', 'Fokhagymásan, szalonnával', 1120, {
            requiresSide: true,
          }),
          main('p-zoldsegfasirt', 'Zöldségfasírt', 'Joghurtos öntettel', 1020, {
            requiresSide: true,
            allergens: [1, 3, 7],
          }),
        ],
      },
      6: {
        date: '2026-09-12',
        soups: [huslevesFor('szo'), soup('szo-zoldsegkrem', 'Zöldségkrémleves', [7, 9])],
        mains: [
          schnitzel('szo-rantott-szelet', 1120, 1220),
          main('szo-marhaporkolt', 'Marhapörkölt', 'Tarhonyával', 1220, {
            weekend: 1320,
            allergens: [1, 3],
          }),
          main('szo-kacsacomb', 'Sült kacsacomb', 'Párolt lila káposztával', 1270, {
            weekend: 1370,
            requiresSide: true,
          }),
          main('szo-rakott-krumpli', 'Rakott krumpli', 'Kolbásszal, tejföllel', 1120, {
            weekend: 1220,
            allergens: [3, 7],
          }),
        ],
      },
    },
    featured: [
      item('cordon-bleu', 'featured', 'Cordon bleu', 1690, {
        description: 'Sonkával, sajttal töltve, körettel',
        weekend: 1790,
        requiresSide: true,
        allergens: [1, 3, 7],
      }),
      item('bakonyi', 'featured', 'Bakonyi sertésborda', 1590, {
        description: 'Galuskával, tejfölös gombamártással',
        weekend: 1690,
        allergens: [1, 3, 7],
      }),
    ],
    permanent: {
      allWeek: [
        item('trapista', 'all_week', 'Rántott trapista sajt', 1290, {
          description: 'Rizzsel vagy hasábbal',
          weekend: 1390,
          requiresSide: true,
          allergens: [1, 3, 7],
        }),
        item('csirkemellcsikok', 'all_week', 'Csirkemellcsíkok', 1390, {
          description: 'Bundázva, frissen sütve',
          weekend: 1490,
          requiresSide: true,
          allergens: [1, 3, 7],
        }),
        item('gorog-salata', 'all_week', 'Görög saláta', 1190, {
          description: 'Feta sajttal, olívabogyóval',
          weekend: 1290,
          allergens: [7],
        }),
        // Not in the mockup: the all-week dish of O1's worked example (1450 + soup = 2100).
        item('cezarsalata', 'all_week', 'Csirkés cézársaláta', 1450, {
          description: 'Pirított kenyérkockával, parmezánnal',
          weekend: 1550,
          allergens: [1, 3, 7],
        }),
      ],
      sides: [
        item('fott-burgonya', 'side', 'Főtt burgonya', 0),
        item('parolt-rizs', 'side', 'Párolt rizs', 0),
        item('hasabburgonya', 'side', 'Hasábburgonya', 0),
        item('parolt-zoldseg', 'side', 'Párolt zöldség', 0),
      ],
      sideExtras: [
        item('steak-burgonya', 'side_extra', 'Steak burgonya', 350, { allergens: [1] }),
        item('edesburgonya', 'side_extra', 'Édesburgonya-hasáb', 450),
        item('rizibizi', 'side_extra', 'Rizi-bizi', 250),
      ],
      pickles: [
        item('vegyes-vagott', 'pickle', 'Vegyes vágott', 250, { allergens: [12] }),
        item('csemege-uborka', 'pickle', 'Csemege uborka', 250, { allergens: [12] }),
        item('kaposztasalata', 'pickle', 'Káposztasaláta', 250),
      ],
      desserts: [
        item('somloi', 'dessert', 'Somlói galuska', 690, { allergens: [1, 3, 7, 8] }),
        item('turogomboc', 'dessert', 'Túrógombóc', 650, { allergens: [1, 3, 7] }),
        item('almas-pite', 'dessert', 'Almás pite', 590, { allergens: [1, 3, 7] }),
      ],
    },
  },
};

/** A dish of `openMenu` by id; throws on a typo so a test never runs on `undefined`. */
export function dish(id: string): MenuItem {
  const { days, featured, permanent } = openMenu.menu;
  const found = [
    ...Object.values(days).flatMap((day) => [...day.soups, ...day.mains]),
    ...featured,
    ...Object.values(permanent).flat(),
  ].find((item) => item.id === id);
  if (!found) throw new Error(`No dish ${id} in the fixture`);
  return found;
}
