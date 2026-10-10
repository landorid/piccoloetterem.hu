-- Natural, case- and accent-insensitive order for lists staff read: "fo ter 2" before "Fő tér 10".
-- The root locale, because Hungarian's sorts ö and ő as letters of their own, apart from o.
-- Deterministic: strings equal under it still differ for `=`, it only decides `ORDER BY`.
CREATE COLLATION IF NOT EXISTS "natural_sort" (provider = icu, locale = 'und-u-kn-ks-level1');
