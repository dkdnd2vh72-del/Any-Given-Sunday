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


def clean_name(value):
    return re.sub(r"\s+", " ", (value or "").strip())


headers = {
    "User-Agent": "Mozilla/5.0 Any-Given-Sunday-Transaction-Sync/2.0",
    "Accept": "application/json",
}
cookies = {}
if os.getenv("ESPN_S2"):
    cookies["espn_s2"] = os.environ["ESPN_S2"]
if os.getenv("ESPN_SWID"):
    cookies["SWID"] = os.environ["ESPN_SWID"]


def espn_get(params):
    response = requests.get(
        ESPN_URL,
        params=params,
        headers=headers,
        cookies=cookies,
        timeout=30,
    )
    if response.status_code in (401, 403):
        print("ESPN rejected the transaction sync request. Check ESPN_S2/ESPN_SWID.")
        sys.exit(2)
    response.raise_for_status()
    return response.json()


# ESPN's team acquisition counter is useful, but in this league it can lag behind
# the completed transaction ledger. Keep it as one source, not the only source.
league = espn_get([("view", "mTeam"), ("view", "mStatus")])
provider_counters = {}
team_names = {}
for team in league.get("teams", []):
    tid = str(safe_int(team.get("id")))
    if tid == "0":
        continue
    team_names[tid] = clean_name(
        team.get("name")
        or f"{team.get('location', '')} {team.get('nickname', '')}"
    )
    provider_counters[tid] = safe_int(
        (team.get("transactionCounter") or {}).get("acquisitions")
    )

if not provider_counters:
    print("No ESPN teams returned; refusing to overwrite transaction counters.")
    sys.exit(3)

current_period = safe_int(league.get("scoringPeriodId"))
if current_period <= 0:
    current_period = safe_int(
        (league.get("status") or {}).get("currentMatchupPeriod")
    )
if current_period <= 0:
    current_period = 1

# Count every completed player ADD from ESPN's structured transaction ledger from
# scoring period 1 through the current period. Deduplicate by transaction ID so a
# transaction can never be charged twice if ESPN repeats it across period queries.
ledger_counters = {tid: 0 for tid in provider_counters}
seen_transactions = set()

for period in range(1, current_period + 1):
    tx_payload = espn_get(
        [("view", "mTransactions2"), ("scoringPeriodId", period)]
    )
    for transaction in tx_payload.get("transactions", []):
        tx_id = str(transaction.get("id") or "")
        fallback_key = (
            str(period),
            str(transaction.get("processDate") or ""),
            str(transaction.get("teamId") or ""),
            str(transaction.get("type") or ""),
        )
        dedupe_key = ("id", tx_id) if tx_id else ("fallback",) + fallback_key
        if dedupe_key in seen_transactions:
            continue
        seen_transactions.add(dedupe_key)

        status = str(transaction.get("status") or "").upper()
        tx_type = str(transaction.get("type") or "").upper()
        if status not in {"EXECUTED", "COMPLETE", "COMPLETED"}:
            continue
        if tx_type not in {"WAIVER", "FREE_AGENT", "FREEAGENT"}:
            continue

        for item in transaction.get("items", []):
            if str(item.get("type") or "").upper() != "ADD":
                continue
            tid = str(
                safe_int(item.get("toTeamId") or transaction.get("teamId"))
            )
            if tid in ledger_counters:
                ledger_counters[tid] += 1

# data/transactions.json is the client-side source used by app.js. Never allow a
# temporary ESPN undercount to reduce a verified season-to-date total.
tx_path = Path("data/transactions.json")
tx_data = json.loads(tx_path.read_text(encoding="utf-8")) if tx_path.exists() else {}
previous_counters = {
    str(k): safe_int(v)
    for k, v in (tx_data.get("teamCounters") or {}).items()
}

team_counters = {}
for tid in provider_counters:
    team_counters[tid] = max(
        provider_counters.get(tid, 0),
        ledger_counters.get(tid, 0),
        previous_counters.get(tid, 0),
    )

dollars_per_add = safe_int(tx_data.get("dollarsPerAdd", 1)) or 1
tx_data["teamCounters"] = team_counters
tx_data["dollarsPerAdd"] = dollars_per_add
tx_data["leagueTotal"] = sum(team_counters.values()) * dollars_per_add
tx_path.parent.mkdir(exist_ok=True)
tx_path.write_text(json.dumps(tx_data, indent=2) + "\n", encoding="utf-8")

# Keep live.json aligned with the same protected counter values.
live_path = Path("data/live.json")
if live_path.exists():
    live = json.loads(live_path.read_text(encoding="utf-8"))
    for team in live.get("teams", []):
        tid = str(safe_int(team.get("id")))
        if tid in team_counters:
            team["acquisitions"] = team_counters[tid]
    live_path.write_text(json.dumps(live, indent=2, sort_keys=True) + "\n", encoding="utf-8")

# Update static fallbacks as well. app.js still hydrates these values from JSON.
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

print("ESPN team counters:", provider_counters)
print("Verified ledger counters:", ledger_counters)
print("Protected final counters:", team_counters)
print("League transaction pot: $", tx_data["leagueTotal"], sep="")
