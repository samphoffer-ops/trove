-- Track which brands Sam has hand-picked vs. discovered by the algorithm.
-- Hand-picked brands get dedicated per-brand Exa searches in discover-brands
-- (Layer 0) so the discovery pipeline learns specifically from them, not just
-- from bulk clusters of approved brands.
alter table brands add column if not exists hand_picked boolean not null default false;
