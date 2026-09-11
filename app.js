document.addEventListener("DOMContentLoaded", function () {
  var currentPage = document.body.getAttribute("data-page");
  var nav = document.querySelector(".main-nav");
  var toggleButton = document.querySelector(".nav-toggle");

  if (toggleButton && nav) {
    toggleButton.addEventListener("click", function () { nav.classList.toggle("open"); });
  }

  document.querySelectorAll(".main-nav a").forEach(function (link) {
    if (link.getAttribute("data-page") === currentPage) link.classList.add("active");
  });

  function normalizeName(name) {
    var map = {
      "#Numbers": "Burden Of Victory IIIx",
      "Nabers Think I'm Sellin Dope": "The Bowers Rangers"
    };
    return map[name] || name || "Team";
  }

  function initials(name) {
    return normalizeName(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }

  function teamAvatar(team) {
    var el = document.createElement("div");
    el.className = "team-avatar";
    el.textContent = initials(team.teamName || team.name);
    return el;
  }

  function projectionEdge(a, b) {
    var ap = Math.max(0, Number(a.projection || 0));
    var bp = Math.max(0, Number(b.projection || 0));
    if (ap + bp === 0) return [50, 50];
    var left = Math.round((ap / (ap + bp)) * 100);
    return [left, 100 - left];
  }

  function makeMatchupCard(matchup) {
    var home = matchup.home || {};
    var away = matchup.away || {};
    var edge = projectionEdge(home, away);
    var card = document.createElement("a");
    card.className = "live-matchup-card";
    card.href = "matchups.html";

    var top = document.createElement("div");
    top.className = "matchup-status-row";
    var live = document.createElement("span");
    live.className = "live-badge";
    live.textContent = "LIVE";
    var details = document.createElement("span");
    details.className = "matchup-details-link";
    details.textContent = "Matchup details ›";
    top.appendChild(live);
    top.appendChild(details);

    var teams = document.createElement("div");
    teams.className = "matchup-faceoff";

    [home, away].forEach(function (team, index) {
      var side = document.createElement("div");
      side.className = "matchup-team-side";
      side.appendChild(teamAvatar(team));

      var name = document.createElement("div");
      name.className = "matchup-team-name";
      name.textContent = normalizeName(team.teamName || team.name);

      var score = document.createElement("div");
      score.className = "matchup-big-score";
      score.textContent = Number(team.score || 0).toFixed(2);

      var proj = document.createElement("div");
      proj.className = "matchup-projection";
      proj.textContent = "Proj. " + Number(team.projection || 0).toFixed(2);

      side.appendChild(name);
      side.appendChild(score);
      side.appendChild(proj);
      teams.appendChild(side);

      if (index === 0) {
        var versus = document.createElement("div");
        versus.className = "matchup-versus";
        versus.textContent = "VS";
        teams.appendChild(versus);
      }
    });

    var edgeWrap = document.createElement("div");
    edgeWrap.className = "edge-wrap";
    var edgeLabels = document.createElement("div");
    edgeLabels.className = "edge-labels";
    edgeLabels.innerHTML = "<span>" + edge[0] + "%</span><small>Projection Edge</small><span>" + edge[1] + "%</span>";
    var bar = document.createElement("div");
    bar.className = "edge-bar";
    var fill = document.createElement("span");
    fill.style.width = edge[0] + "%";
    bar.appendChild(fill);
    edgeWrap.appendChild(edgeLabels);
    edgeWrap.appendChild(bar);

    card.appendChild(top);
    card.appendChild(teams);
    card.appendChild(edgeWrap);
    return card;
  }

  async function fetchMatchupData() {
    var response = await fetch("data/matchups.json?ts=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("matchup data unavailable");
    return response.json();
  }

  async function renderHomeMatchups() {
    if (currentPage !== "home") return;
    var container = document.getElementById("home-live-matchups");
    if (!container) return;
    try {
      var data = await fetchMatchupData();
      var matchups = Array.isArray(data.matchups) ? data.matchups : [];
      container.innerHTML = "";
      matchups.forEach(function (matchup) { container.appendChild(makeMatchupCard(matchup)); });
      var weekLabel = document.getElementById("home-week-label");
      if (weekLabel) weekLabel.textContent = "Week " + (data.week || 1);
    } catch (error) {
      container.innerHTML = '<div class="app-loading">Live matchup data is temporarily unavailable.</div>';
    }
  }

  async function renderMatchupsPage() {
    if (currentPage !== "matchups") return;
    var container = document.getElementById("live-matchups");
    var select = document.getElementById("week-select");
    var title = document.getElementById("matchups-week-title");
    if (!container) return;
    try {
      var data = await fetchMatchupData();
      var liveWeek = Number(data.week || 1);
      if (select) select.value = String(liveWeek);
      if (title) title.textContent = "Week " + liveWeek;
      container.innerHTML = "";
      (data.matchups || []).forEach(function (matchup) { container.appendChild(makeMatchupCard(matchup)); });

      if (select) {
        select.addEventListener("change", function () {
          var requested = Number(select.value);
          title.textContent = "Week " + requested;
          if (requested !== liveWeek) {
            container.innerHTML = '<div class="empty-week-card"><strong>Week ' + requested + '</strong><span>Live matchup cards will appear here when that week becomes available.</span></div>';
          } else {
            container.innerHTML = "";
            (data.matchups || []).forEach(function (matchup) { container.appendChild(makeMatchupCard(matchup)); });
          }
        });
      }
    } catch (error) {
      container.innerHTML = '<div class="app-loading">Matchup data is temporarily unavailable.</div>';
    }
  }

  function positionClass(position) {
    if (position === "D/ST") return "pos-dst";
    return "pos-" + String(position || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function livePlayerPoints(player, scoreMap) {
    var playerId = String(player.id || player.playerId || "");
    return scoreMap && Object.prototype.hasOwnProperty.call(scoreMap, playerId)
      ? Number(scoreMap[playerId] || 0)
      : Number(player.actual || 0);
  }

  function starterSort(a, b) {
    var order = { "QB":0, "RB":1, "WR":2, "TE":3, "FLEX":4, "D/ST":5, "K":6 };
    var ao = Object.prototype.hasOwnProperty.call(order, a.slot) ? order[a.slot] : 99;
    var bo = Object.prototype.hasOwnProperty.call(order, b.slot) ? order[b.slot] : 99;
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name));
  }

  function playerRow(player, scoreMap) {
    var row = document.createElement("div");
    row.className = "player-row";
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
    points.className = "player-points";
    points.textContent = livePlayerPoints(player, scoreMap).toFixed(2);
    info.appendChild(name); info.appendChild(meta); row.appendChild(info); row.appendChild(points);
    return row;
  }

  async function renderLiveRosters() {
    if (currentPage !== "rosters") return;
    var select = document.getElementById("team-select");
    var main = document.querySelector("main.page-content");
    if (!select || !main) return;
    try {
      var responses = await Promise.all([
        fetch("data/live.json?ts=" + Date.now(), { cache:"no-store" }),
        fetch("data/player-scores.json?ts=" + Date.now(), { cache:"no-store" })
      ]);
      if (!responses[0].ok) return;
      var liveData = await responses[0].json();
      var scoreData = responses[1].ok ? await responses[1].json() : { scores:{} };
      var scoreMap = scoreData.scores || {};
      var teams = Array.isArray(liveData.teams) ? liveData.teams : [];
      if (!teams.length) return;
      var selected = select.value || sessionStorage.getItem("ags-selected-roster");
      main.querySelectorAll(".roster").forEach(function (node) { node.remove(); });
      select.innerHTML = "";

      teams.forEach(function (team, index) {
        var name = normalizeName(team.name || "Team " + team.id);
        var slug = name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        var option = document.createElement("option"); option.value = slug; option.textContent = name; select.appendChild(option);
        var roster = document.createElement("div"); roster.className = "roster"; roster.id = slug; roster.style.display = index === 0 ? "" : "none";
        var h2 = document.createElement("h2"); h2.className = "section-title"; h2.textContent = "Starters"; roster.appendChild(h2);
        var starters = (team.roster || []).filter(function (p) { return p.slot !== "Bench" && p.slot !== "IR"; }).sort(starterSort);
        var card = document.createElement("div"); card.className = "card";
        starters.forEach(function (p) { card.appendChild(playerRow(p, scoreMap)); });
        var calculated = starters.reduce(function (sum, p) { return sum + livePlayerPoints(p, scoreMap); }, 0);
        var official = Number(team.actual);
        var total = Number.isFinite(official) ? official : calculated;
        var totalRow = document.createElement("div"); totalRow.className = "player-row team-total-score";
        totalRow.innerHTML = "<strong>Total</strong><strong>" + total.toFixed(2) + "</strong>";
        card.appendChild(totalRow); roster.appendChild(card);
        var bench = document.createElement("h2"); bench.className = "section-title bench-title"; bench.textContent = "Bench / IR"; roster.appendChild(bench);
        var benchCard = document.createElement("div"); benchCard.className = "card";
        (team.roster || []).filter(function (p) { return p.slot === "Bench" || p.slot === "IR"; }).forEach(function (p) { benchCard.appendChild(playerRow(p, scoreMap)); });
        roster.appendChild(benchCard); main.appendChild(roster);
      });

      if (selected && Array.from(select.options).some(function (o) { return o.value === selected; })) select.value = selected;
      function showRoster() {
        main.querySelectorAll(".roster").forEach(function (node) { node.style.display = node.id === select.value ? "" : "none"; });
        sessionStorage.setItem("ags-selected-roster", select.value);
      }
      showRoster(); select.onchange = showRoster;
    } catch (error) {}
  }

  async function renderLiveStandings() {
    if (currentPage !== "standings") return;
    var tbody = document.querySelector(".standings-table tbody");
    if (!tbody) return;
    try {
      var response = await fetch("data/standings.json?ts=" + Date.now(), { cache:"no-store" });
      if (!response.ok) return;
      var data = await response.json(); tbody.innerHTML = "";
      (data.teams || []).forEach(function (team) {
        var tr = document.createElement("tr");
        [normalizeName(team.teamName), team.wins, team.losses, Number(team.pointsFor || 0).toFixed(1)].forEach(function (value, i) {
          var td = document.createElement("td"); if (i > 0) td.className = "num"; td.textContent = value; tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (error) {}
  }

  async function renderTransactionData() {
    if (currentPage !== "home" && currentPage !== "transactions") return;
    try {
      var response = await fetch("data/transactions.json?ts=" + Date.now(), { cache:"no-store" });
      if (!response.ok) return;
      var data = await response.json();
      var totalEl = document.getElementById("league-transaction-total");
      if (totalEl) totalEl.textContent = "$" + Number(data.leagueTotal || 0).toFixed(0);
      if (currentPage === "transactions") {
        var counters = data.teamCounters || {}; var dollarsPerAdd = Number(data.dollarsPerAdd || 1);
        document.querySelectorAll("#transaction-counter-table tbody tr[data-team-id]").forEach(function (row) {
          var id = row.getAttribute("data-team-id"); var adds = Number(counters[id] || 0);
          var addsEl = row.querySelector(".transaction-adds"); var dollarsEl = row.querySelector(".transaction-dollars");
          if (addsEl) addsEl.textContent = adds; if (dollarsEl) dollarsEl.textContent = "$" + (adds * dollarsPerAdd).toFixed(0);
        });
      }
    } catch (error) {}
  }

  renderHomeMatchups();
  renderMatchupsPage();
  renderLiveRosters();
  renderLiveStandings();
  renderTransactionData();

  if (currentPage === "home" || currentPage === "matchups") {
    setInterval(function () {
      if (currentPage === "home") renderHomeMatchups();
      if (currentPage === "matchups") renderMatchupsPage();
    }, 30000);
  }
  if (currentPage === "rosters") setInterval(renderLiveRosters, 30000);
});