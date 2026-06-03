# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RECHERCHE-JOB is a daily job search automation tool for Lille, France. It scrapes job listings using JSearch RapidAPI, filters them, and sends results to Discord via webhook. CSV files are saved to the repo daily.

## Architecture

- **Orchestration**: GitHub Actions workflow (`.github/workflows/search-jobs.yml`)
- **API**: JSearch RapidAPI (`jsearch.p.rapidapi.com/search`)
- **Notifications**: Discord webhook
- **Storage**: CSV files (`job_offers_YYYY-MM-DD.csv`)
- **Scheduling**: Daily at 7h UTC (Paris time), Monday-Friday

## Key Configuration

### Filters (Workflow Python Code)

Edit filters in `.github/workflows/search-jobs.yml` around line 26:

```python
EXCLUDE_KEYWORDS = ['caces', 'expérience requise', 'years of experience']
```

Only jobs WITHOUT these keywords are kept. Add keywords to exclude more results. Commit triggers next workflow run.

### Required Secrets (GitHub)

- `RAPIDAPI_KEY`: JSearch API key (set in GitHub Secrets, not exposed here)
- `DISCORD_WEBHOOK`: Webhook URL for Discord notifications (set in GitHub Secrets, not exposed here)

### API Parameters

JSearch endpoint: `https://jsearch.p.rapidapi.com/search`

Critical: Always include `&country=fr` to filter France results. Without it, defaults to US and returns 0 results for Lille.

## Common Tasks

### Modify Job Filters

1. Open `.github/workflows/search-jobs.yml` on GitHub
2. Edit `EXCLUDE_KEYWORDS` list (line ~26)
3. Commit changes
4. Next scheduled run (7h Paris time) uses new filters

**Examples:**
- Add `'CDI'` to exclude permanent contracts
- Add `'temps plein'` to exclude full-time
- Add `'part-time'` to exclude part-time

### Check Recent Results

1. Go to repo root
2. View latest `job_offers_YYYY-MM-DD.csv`
3. Or check Discord channel for daily notifications

### Manual Trigger

Use GitHub Actions UI or API:
```bash
curl -X POST \
  -H "Authorization: token <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ref":"master"}' \
  "https://api.github.com/repos/clement-rubin/RECHERCHE-JOB/actions/workflows/search-jobs.yml/dispatches"
```

## Troubleshooting

- **0 results**: Check `country=fr` parameter is in workflow URL
- **Wrong jobs returned**: Filters too permissive or API keywords unclear
- **Discord not sending**: Webhook URL invalid or revoked
- **CSV empty**: API error (check workflow logs) or all results filtered

## Workflow Details

Input: Query (default: `'jobs Lille'`)
Output: 
- CSV file with columns: Titre, Entreprise, Lien, Ville
- Discord embed with up to 15 results
- Max 20 jobs per run

Retry logic: On API failure, CSV gets empty row with error status.
