// =========================================
// app.js
// Shared behavior for every page plus live-data rendering.
// =========================================

document.addEventListener("DOMContentLoaded", function () {
  var toggleButton = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");

  if (toggleButton && nav) {
    toggleButton.addEventListener("click", function () {
      nav.classList.toggle("open");
    });

    var navLinks = nav.querySelectorAll("a");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
  }

  var currentPage = document.body.getAttribute("data-page");
  var allLinks = document.querySelectorAll(".main-nav a");
  allLinks.forEach(function (link) {
    if (link.getAttribute("data-page") === currentPage) {
      link.classList.add("active");
    }
  });

  var countdownEl = document.getElementById("draft-countdown");
  if (countdownEl) {
    var draftDate = new Date("September 7, 2026 19:30:00 GMT-0400").getTime();

    function updateCountdown() {
      var now = new Date().getTime();
      var distance = draftDate - now;

      if (distance <= 0) {
        countdownEl.textContent = "It's Draft Day!";
        clearInterval(countdownTimer);
        return;
      }

      var days = Math.floor(distance / (1000 * 60 * 60 * 24));
      var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((distance % (1000 * 60)) / 1000);
      countdownEl.textContent = days + "d " + hours + "h " + minutes + "m " + seconds + "s";
    }

    updateCountdown();
    var countdownTimer = setInterval(updateCountdown, 1000);
  }

  function slugify(value) {
    return String(value || "team")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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

    info.appendChild(name);
    info.appendChild(meta);
    row.appendChild(info);
    row.appendChild(points);
    return row;
  }

  function starterSort(a, b) {
    var order = {"QB":0,"RB":1,"WR":2,"TE":3,"FLEX":4,"D/ST":5,"K":6};
    var ao = Object.prototype.hasOwnProperty.call(order, a.slot) ? order[a.slot] : 99;
    var bo = Object.prototype.hasOwnProperty.call(order, b.slot) ? order[b.slot] : 99;
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name));
  }

  function normalizeCurrentTeamNames() {
    var renameMap = {
      "#Numbers": "Burden Of Victory IIIx",
      "Nabers Think I'm Sellin Dope": "The Bowers Rangers"
    };

    document.querySelectorAll(".team-name, .standing-info").forEach(function (node) {
      var currentName = String(node.textContent || "").trim();
      if (Object.prototype.hasOwnProperty.call(renameMap, currentName)) {
        node.textContent = renameMap[currentName];
      }
    });
  }

  async function renderLiveRosters() {
    if (currentPage !== "rosters") return;

    var select = document.getElementById("team-select");
    var main = document.querySelector("main.page-content");
    if (!select || !main) return;

    try {
      var responses = await Promise.all([
        fetch("data/live.json?ts=" + Date.now(), {cache:"no-store"}),
        fetch("data/player-scores.json?ts=" + Date.now(), {cache:"no-store"})
      ]);
      if (!responses[0].ok) return;

      var liveData = await responses[0].json();
      var playerScoreData = responses[1].ok ? await responses[1].json() : {scores:{}};
      var scoreMap = playerScoreData.scores || {};
      var teams = Array.isArray(liveData.teams) ? liveData.teams : [];
      if (!teams.length) return;

      var selectedBeforeRefresh = select.value || sessionStorage.getItem("ags-selected-roster");

      main.querySelectorAll(".roster").forEach(function (node) { node.remove(); });
      select.innerHTML = "";

      teams.forEach(function (team, index) {
        var teamId = team.id;
        var teamName = team.name || ("Team " + teamId);
        var slug = slugify(teamName);

        var option = document.createElement("option");
        option.value = slug;
        option.textContent = teamName;
        select.appendChild(option);

        var roster = document.createElement("div");
        roster.className = "roster";
        roster.id = slug;
        roster.style.display = index === 0 ? "" : "none";

        var starterTitle = document.createElement("h2");
        starterTitle.className = "section-title";
        starterTitle.textContent = "Starters";
        roster.appendChild(starterTitle);

        var note = document.createElement("div");
        note.className = "starter-order-note";
        note.textContent = "QB · RB · RB · WR · WR · TE · FLEX · D/ST · K";
        roster.appendChild(note);

        var starters = (team.roster || []).filter(function (p) {
          return p.slot !== "Bench" && p.slot !== "IR";
        }).sort(starterSort);

        var starterCard = document.createElement("div");
        starterCard.className = "card";
        starters.forEach(function (player) {
          starterCard.appendChild(playerRow(player, scoreMap));
        });

        var calculatedStarterTotal = starters.reduce(function (sum, player) {
          return sum + livePlayerPoints(player, scoreMap);
        }, 0);
        var officialTeamTotal = Number(team.actual);
        var teamTotal = Number.isFinite(officialTeamTotal) ? officialTeamTotal : calculatedStarterTotal;

        var scoreTotal = document.createElement("div");
        scoreTotal.className = "player-row team-total-score";
        var scoreLabel = document.createElement("strong");
        scoreLabel.textContent = "Total";
        var scoreValue = document.createElement("strong");
        scoreValue.textContent = teamTotal.toFixed(2);
        scoreTotal.appendChild(scoreLabel);
        scoreTotal.appendChild(scoreValue);
        starterCard.appendChild(scoreTotal);

        roster.appendChild(starterCard);

        var reserveTitle = document.createElement("h2");
        reserveTitle.className = "section-title bench-title";
        reserveTitle.textContent = "Bench / IR";
        roster.appendChild(reserveTitle);

        var reserveCard = document.createElement("div");
        reserveCard.className = "card";
        (team.roster || []).filter(function (p) {
          return p.slot === "Bench" || p.slot === "IR";
        }).sort(function (a, b) {
          if (a.slot !== b.slot) return a.slot === "Bench" ? -1 : 1;
          return String(a.name).localeCompare(String(b.name));
        }).forEach(function (player) {
          reserveCard.appendChild(playerRow(player, scoreMap));
        });
        roster.appendChild(reserveCard);

        main.appendChild(roster);
      });

      if (selectedBeforeRefresh && Array.from(select.options).some(function (option) { return option.value === selectedBeforeRefresh; })) {
        select.value = selectedBeforeRefresh;
      }

      function showSelectedRoster() {
        main.querySelectorAll(".roster").forEach(function (node) {
          node.style.display = node.id === select.value ? "" : "none";
        });
        sessionStorage.setItem("ags-selected-roster", select.value);
      }

      showSelectedRoster();
      select.onchange = showSelectedRoster;
    } catch (error) {
      console.warn("Live roster data could not be rendered; using embedded fallback.", error);
    }
  }

  async function renderLiveMatchups() {
    if (currentPage !== "matchups") return;
    var weekBlock = document.getElementById("week-1");
    if (!weekBlock) return;

    try {
      var response = await fetch("data/matchups.json?ts=" + Date.now(), {cache:"no-store"});
      if (!response.ok) return;
      var data = await response.json();
      var matchups = Array.isArray(data.matchups) ? data.matchups : [];
      if (!matchups.length) return;

      var title = weekBlock.querySelector(".section-title");
      weekBlock.innerHTML = "";
      if (title) weekBlock.appendChild(title);

      matchups.forEach(function (matchup) {
        var card = document.createElement("div");
        card.className = "card matchup-card";

        [matchup.home, matchup.away].forEach(function (team, index) {
          if (index === 1) {
            var vs = document.createElement("div");
            vs.className = "matchup-vs";
            vs.textContent = "vs";
            card.appendChild(vs);
          }

          var line = document.createElement("div");
          line.className = "team-line";

          var name = document.createElement("span");
          name.className = "team-name";
          name.textContent = team.teamName;

          var score = document.createElement("span");
          score.className = "team-score";
          score.appendChild(document.createTextNode(Number(team.score || 0).toFixed(2)));
          score.appendChild(document.createElement("br"));

          var projection = document.createElement("span");
          projection.style.fontSize = "0.75rem";
          projection.style.fontStyle = "italic";
          projection.style.fontWeight = "normal";
          projection.textContent = Number(team.projection || 0).toFixed(2);
          score.appendChild(projection);

          line.appendChild(name);
          line.appendChild(score);
          card.appendChild(line);
        });

        weekBlock.appendChild(card);
      });
    } catch (error) {
      console.warn("Live matchup data could not be rendered; using embedded fallback.", error);
    }
  }

  async function renderLiveStandings() {
    if (currentPage !== "standings") return;
    var tbody = document.querySelector(".standings-table tbody");
    if (!tbody) return;

    try {
      var response = await fetch("data/standings.json?ts=" + Date.now(), {cache:"no-store"});
      if (!response.ok) return;
      var data = await response.json();
      var teams = Array.isArray(data.teams) ? data.teams : [];
      if (!teams.length) return;

      tbody.innerHTML = "";
      teams.forEach(function (team) {
        var tr = document.createElement("tr");
        var values = [team.teamName, team.wins, team.losses, Number(team.pointsFor || 0).toFixed(1)];
        values.forEach(function (value, index) {
          var td = document.createElement("td");
          if (index > 0) td.className = "num";
          td.textContent = value;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.warn("Live standings data could not be rendered; using embedded fallback.", error);
    }
  }

  async function renderTransactionData() {
    if (currentPage !== "home" && currentPage !== "transactions") return;

    try {
      var response = await fetch("data/transactions.json?ts=" + Date.now(), {cache:"no-store"});
      if (!response.ok) return;
      var data = await response.json();
      var counters = data.teamCounters || {};
      var dollarsPerAdd = Number(data.dollarsPerAdd || 1);

      if (currentPage === "home") {
        var totalEl = document.getElementById("league-transaction-total");
        if (totalEl) totalEl.textContent = "$" + Number(data.leagueTotal || 0).toFixed(0);
      }

      if (currentPage === "transactions") {
        document.querySelectorAll("#transaction-counter-table tbody tr[data-team-id]").forEach(function (row) {
          var teamId = row.getAttribute("data-team-id");
          var adds = Number(counters[teamId] || 0);
          var addsEl = row.querySelector(".transaction-adds");
          var dollarsEl = row.querySelector(".transaction-dollars");
          if (addsEl) addsEl.textContent = String(adds);
          if (dollarsEl) dollarsEl.textContent = "$" + (adds * dollarsPerAdd).toFixed(0);
        });
      }
    } catch (error) {
      console.warn("Transaction data could not be rendered; using embedded fallback.", error);
    }
  }

  normalizeCurrentTeamNames();
  renderLiveRosters();
  renderLiveMatchups();
  renderLiveStandings();
  renderTransactionData();

  if (currentPage === "rosters") {
    setInterval(renderLiveRosters, 30000);
  }
});
