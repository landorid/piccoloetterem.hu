# Piccolo Stack

A `ci_piccolo/` alatti CodeIgniter 3 rendszer teljes cseréje. Single-tenant termék, amit
több étteremnek is el lehet adni — hosztolt infrastruktúrán, saját üzemeltetett szerver nélkül.

| | |
|---|---|
| Modell | Single-tenant (ügyfelenként külön app-példány és adatbázis) |
| Üzemeltetés | Nincs saját szerver |
| Csapat | Két fő, nincs átadás harmadik félnek |
| Határidő | Nincs. A csere teljes lesz, alapos tesztelés után — nem fokozatos |

Publikált változat: <https://claude.ai/code/artifact/c1505a00-501c-4b7d-8c98-ad2f6578992b>

Kapcsolódó: [PLAN.md](PLAN.md) — a döntések, a domain modell és az issue-terv (angolul);
[LEGACY-INVENTORY.md](LEGACY-INVENTORY.md) — a régi rendszer funkcionális leltára.

---

## 1. A stack

| Réteg | Választás | Szerep |
|---|---|---|
| Futtatás | Cloudflare Workers (Paid) | Egyetlen Worker ügyfelenként: statikus fájlok + API azonos originen |
| Publikus frontend | Astro + React sziget | Statikus oldalak (SEO), React sziget a kosárhoz |
| Admin felület | Vite + React SPA | Külön app, külön build — `/admin/*` alatt, ugyanabban a Workerben |
| API | Hono | Web-standard `Request`/`Response`, fut Workersen és Node-on |
| Domain logika | `core/` — sima TypeScript | ISO-hét, határidő, ünnepnapok, rendelés-összeállítás. HTTP nélkül tesztelhető |
| Adatbázis | Neon Postgres (Free) | Ügyfelenként külön projekt |
| DB-hozzáférés | Drizzle ORM | Migrációk a repóban |
| Kapcsolatkezelés | Hyperdrive | Kötelező Workersről; standard `pg` TCP driver marad használható |
| Személyzeti auth | Clerk | Hosted. Egy alkalmazás, éttermenként egy organization |
| Vevő-identitás | `customers` tábla | `email_key` UNIQUE. Soha nem kerül a Clerkbe. A `verified_at` + magic link a backlogon |
| Levélküldés | Amazon SES | Nincs napi limit, nincs domain-plafon |
| Levél-observability | SendOps (Free) | Csak megfigyelés — nincs a küldési útvonalban |
| Sablonok | React Email | Szolgáltató-független |
| Hibakövetés | Sentry | Már használatban a Fessh stackben |

### Három alkalmazás, egy deployable

```
apps/
  web/     Astro         →  dist/         →  szolgálva:  /
  admin/   Vite + React  →  dist/admin/   →  szolgálva:  /admin/*
  api/     Hono          →  a Worker      →  szolgálva:  /api/*
packages/
  core/         domain logika, sima TypeScript
  db/           Drizzle séma és migrációk
  api-client/   típusos kliens Hono RPC-ből — mindkét frontend használja
```

**Nincs örökölt adatimport.** Az új rendszer üres vevőtörzzsel és üres rendeléstörténettel indul
(2026-09-06-i döntés). A 3. szakasz mérései a modellezést szolgálták, nem egy migrációt.

Az admin valódi SPA, nem Astro-sziget: állapotos, interaktív, SEO-igény nélküli. Külön app és
külön build — de **ugyanabban a Workerben** deployolva, mert a külön origin visszahozná a CORS-t,
a `SameSite=None`-t és egy ügyfelenkénti DNS-lépést. A publikus oldal így nem szállít admin JS-t
a vendégeknek.

> **Miért egyetlen Worker.** Ha minden ugyanazon az originen van, eltűnik a CORS, a `SameSite=None`
> és az ügyfelenkénti `api.<domain>` DNS-lépés, a Clerk session sütije pedig magától működik.
> Egy egész hibaosztály szűnik meg egyetlen szerkezeti döntéssel.

---

## 2. Költség

| Tétel | Hatókör | Havi |
|---|---|---:|
| Cloudflare Workers Paid | Teljes fiók, minden ügyfél | $5,00 |
| Neon Postgres (Free) | Ügyfelenként — mért ~35 CU-óra a 100-ból | $0,00 |
| Amazon SES | Ügyfelenként — 1 572 levél | $0,25 |
| Clerk | Free — 50 000 MRU, 100 organization | $0,00 |
| Cloudflare statikus kérések | Korlátlan | $0,00 |
| SendOps | Free csomag, 1 seat | $0,00 |
| **Piccolo egyedül** | fix + egy ügyfél | **$5,25** |
| **Minden további ügyfél** | csak a változó rész | **$0,25** |

A fix rész egyetlen tétel, és nem nő az ügyfelek számával. Az adatbázis Neon Free csomagon fut —
cserébe a fogyasztásfigyelést nekünk kell megépíteni, mert ezen a szinten nincs riasztás.

**Váltási küszöb Free → Launch** (a fal 100 CU-óra = 400 aktív óra 0,25 CU-n = napi 13,3):

- a hónap 20. napjára a fogyasztás 70% fölött van
- vagy a napi aktív idő tartósan 9 óra fölé megy (a becsült 5 helyett — ilyenkor bug van, nem növekedés)
- vagy a tárhely 350 MB fölé nő

A váltás ugyanazon a projekten történik, adatmozgatás nélkül. A consumption API előzménye viszont
csak a váltás időpontjától kezdődik.

---

## 3. Amit az örökölt adatból mértünk

Forrás: `honlapva_piccolo_new` élő MySQL, 2026-09-06-i olvasás.

| | |
|---:|---|
| 132 758 | leadás (`user` sor) |
| 160 755 | rendelési sor (`orders`) |
| 418 007 | tétel (`food`) |
| 5 425 | egyedi vevő |
| 2,7% | leadás érvényes email nélkül (3 571 db) |
| 79 | vevő, akinek soha nem volt emailje (1,5%) |
| 105 | levél a legforgalmasabb napon |
| 1 572 | levél havi átlagban |

### Az email kötelezővé tehető

A lefedettség 97,3%, és mindössze 79 vevő az, akinél soha nem volt cím. Ezért a
`customers.email_key` lehet UNIQUE, és a régi név+telefon union-find dedup-heurisztikára
**nincs szükség az új rendszerben**.

### Az email a rendelőt azonosítja, a név a fogyasztót

Nyersen az egyedi emailek 16,4%-a (737 / 4 482) több névkulcshoz tartozik, ami elsőre
adathibának látszik. Szétbontva:

| | emailek | |
|---|---:|---|
| >1 névkulcs (nyers) | 737 | 16,4% |
| — csak elgépelés, egy ember | 159 | |
| — valóban több ember | 578 | 12,9% |
| **ebből csoportos rendelő** | **508** | **88%** |
| **valóban megosztott cím** | **70** | **1,6%** |

A „több ember egy emailen" 88%-ban a **csoportos rendelés funkció**: valaki bevisz egy irodányi
ebédet (`szombathely@mehzrt.hu` kilenc névvel, `hust331cb1@praktiker.hu` kilenc névvel).
A ténylegesen megosztott cím (pár, család) csak 70 db, a leadások 0,9%-a.

A régi séma a rendelőt és a fogyasztót egyetlen `user` sorba préselte — ez okozta az egész
dedup-fájdalmat. Az új modell szétszedi:

```
customers      -- email_key UNIQUE, a rendelő
  └── orders   -- customer_id FK
        └── order_items  -- recipient_name, a fogyasztó (csoportos rendelésnél kitöltve)
```

### Adatminőség az importhoz

- 47 `user.email` sor nem email formátumú (nincs `@` vagy pont a domainben) → importnál `NULL`, ne javítsd
- `orders.date` ISO-hetet tárol `"ÉÉÉÉ/HH"` formában, `orders.day` a hét napja (1 = hétfő … 6 = szombat, vasárnap nincs)
- `menu2.day` viszont **0-bázisú** (0 = hétfő) — a két konvenció keveredik a régi sémában
- `menu2` alkalmatlan a kínálat mérésére (`"ZÁRVA!!"`, `"Feltöltés alatt!!"`, üres sorok) — a termékmixet a `food` sorokból kell számolni
- `orders.status` ~0,7%-a NULL, üzleti jelentése nincs

---

## 4. Döntések és állapotuk

### Eldöntve

**Workers Paid, nem Free.** A Free 10 ms CPU-t ad kérésenként, és a Cloudflare doksija szerint a
hitelesítést kezelő terhelések jellemzően 10–20 ms-ot esznek. Az $5 nem a jelszó-hashelést veszi
meg, hanem a CPU-plafont emeli 10 ms-ról 30 másodpercre — az egész alkalmazásra, az egész fiókra.

**Az admin külön app, de nem külön deploy.** Külön build, mert egy dashboard nem Astro-sziget.
Ugyanaz a Worker, mert a külön origin visszahozná a CORS-t és bonyolítaná a Clerk sütijét.
Központi, minden ügyfelet kiszolgáló admin nem opció: N különböző Neon adatbázishoz kellene
csatlakoznia, ami a single-tenant elszigetelést törné szét.

**A Piccolo szabályai konfiguráció, nem kód.** A 9:30-as határidő, a H–Szo működés, az ISO-hetes
menüciklus, az öt fogástípus (`leves`, `foetel`, `koret`, `desszert`, `savanyusag`) és a magyar
ünnepnaptár mind ügyfelenként más lesz. Egy tipizált `RestaurantConfig`, amiből a Piccolo csak egy
példány. Ez az egyetlen dolog, ami semmilyen későbbi döntéstől nem függ.

**On-premise telepítés lekerült az asztalról.** A Neon, a Cloudflare és a Clerk együtt azt jelenti,
hogy nincs mit az ügyfél szerverére telepíteni. Tudatos döntés, nem következmény.

### Módosult menet közben

**Neon, nem self-hosted Postgres.** Az út Supabase → Coolify Postgres → Neon volt. A fordulópont:
a single-tenant és az on-premise nem ugyanaz — az elsőt kimondtuk, a másodikat én feltételeztem.
Amint az on-prem nem követelmény, a managed DB pont az üzemeltetést veszi le.

**Hono, nem NestJS.** ~20–30 végpont, két fejlesztő, és a domain logika amúgy is a `core/`-ban él.
A NestJS fő haszna — struktúra kikényszerítése nagy csapatban — itt nem jelentkezik. A Hono
ráadásul fut Workersen is.

**Clerk, nem self-hosted Better Auth.** A Better Auth melletti döntő érv az volt, hogy a userek a
saját Postgresünkben maradnak — de ez a *vevőkre* vonatkozott, akik sosem kerülnek az auth
rendszerbe. Ami ott marad: ügyfelenként 1–3 személyzeti fiók. Helyette számít: nem mi felelünk az
auth biztonsági felületéért, nem építünk login/reset UI-t, és megszűnik a „Better Auth Workersen"
kockázat. A WorkOS (1M MAU ingyen) és a Kinde is szóba jött; a Clerk azért nyert, mert a 100
ingyenes organization száz éttermet fed, a kész UI komponensei a legjobbak, és ismerjük.

**SES + SendOps, nem Resend.** A mért csúcs 105 levél/nap, ami a Resend free 100-as napi limitjét
évi négy napon lépi át. De a valódi korlát a terméknél a **3 domain** — ügyfelenként saját küldő
domain kell. Az SES mindkét falat leveszi ~$0,25-ért.

### Nyitott

- [ ] **Clerk illesztése Workersre és Astróra.** A `@clerk/backend` runtime-független (Web
      Crypto/fetch), tehát a session-ellenőrzésnek `authenticateRequest`-tel mennie kell a Hono
      API-ban. A frontend komponensek React-alapúak, tehát Astro szigetben kell futniuk.
      Fél napos spike.
- [ ] **Az admin SPA-fallback útvonala.** A gyökérben statikus Astro oldal áll, a `/admin/*` alatt
      SPA, aminek minden mély útvonala az `admin/index.html`-t kell hogy kapja. A Workers static
      assets globális `not_found_handling`-je ezt elrontaná — a fallbacket a Worker scriptben kell
      explicit kezelni.
- [ ] **A Neon legacy consumption API elérhető-e Free csomagon.** A v2 (`/consumption_history/v2/projects`)
      dokumentáltan Launch+. A legacy (`/consumption_history/projects`, `active_time_seconds`)
      „older plans"-re hivatkozik, de nem mondja ki, hogy a Free ide tartozik. Egy curl eldönti.
      Ha nem: saját instrumentálás Workers KV-ben (az aktív idő a `[lekérdezés, +5 perc]`
      intervallumok uniója).
- [x] **Az admin felület tartalma.** Lezárva 2026-09-06-án: a leltár a
      [LEGACY-INVENTORY.md](LEGACY-INVENTORY.md)-ben, a döntések a [PLAN.md](PLAN.md)-ben.

---

## 5. Telepítési checklist ügyfelenként

Másold ügyfelenként, és pipáld végig.

- [ ] Neon projekt létrehozása **Free** csomagon, connection string kiírása
- [ ] Autoscale maximum levétele **0.25 CU**-ra a compute beállításokban
      — Free csomagon 2 CU-ig skálázna: egy elszabadult lekérdezés nyolcszoros ütemben égetné a havi 100 CU-órát
- [ ] A projekt felvétele a fogyasztásfigyelőbe
      — Free csomagon nincs használati riasztás, a falat magunknak kell látni közeledni
- [ ] Clerk organization létrehozása az étteremnek, személyzet meghívása
- [ ] Cloudflare Worker deploy + Hyperdrive binding a Neon projektre
      — ugyanaz az image mindenhol: buildelj egyszer CI-ban, ne ügyfelenként
- [ ] Ügyfél domainje a Workerre irányítva
- [ ] SES domain identity + DKIM verifikáció
- [ ] SPF, DKIM és DMARC rekordok az ügyfél DNS-ében
      — enélkül a visszaigazolók spambe esnek: rendelési rendszernél ez üzleti hiba
- [ ] `RestaurantConfig` kitöltése: határidő, működési napok, menüciklus, fogástípusok, ünnepnaptár, branding
- [ ] SendOps csatlakoztatása az AWS fiókhoz

---

## 6. Szabályok, amiket nem szabad megsérteni

1. **Csak a személyzet kerül a Clerkbe, a vevők soha.** A vevők a `customers` táblában élnek
   `email_key`-jel; ha egyszer lesz „korábbi rendeléseim", annak megerősítése saját kódban megy.
   Máskülönben MAU-ban fizetnénk értük, cserébe semmiért.

2. **A 9:30-as határidőt a szerver validálja.** A statikus frontend a böngésző órájából számol, ami
   állítható és téves is lehet. Beküldéskor a `core/` újraellenőrzi. Az adatban éles törés látszik
   9:30-nál (9:00–9:30 között 3 457 leadás, 95% aznapra; 9:30–10:00 között 305, 26,6%) — ez üzleti
   határ, nem díszlet.

3. **A health endpoint nem nyúl az adatbázishoz.** Ha 5 percnél sűrűbben pingel bármi, a Neon
   compute sosem alszik el, és ötszörösére nő a fogyasztás. Külön `/api/health/db` legyen, ritkán hívva.

4. **A menü cache-e órákban mérhető, nem percekben.** A Neon scale-to-zero küszöbe is 5 perc — egy
   5 perces cache pont kioltaná. Legjobb: lejárat nélküli cache, amit a menüfeltöltés ürít.

5. **Az elemzéseket Postgres aggregálja**, nem a Worker. 418 007 sort nem viszünk át a hálózaton.

6. **A domain logika nem szivárog a controllerekbe.** Ez a szabály fontosabb, mint maga a
   keretrendszer — ettől maradt olcsó a NestJS→Hono és a Coolify→Neon fordulat is.

7. **A SendOps kimarad a küldési útvonalból.** A tranzakciós levelek közvetlenül az SES API-n
   mennek, hogy egy fiatal szolgáltató kiesése dashboardot vigyen, ne kézbesítést.

8. **Nincs örökölt adatimport.** Az élő MySQL csak olvasható referencia az elemzésekhez; semmilyen
   kód nem függ tőle, és nem kerül a repóba.

---

*A `ci_piccolo/` referencia, nem specifikáció. Lehet és kell javítani rajta — de amit elhagyunk,
azt ki kell mondani, nem csendben kihagyni.*
