(function () {
  var container = document.getElementById("live-matchups");
  var select = document.getElementById("week-select");
  var title = document.getElementById("matchups-week-title");
  if (!container) return;

  function normalizeName(name) {
    var map = {
      "#Numbers": "Burden Of Victory IIIx",
      "Nabers Think I'm Sellin Dope": "The Bowers Rangers"
    };
    return map[name] || name || "Team";
  }

  function initials(name) {
    return normalizeName(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (word) {
      return word.charAt(0).toUpperCase();
    }).join("");
  }

  function makeTeamSide(team) {
    var side = document.createElement("div");
    side.className = "matchup-team-side";

    var avatar = document.createElement("div");
    avatar.className = "team-avatar";
    avatar.textContent = initials(team.teamName || team.name);

    var name = document.createElement("div");
    name.className = "matchup-team-name";
    name.textContent = normalizeName(team.teamName || team.name);

    var score = document.createElement("div");
    score.className = "matchup-big-score";
    score.textContent = Number(team.score || 0).toFixed(2);

    var projection = document.createElement("div");
    projection.className = "matchup-projection";
    projection.textContent = "Proj. " + Number(team.projection || 0).toFixed(2);

    side.appendChild(avatar);
    side.appendChild(name);
    side.appendChild(score);
    side.appendChild(projection);
    return side;
  }

  function makeProjectionBar(home, away) {
    var homeProjection = Math.max(0, Number(home.projection || 0));
    var awayProjection = Math.max(0, Number(away.projection || 0));
    var total = homeProjection + awayProjection;
    var homePct = total > 0 ? Math.round((homeProjection / total) * 100) : 50;
    var awayPct = 100 - homePct;
    var homeFavored = homeProjection >= awayProjection;

    var wrap = document.createElement("div");
    wrap.className = "edge-wrap";

    var labels = document.createElement("div");
    labels.className = "edge-labels";
    labels.innerHTML = "<span>" + homePct + "%</span><small>Projection Edge</small><span>" + awayPct + "%</span>";

    var bar = document.createElement("div");
    bar.className = "edge-bar";
    bar.style.position = "relative";
    bar.style.background = "#2a4053";

    var marker = document.createElement("span");
    marker.style.position = "absolute";
    marker.style.top = "0";
    marker.style.bottom = "0";
    marker.style.width = (homeFavored ? homePct : awayPct) + "%";
    marker.style.background = "linear-gradient(90deg,#a9ea2d,var(--lime))";
    marker.style.boxShadow = "0 0 10px rgba(201,255,54,.35)";
    marker.style.left = homeFavored ? "0" : "auto";
    marker.style.right = homeFavored ? "auto" : "0";
    marker.style.borderRadius = "999px";

    var midpoint = document.createElement("i");
    midpoint.setAttribute("aria-hidden", "true");
    midpoint.style.position = "absolute";
    midpoint.style.left = "50%";
    midpoint.style.top = "-2px";
    midpoint.style.bottom = "-2px";
    midpoint.style.width = "1px";
    midpoint.style.background = "rgba(255,255,255,.42)";
    midpoint.style.zIndex = "2";

    bar.appendChild(marker);
    bar.appendChild(midpoint);
    wrap.appendChild(labels);
    wrap.appendChild(bar);
    return wrap;
  }

  function makeCard(matchup) {
    var home = matchup.home || {};
    var away = matchup.away || {};
    var card = document.createElement("div");
    card.className = "live-matchup-card";

    var top = document.createElement("div");
    top.className = "matchup-status-row";
    var live = document.createElement("span");
    live.className = "live-badge";
    live.textContent = "LIVE";
    var note = document.createElement("span");
    note.className = "matchup-details-link";
    note.textContent = "Official live score";
    top.appendChild(live);
    top.appendChild(note);

    var teams = document.createElement("div");
    teams.className = "matchup-faceoff";
    teams.appendChild(makeTeamSide(home));
    var versus = document.createElement("div");
    versus.className = "matchup-versus";
    versus.textContent = "VS";
    teams.appendChild(versus);
    teams.appendChild(makeTeamSide(away));

    card.appendChild(top);
    card.appendChild(teams);
    card.appendChild(makeProjectionBar(home, away));
    return card;
  }

  async function loadLive() {
    var response = await fetch("data/live.json?ts=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("live data unavailable");
    return response.json();
  }

  function showUnavailableWeek(week) {
    container.innerHTML = '<div class="empty-week-card"><strong>Week ' + week + '</strong><span>Live matchup cards will appear here when that week becomes available.</span></div>';
  }

  async function render() {
    try {
      var data = await loadLive();
      var liveWeek = Number(data.week || data.scoringPeriod || 1);
      var requestedWeek = select ? Number(select.value || liveWeek) : liveWeek;
      if (select && !select.dataset.userChanged) select.value = String(liveWeek);
      requestedWeek = select ? Number(select.value || liveWeek) : liveWeek;
      if (title) title.textContent = "Week " + requestedWeek;

      if (requestedWeek !== liveWeek) {
        showUnavailableWeek(requestedWeek);
        return;
      }

      container.innerHTML = "";
      (data.matchups || []).forEach(function (matchup) {
        container.appendChild(makeCard(matchup));
      });
      if (!(data.matchups || []).length) {
        container.innerHTML = '<div class="app-loading">No live matchups are available yet.</div>';
      }
    } catch (error) {
      container.innerHTML = '<div class="app-loading">Live matchup data is temporarily unavailable.</div>';
    }
  }

  if (select) {
    select.addEventListener("change", function () {
      select.dataset.userChanged = "true";
      render();
    });
  }

  render();
  setInterval(render, 10000);
})();