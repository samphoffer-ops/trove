-- ----------------------------------------------------------------
-- Trove – capture Sam's actual reason when manually rejecting a brand
-- Run in: Dashboard → SQL Editor → New query → Run
-- ----------------------------------------------------------------

-- judge_reasoning holds the AI's OWN reasoning from when it judged the
-- brand (often a PRO case — "verdict: approve" — for anything that made it
-- to the review queue). When Sam then manually rejects one of those, his
-- real objection ("too much leather", "not our vibe") was never captured
-- anywhere — discover-brands' summarizeRejectionPatterns() only ever reads
-- judge_reasoning, so a manual override was silently feeding the AI's own
-- pro-fit reasoning back in as if it were a rejection pattern.
alter table public.brands add column if not exists rejection_note text;
