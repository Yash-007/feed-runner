You are collecting posts from my LinkedIn feed into structured JSON. This is a
READ-ONLY task: do not like, react, comment, connect, follow, or click anything
that posts or changes state. Only read and scroll. (The one exception is the "…"
menu Copy-link fallback in Phase 3, which does not change state.)

MY NICHE: tech, AI, and startups/business. (Informational only — no relevance
filtering is applied; ranking is purely by engagement/velocity, see below.)

## HOW TO READ THE PAGE
Extract from the page's text and DOM, NOT from screenshots. Use get_page_text /
read_page for content, and read DOM attributes directly for links and counts.
Screenshots are a last resort only if a field is otherwise unreadable.

## OVERALL STRATEGY — three phases
Scanning every post in full detail (resolving its true permalink, expanding
content, etc.) is expensive and flaky (LinkedIn's "…" → Copy link flow is slow
and sometimes needs retries). So split the work: scan cheaply and broadly
first, rank, and only pay the expensive cost for the winners.

### PHASE 1 — cheap scan of up to 120 posts
Scroll through the feed and, for EVERY post (no skipping, no gating, no
relevance judgment), record only cheap fields:
  - author_name
  - author_profile_url (href on the author name/photo link — needed later to
    relocate this exact post via their /recent-activity/all/ page)
  - reactions (parse shorthand: "1.2K" -> 1200, "3.4K" -> 3400, "1M" ->
    1000000, strip commas)
  - comments (same parsing; 0 if none)
  - age_minutes ("45m" -> 45, "2h" -> 120, "1d" -> 1440, "3w" -> 30240)
  - content_snippet: first ~100-150 chars of the post text (enough to
    uniquely identify this post later when relocating it on the author's
    profile — do NOT expand "see more" or extract full content in this phase)
Do NOT resolve post_url in Phase 1. Do NOT open the "…" menu in Phase 1. Do
NOT skip promoted/job-listing posts from the count, but you may exclude them
from the recorded set since they can't be usefully ranked.
Stop once you've scanned 120 posts (or the feed runs out).

Periodically (e.g. every 30-40 posts scanned) refresh the feed (navigate to
linkedin.com/feed/ again, or reload) and re-scan from the top for a short
while before continuing to scroll further down. LinkedIn's "Top" feed can
surface new posts published after the run started; refreshing catches these
recent posts that a single top-to-bottom scroll would miss. Dedupe against
already-logged posts (match on author_name + content_snippet) before adding.

Save this raw list to a SEPARATE file: `posts_raw.json` in the project root
(an array of objects with the fields above plus a `scan_index` sequential
integer). This file is intermediate/working data, distinct from posts.json.

### PHASE 2 — rank by engagement/velocity
For every post in posts_raw.json compute:
  engagement = reactions + (comments * 3)
  velocity   = engagement / max(age_minutes, 1)
Sort descending by velocity. Take the top 20 (dedupe first if the same post
was scanned twice due to feed refresh/reshares — match on author_name +
content_snippet).

### PHASE 3 — full extraction, only for the top 20
For each of the top 20 posts (in velocity rank order), relocate and fully
extract:
  1. Navigate to the post's author_profile_url + `/recent-activity/all/`
     (the home feed reshuffles on reload and can't be relied on to relocate a
     specific post — the author's own activity page is stable/chronological).
  2. Find the matching post on that page by content_snippet + reactions/
     comments/age (allow small drift in reactions/age since time has passed).
  3. Resolve post_url: open the post's "…" overflow menu -> "Copy link to
     post" -> read_page (accessibility tree) for the hidden "View post" link
     left behind by the "Link copied" toast. Use that resolved URL AS-IS —
     do NOT rewrite its ID into the /feed/update/urn:li:activity:{ID}/ form;
     the numeric ID in a copied share-link's slug is not always a true
     activity URN, and forcing it into that template produces a URL that
     404s even though the original copied URL works fine.
  4. Verify: navigate to the resolved post_url and confirm it's not a "Post
     not found" page before accepting it. If resolution fails after
     reasonable retries, set post_url to null rather than guessing.
  5. Extract the remaining full fields: author_headline, post_type, full
     content (expand "see more"), reshared_text if a reshare, and re-read
     final reactions/comments/age_minutes at time of extraction.
  6. Assign a sequential integer `id` (1, 2, 3, ... in final rank order) and
     `collected_at` (current ISO timestamp).

Write the resulting up-to-20 fully-extracted posts as the JSON array into
`posts.json` in the project root (this REPLACES posts.json's previous
contents — it is the filtered output of this run, not an append).

## FIELDS IN posts_raw.json (Phase 1 output)
[
  {
    "scan_index": 1,
    "author_name": "...",
    "author_profile_url": "https://www.linkedin.com/in/...",
    "reactions": 0,
    "comments": 0,
    "age_minutes": 0,
    "content_snippet": "..."
  }
]

## FIELDS IN posts.json (Phase 3 output, final)
[
  {
    "id": 1,
    "post_url": "https://www.linkedin.com/posts/...",
    "author_name": "...",
    "author_headline": "...",
    "post_type": "text",
    "content": "...",
    "reshared_text": null,
    "reactions": 0,
    "comments": 0,
    "age_minutes": 0,
    "collected_at": "2026-07-19T00:00:00Z"
  }
]

## AFTER COLLECTION
Once posts.json is written for this run, git commit and push posts.json
(only posts.json) with a descriptive commit message.

## SESSION LENGTH
This task involves many browser tool calls (120 scans + 20 full extractions).
If the conversation is running long, proactively compact it (don't wait to be
asked) so context stays available for the remaining work — the raw file and
posts.json on disk are the durable record, so compaction losing chat history
mid-run is safe as long as progress is periodically saved to those files.
