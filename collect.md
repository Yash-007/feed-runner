You are collecting posts from my LinkedIn feed into structured JSON. This is a
READ-ONLY task: do not like, react, comment, connect, follow, or click anything
that posts or changes state. Only read and scroll. (The one exception is the "…"
menu Copy-link fallback below, which does not change state.)

MY NICHE: tech, AI, and startups/business.

## HOW TO READ THE PAGE
Extract from the page's text and DOM, NOT from screenshots. Use get_page_text /
read_page for content, and read DOM attributes directly for links and counts.
Screenshots are a last resort only if a field is otherwise unreadable.

## PER-POST FLOW — gate BEFORE doing the expensive extraction
For each post as you scroll, apply this gate. The moment a post fails it,
skip it and move to the next — do NOT extract its remaining fields.

GATE 1 — mechanical (cheap, needs no reading):
  - Read only the timestamp and the reaction count.
  - Skip if age_minutes > 1000
  - Skip if reactions < 120.
  - Skip promoted/sponsored posts and pure job-listing cards.

No relevance/content judgment needed — if a post clears Gate 1, collect it.

Only for posts that clear the gate: extract the full field set below.
Collect up to {{10}} posts that pass, then stop. Deduplicate — if the same post
appears twice (reshares, feed refresh), keep it once.

## FIELDS TO EXTRACT (only for posts that passed both gates)

- post_url: resolve in this order, stop at the first that works:
  (a) Check the OUTERMOST post container's attributes (data-urn, data-id) for
      "urn:li:activity:{ID}" — this lives on the top-level card wrapper, NOT on
      inner comment containers (those hold comment URNs, ignore them).
  (b) Locate the post's TIMESTAMP, then read its attributes for the activity ID:
      - To FIND it: use read_page (accessibility tree) and look for the header
        element whose label reads like "N hours/days ago", OR match the visible
        text pattern \d+\s*(m|h|d|w|mo|yr) in the card header (just after the
        author name/headline). It may be a <time> tag or an <a> wrapping that text.
      - Once found, read THAT element's href and data- attributes for
        "urn:li:activity:{ID}". The timestamp often links to the permalink even
        when no other card element carries the ID.
  (c) If still not found, open the post's "…" overflow menu and use "Copy link
      to post"; read the resolved URL. (This is read-only — it does not change
      state.) Keep this human-paced; it's a fallback, not the default.
  Construct/return: https://www.linkedin.com/feed/update/urn:li:activity:{ID}/
  Only if ALL THREE fail, set post_url to null. Never guess or fabricate a URL.

- author_name
- author_headline: the line under the author's name (their title/tagline).
- post_type: one of text / reshare / image / poll / article / video.
- content: the full post text, expanded. For a RESHARE, capture BOTH the
  resharer's commentary (put in "content") AND the original post's text
  (put in "reshared_text"); if there's no added commentary, content is "".
- reshared_text: original post text if this is a reshare, else null.
- reactions: total reactions as an integer. Parse LinkedIn's shorthand —
  "1.2K" -> 1200, "3.4K" -> 3400, "1M" -> 1000000, strip commas.
- comments: total comments as an integer, same parsing. If none, 0.
- age_minutes: convert the post's timestamp to minutes.
  "45m" -> 45, "2h" -> 120, "1d" -> 1440, "3w" -> 30240. Round to nearest minute.
- collected_at: current timestamp in ISO format.

## OUTPUT — return ONLY this JSON array, nothing else:
[
  {
    "post_url": "https://www.linkedin.com/feed/update/urn:li:activity:...",
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