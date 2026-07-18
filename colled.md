You are collecting posts from my LinkedIn feed into structured JSON. This is a
READ-ONLY task: do not like, react, comment, connect, follow, or click anything
that posts or changes state. Only read and scroll.

## HOW TO READ THE PAGE
Extract from the page's text and DOM, NOT from screenshots. Use get_page_text /
read_page for content, and read DOM attributes directly for links and counts.
Screenshots are a last resort only if a field is otherwise unreadable.

## WHAT TO DO
1. Scroll the feed slowly and human-paced (pause between scrolls, don't jump).
   Collect up to 1 posts, then stop.
2. Before extracting a post's text, click its "…see more" so you capture the
   FULL text, not the truncated preview.
3. Skip promoted/sponsored posts and pure job-listing cards — I only want
   organic posts from people.
4. Deduplicate: if the same post appears twice (reshares, feed refresh), keep it once.

## FIELDS TO EXTRACT PER POST
- post_url: build from the activity ID. Each card has a "urn:li:activity:{ID}"
  in a DOM attribute (e.g. data-urn, or the timestamp link's href). Extract the
  ID and construct: https://www.linkedin.com/feed/update/urn:li:activity:{ID}/
  If you truly cannot find the ID, set post_url to null — do NOT guess a URL.
- author_name
- author_headline: the line under the author's name (their title/tagline).
- post_type: one of text / reshare / image / poll / article / video.
- content: the full post text, expanded. For a RESHARE, capture BOTH the
  resharer's commentary (put in "content") AND the original post's text
  (put in "reshared_text"); if there's no added commentary, content is "".
- reshared_text: original post text if this is a reshare, else null.
- reactions: total reactions as an integer. Parse LinkedIn's shorthand —
  "1.2K" -> 1200, "3.4K" -> 3400, "1M" -> 1000000, strip commas. If none, 0.
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