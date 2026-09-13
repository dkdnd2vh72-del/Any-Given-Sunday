import json
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

LEAGUE_ID = "820399"
SEASON = 2026
ESPN_URL = (
    f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{SEASON}/"
    f"segments/0/leagues/{LEAGUE_ID}"
)


def safe_int(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


headers = {
    "User-Agent": "Mozilla/5.0 Any-Given-Sunday-Transaction-Sync/1.0",
    "Accept": "application/json",
}
cookies = {}
if os.getenv("ESPN_S2"):
    cookies["espn_s2"] = os.environ["ESPN_S2"]
if os.getenv("ESPN_SWID"):
    cookies["SWID"] = os.environ["ESPN_SWID"]

# IMPORTANT: Do not send scoringPeriodId here. transactionCounter.acquisitions is
# a season-to-date team counter; scoping this request to the current scoring period
# can return stale/partial acquisition totals.
response = requests.get(
    ESPN_URL,
    params=[("view", "mTeam")],
    headers=headers,
    cookies=cookies,
    timeout=30,
)
if response.status_code in (401, 403):
    print("ESPN rejected cumulative transaction-counter request. Check ESPN_S2/ESPN_SWID.")
    sys.exit(2)
response.raise_for_status()
league = response.json()

team_counters = {}
team_names = {}
for team in league.get("teams", []):
    tid = str(safe_int(team.get("id")))
    if tid == "0":
        continue
    name = re.sub(r"\s+", " ", (team.get("name") or f"{team.get('location', '')} {team.get('nickname', '')}").strip())
    counter = team.get("transactionCounter") or {}
    if "acquisitions" not in counter:
        print(f"Missing transactionCounter.acquisitions for team {tid}; refusing to overwrite counters with partial data.")
        sys.exit(3)
    team_counters[tid] = safe_int(counter.get("acquisitions"))
    team_names[tid] = name

if not team_counters:
    print("No cumulative acquisition counters returned by ESPN.")
    sys.exit(3)

# Keep data/transactions.json as the single client-side source for the counter.
tx_path = Path("data/transactions.json")
tx_data = json.loads(tx_path.read_text(encoding="utf-8")) if tx_path.exists() else {}
dollars_per_add = safe_int(tx_data.get("dollarsPerAdd", 1)) or 1
tx_data["teamCounters"] = team_counters
tx_data["dollarsPerAdd"] = dollars_per_add
tx_data["leagueTotal"] = sum(team_counters.values()) * dollars_per_add
tx_path.parent.mkdir(exist_ok=True)
tx_path.write_text(json.dumps(tx_data, indent=2) + "\n", encoding="utf-8")

# Keep live.json's acquisitions field aligned with the same cumulative source.
live_path = Path("data/live.json")
if live_path.exists():
    live = json.loads(live_path.read_text(encoding="utf-8"))
    for team in live.get("teams", []):
        tid = str(safe_int(team.get("id")))
        if tid in team_counters:
            team["acquisitions"] = team_counters[tid]
    live_path.write_text(json.dumps(live, indent=2, sort_keys=True) + "\n", encoding="utf-8")

# Update static fallbacks too; app.js will then hydrate from the same JSON values.
transactions_path = Path("transactions.html")
if transactions_path.exists():
    soup = BeautifulSoup(transactions_path.read_text(encoding="utf-8"), "html.parser")
    table = soup.find("table", id="transaction-counter-table")
    if table:
        for row in table.select("tbody tr[data-team-id]"):
            tid = str(row.get("data-team-id", ""))
            if tid not in team_counters:
                continue
            adds = team_counters[tid]
            name_el = row.select_one(".transaction-team-name")
            adds_el = row.select_one(".transaction-adds")
            dollars_el = row.select_one(".transaction-dollars")
            if name_el and team_names.get(tid):
                name_el.string = team_names[tid]
            if adds_el:
                adds_el.string = str(adds)
            if dollars_el:
                dollars_el.string = f"${adds * dollars_per_add}"
    transactions_path.write_text(str(soup), encoding="utf-8")

index_path = Path("index.html")
if index_path.exists():
    soup = BeautifulSoup(index_path.read_text(encoding="utf-8"), "html.parser")
    total_el = soup.find(id="league-transaction-total")
    if total_el:
        total_el.string = f"${tx_data['leagueTotal']}"
    index_path.write_text(str(soup), encoding="utf-8")

print("Cumulative acquisition counters:", team_counters)
print("League transaction pot: $", tx_data["leagueTotal"], sep="")
