# reddit-serp

Local tool. Googles a list of queries your potential customers would type, keeps only those where a
**Reddit thread ranks #1–#2**, then reads the subreddit's rules + sidebar and discards the ones that
ban self-promotion, links, products/tools, ads, affiliate, etc. (or where the thread is archived/locked).

```
cd tools/reddit-serp
npm install            # first time only
node index.js          # all queries in queries.txt (~8 min, opens a Chrome window — don't close it)
node index.js --limit 5            # quick test
node index.js --caution            # also show subs with only soft warnings (spam rule, 9:1, disclosure…)
node index.js --top 3              # Reddit up to position 3
node index.js --queries mine.txt   # another query file
node index.js --fresh              # re-read subreddit rules instead of using .rules-cache.json
```

Output: `results/<date>.md` (readable) and `.json`. Verdicts: **OK** (no restriction found), **CAUTION**
(soft rules), **BLOCKED**, **UNKNOWN** (Reddit refused to show the sub). Edit `queries.txt` to add queries.

If Google shows a captcha, solve it in the Chrome window; the script waits. The Chrome profile is kept in
`.chrome-profile/` so captchas become rare. Rule detection is keyword-based: always skim the rules before commenting.
