document.addEventListener("DOMContentLoaded", function () {
  var select = document.getElementById("team-select");
  var container = document.getElementById("rosters-live");
  var status = document.getElementById("roster-refresh-status");
  if (!select || !container) return;

  document.querySelectorAll(".main-nav a").forEach(function (link) {
    if (link.getAttribute("data-page") === "rosters") link.classList.add("active");
  });

  var lastSignature = "";
  var latestTeams = [];
  var refreshInFlight = false;

  function normalizeName(name) {
    var map = {
      "#Numbers": "Burden Of Victory IIIx",
      "Nabers Think I'm Sellin Dope": "The Bowers Rangers"
    };
    return map[name] || name || "Team";
  }

  function slugify(name) {
    return normalizeName(name)
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function positionClass(position) {
    if (position === "D/ST") return "pos-dst";
    return "pos-" + String(position || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function starterSort(a, b) {
    var order = { "QB":0, "RB":1, "WR":2, "TE":3, "FLEX":4, "D/ST":5, "K":6 };
    var ao = Object.prototype.hasOwnProperty.call(order, a.slot) ? order[a.slot] : 99;
    var bo = Object.prototype.hasOwnProperty.call(order, b.slot) ? order[b.slot] : 99;
    if (ao !== bo) return ao - bo;
    return String(a.name || "").localeCompare(String(b.name || ""));
  }

  function playerScore(player) {
    var score = Number(player && player.actual);
    return Number.isFinite(score) ? score : 0;
  }

  function rosterSignature(teams) {
    return teams.map(function (team) {
      return String(team.id) + ":" + (team.roster || []).map(function (p) {
        return String(p.id || p.playerId || "") + "@" + String(p.slot || "");
      }).join(",");
    }).join("|");
  }

  function makePlayerRow(player, teamId) {
    var row = document.createElement("div");
    row.className = "player-row";
    row.setAttribute("data-player-id", String(player.id || player.playerId || ""));
    row.setAttribute("data-team-id", String(teamId));

    var info = document.createElement("div");
    info.className = "player-info";

    var name = document.createElement("span");
    name.className = "team-name";
    var badge = document.createElement("span");
    badge.className = "player-position " + positionClass(player.position);
    badge.textContent = player.position || "—";
    name.appendChild(badge);
    name.appendChild(document.createTextNode(player.name || "Unknown Player"));

    var meta = document.createElement("span");
    meta.className = "player-meta";
    meta.textContent = (player.proTeam || "") + " · " + (player.slot || "Bench");

    var points = document.createElement("span");
    points.className = "player-points live-player-score";
    points.textContent = playerScore(player).toFixed(2);

    info.appendChild(name);
    info.appendChild(meta);
    row.appendChild(info);
    row.appendChild(points);
    return row;
  }

  function showSelectedRoster() {
    var selected = select.value;
    container.querySelectorAll(".roster").forEach(function (node) {
      node.style.display = node.getAttribute("data-roster-key") === selected ? "" : "none";
    });
    try { sessionStorage.setItem("ags-selected-roster", selected); } catch (e) {}
  }

  function buildRosters(teams) {
    var previous = select.value;
    try { previous = previous || sessionStorage.getItem("ags-selected-roster") || ""; } catch (e) {}

    select.innerHTML = "";
    container.innerHTML = "";

    teams.forEach(function (team, index) {
      var name = normalizeName(team.name || "Team " + team.id);
      var key = slugify(name);

      var option = document.createElement("option");
      option.value = key;
      option.textContent = name;
      select.appendChild(option);

      var roster = document.createElement("section");
      roster.className = "roster";
      roster.setAttribute("data-roster-key", key);
      roster.setAttribute("data-team-id", String(team.id));
      roster.style.display = "none";

      var startersTitle = document.createElement("h2");
      startersTitle.className = "section-title";
      startersTitle.textContent = "Starters";
      roster.appendChild(startersTitle);

      var starters = (team.roster || []).filter(function (p) {
        return p.slot !== "Bench" && p.slot !== "IR";
      }).sort(starterSort);

      var starterCard = document.createElement("div");
      starterCard.className = "card";
      starters.forEach(function (player) {
        starterCard.appendChild(makePlayerRow(player, team.id));
      });

      var totalRow = document.createElement("div");
      totalRow.className = "player-row team-total-score";
      totalRow.innerHTML = '<strong>Total</strong><strong class="live-team-total" data-team-id="' + String(team.id) + '">0.00</strong>';
      starterCard.appendChild(totalRow);
      roster.appendChild(starterCard);

      var benchTitle = document.createElement("h2");
      benchTitle.className = "section-title bench-title";
      benchTitle.textContent = "Bench / IR";
      roster.appendChild(benchTitle);

      var benchCard = document.createElement("div");
      benchCard.className = "card";
      (team.roster || []).filter(function (p) {
        return p.slot === "Bench" || p.slot === "IR";
      }).forEach(function (player) {
        benchCard.appendChild(makePlayerRow(player, team.id));
      });
      roster.appendChild(benchCard);
      container.appendChild(roster);
    });

    if (previous && Array.from(select.options).some(function (o) { return o.value === previous; })) {
      select.value = previous;
    } else if (select.options.length) {
      select.selectedIndex = 0;
    }
    select.onchange = showSelectedRoster;
    showSelectedRoster();
  }

  function updateScoresInPlace(teams) {
    var playerById = {};
    teams.forEach(function (team) {
      (team.roster || []).forEach(function (player) {
        playerById[String(player.id || player.playerId || "")] = player;
      });
    });

    container.querySelectorAll(".player-row[data-player-id]").forEach(function (row) {
      var player = playerById[row.getAttribute("data-player-id")];
      if (!player) return;
      var scoreEl = row.querySelector(".live-player-score");
      if (scoreEl) {
        var next = playerScore(player).toFixed(2);
        if (scoreEl.textContent !== next) scoreEl.textContent = next;
      }
    });

    teams.forEach(function (team) {
      var totalEl = container.querySelector('.live-team-total[data-team-id="' + String(team.id) + '"]');
      if (!totalEl) return;
      var official = Number(team.actual);
      var starters = (team.roster || []).filter(function (p) { return p.slot !== "Bench" && p.slot !== "IR"; });
      var calculated = starters.reduce(function (sum, p) { return sum + playerScore(p); }, 0);
      var total = Number.isFinite(official) ? official : calculated;
      var next = total.toFixed(2);
      if (totalEl.textContent !== next) totalEl.textContent = next;
    });
  }

  async function refreshRosters() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      var response = await fetch("data/live.json?ts=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("live roster data unavailable");
      var data = await response.json();
      var teams = Array.isArray(data.teams) ? data.teams : [];
      if (!teams.length) throw new Error("no teams returned");

      latestTeams = teams;
      var signature = rosterSignature(teams);
      if (signature !== lastSignature) {
        buildRosters(teams);
        lastSignature = signature;
      }
      updateScoresInPlace(teams);
      if (status) status.textContent = "Live · updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    } catch (error) {
      if (status) status.textContent = "Live data temporarily unavailable";
      if (!lastSignature) container.innerHTML = '<div class="app-loading">Roster data is temporarily unavailable.</div>';
    } finally {
      refreshInFlight = false;
    }
  }

  refreshRosters();
  setInterval(refreshRosters, 10000);
});