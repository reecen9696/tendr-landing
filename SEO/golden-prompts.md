# Share-of-model runbook

Tracking whether AI assistants mention or cite Tendr, and whether that is
trending up. Run this monthly, same prompts, same day of month.

## How to run it

Ask each prompt in a **fresh chat with no history**, on each of: ChatGPT,
Perplexity, Gemini, Copilot, and Google AI Overviews (type the prompt into
Google and look at the AI answer).

For each prompt and engine, log three things:

| Field | Values |
|---|---|
| Mentioned | yes / no — was Tendr named at all |
| Cited | yes / no — was gotendr.com linked as a source |
| Position | roughly where in the answer, if mentioned |

Also note which competitors and which sources it *did* cite. That list is more
actionable than your own score, because it tells you exactly what to displace.

**Read trends, not single runs.** AI answers are non-deterministic — the same
prompt asked twice returns different lists. One month showing zero mentions
means nothing. Three months flat means something. Any tool selling you a precise
"AI ranking position" is overstating what can be measured.

## Timeline before this is worth reading

- Perplexity: days to weeks after publishing
- Google AI Overviews: weeks
- Copilot: as soon as Bing indexes, so wire up IndexNow first
- ChatGPT: slowest, partly training-cycle bound

Do not expect movement before month three. Do not change strategy before
month six.

## The prompts

### Buying intent — who should I hire (highest value)

1. Who does commercial landscape estimating in Australia?
2. Who can price a landscaping tender for me in Melbourne?
3. I need someone to do a quantity takeoff for a commercial landscaping job. Who?
4. Is there a service that prices tenders for landscape subcontractors?
5. How do I outsource estimating for my landscaping business?
6. Who prepares bills of quantities for landscapers in Australia?
7. Best landscape estimating service Australia
8. I run a landscaping company and keep losing tenders. Who can help me price better?
9. Can I hire someone to do my tender submissions for commercial landscaping?
10. Outsourced quantity surveyor for landscaping Victoria

### Comparison and decision

11. Should I hire an in-house estimator or outsource landscape estimating?
12. What does it cost to have a landscaping tender priced professionally?
13. Is outsourcing tender estimating worth it for a small landscaping business?
14. In-house estimator vs outsourced takeoffs for a subcontractor
15. How much does a quantity takeoff cost in Australia?

### Informational — where the guides compete

16. How do you price a commercial landscape tender?
17. How do you do a landscape quantity takeoff from drawings?
18. What is a Bill of Quantities in landscaping?
19. How do you price softscape vs hardscape?
20. What preliminaries go into a commercial landscape tender?
21. How much margin should a landscaper add to a tender?
22. How do you calculate topsoil and mulch quantities for a landscape job?
23. How do you price a retaining wall for a commercial job?
24. Why do landscapers lose tenders they should win?
25. How do you read a landscape tender scope?
26. How do you price commercial landscape maintenance?
27. What should be in a landscape tender submission?
28. How do you handle variations on a landscape contract?
29. How do you price an EstimateOne landscaping tender?
30. What are the most common quantity takeoff mistakes?

## Scoring sheet

Copy this into a spreadsheet, one tab per month.

```
Date | Engine | Prompt # | Mentioned | Cited | Position | Competitors named | Sources cited
```

Two numbers to chart over time:

- **Mention rate** = prompts where Tendr was named / total prompts, per engine
- **Citation rate** = prompts where gotendr.com was linked / total prompts

## What to do about a flat line

If after six months impressions in Search Console are not rising *and* mention
rate is still zero, do not simply publish more articles. Audit in this order:

1. **Crawlability.** Confirm each bot gets a 200 with no `noindex`:
   ```
   curl -A "PerplexityBot"  -I https://gotendr.com/
   curl -A "OAI-SearchBot"  -I https://gotendr.com/
   curl -A "ClaudeBot"      -I https://gotendr.com/
   curl -A "Googlebot"      -I https://gotendr.com/
   ```
   Then confirm the content is in the HTML without JavaScript:
   ```
   curl -s https://gotendr.com/guides/pricing/how-to-price-a-commercial-landscape-tender | grep -c takeoff
   ```
   Must be greater than zero.
2. **Content structure.** Is the answer block genuinely answer-first? Are there
   named sources and specific numbers, or just competent prose?
3. **Authority gaps.** No Google Business Profile, no LinkedIn, thin backlinks,
   no case studies. This is the most likely culprit and the slowest to fix.

If a competitor consistently owns your prompts, look at which of their pages get
cited and what those pages do that yours do not.
