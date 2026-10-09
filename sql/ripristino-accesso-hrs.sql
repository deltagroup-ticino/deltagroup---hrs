-- ═══════════════════════════════════════════════════════════════════════
-- HRS — Ripristino del collegamento con PLAN
--
-- Su PLAN è stato eseguito lo script sql/rls-chiusura-anon.sql, che ha
-- chiuso la lettura di agents, shifts, services e profiles lasciando
-- l'accesso ai soli utenti autenticati. L'app HRS di JAS entra con un PIN,
-- non con un login Supabase: da quel momento non ha più visto nessun
-- servizio, nessun collaboratore e nessun turno — schermata vuota su Oggi,
-- Settimana e Archivio, e scrittura dei turni "extra" fallita in silenzio.
--
-- Questo script rimette HRS esattamente com'era prima.
-- Unica differenza: su `agents` l'accesso anonimo è limitato alle colonne
-- id e name (le uniche due che HRS legge). Restano quindi chiuse date di
-- nascita, LPPS, permessi di lavoro e contratti. Nessun effetto sul
-- funzionamento di HRS. `profiles` resta chiusa: nessuna app anonima la usa.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1) services — lettura (HRS cerca il servizio "HRS - Stadio") ───────
drop policy if exists services_anon_read on public.services;
create policy services_anon_read on public.services
  for select to anon using (true);
grant select on public.services to anon;

-- ── 2) shifts — lettura e scrittura (JAS aggiunge i collaboratori extra
--      e HRS ricrea il turno dentro PLAN) ────────────────────────────────
drop policy if exists shifts_anon_all on public.shifts;
create policy shifts_anon_all on public.shifts
  for all to anon using (true) with check (true);
grant select, insert, update on public.shifts to anon;

-- ── 3) agents — solo id e name ─────────────────────────────────────────
drop policy if exists agents_anon_read on public.agents;
create policy agents_anon_read on public.agents
  for select to anon using (true);
revoke select on public.agents from anon;
grant select (id, name) on public.agents to anon;

-- ── 4) Verifica ────────────────────────────────────────────────────────
select tablename, policyname, roles::text, cmd
from pg_policies
where schemaname='public' and tablename in ('agents','shifts','services','profiles')
order by tablename, policyname;
