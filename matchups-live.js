(function () {
  var container = document.getElementById("live-matchups");
  var select = document.getElementById("week-select");
  var title = document.getElementById("matchups-week-title");
  var openMatchupKey = null;
  if (!container) return;

  var style = document.createElement("style");
  style.textContent = ".matchup-expand-row{display:flex;justify-content:center;margin-top:9px;padding-top:9px;border-top:1px solid rgba(133,171,203,.12)}.matchup-expand-btn{display:flex;align-items:center;gap:5px;min-height:32px;padding:4px 12px;border:1px solid rgba(133,171,203,.2);border-radius:999px;background:rgba(255,255,255,.025);color:#9db1c2;font-size:.63rem;font-weight:850;cursor:pointer}.matchup-expand-btn .chevron{font-size:.9rem;line-height:1;transition:transform .18s ease}.matchup-expand-btn[aria-expanded=true]{color:var(--lime);border-color:rgba(201,255,54,.28);background:rgba(201,255,54,.06)}.matchup-expand-btn[aria-expanded=true] .chevron{transform:rotate(180deg)}.matchup-rosters{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(133,171,203,.12)}.matchup-rosters[hidden]{display:none!important}.matchup-roster-team{min-width:0;padding:7px 6px;border:1px solid rgba(133,171,203,.15);border-radius:11px;background:rgba(2,13,25,.45)}.matchup-roster-title{text-align:center;font-size:.61rem;font-weight:900;line-height:1.15;margin-bottom:5px;color:#eaf4fb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.matchup-starter-row{display:grid;grid-template-columns:25px minmax(0,1fr) 31px;align-items:center;gap:3px;min-height:27px;border-top:1px solid rgba(133,171,203,.09);font-size:.57rem}.matchup-starter-row:first-of-type{border-top:0}.matchup-starter-slot{color:var(--lime);font-size:.49rem;font-weight:900;white-space:nowrap}.matchup-starter-name{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.matchup-starter-score{text-align:right;font-size:.55rem;font-weight:900;color:#9be7ff}.matchup-roster-total{display:flex;justify-content:space-between;align-items:center;margin-top:5px;padding-top:6px;border-top:1px solid rgba(201,255,54,.22);color:var(--lime);font-size:.61rem;font-weight:950}@media(max-width:360px){.matchup-rosters{gap:4px}.matchup-roster-team{padding:6px 4px}.matchup-starter-row{grid-template-columns:22px minmax(0,1fr) 29px;gap:2px;font-size:.53rem}.matchup-roster-title{font-size:.57rem}}";
  document.head.appendChild(style);

  function normalizeName(name) {
    var map = {"#Numbers":"Burden Of Victory IIIx","Nabers Think I'm Sellin Dope":"The Bowers Rangers"};
    return map[name] || name || "Team";
  }

  function initials(name) {
    return normalizeName(name).split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w.charAt(0).toUpperCase();}).join("");
  }

  function starterOrder(slot) {
    var order = {"QB":0,"RB":1,"WR":2,"TE":3,"FLEX":4,"D/ST":5,"K":6};
    return Object.prototype.hasOwnProperty.call(order, slot) ? order[slot] : 99;
  }

  function startersFor(team) {
    return (team && Array.isArray(team.roster) ? team.roster : [])
      .map(function(player,index){return {player:player,index:index};})
      .filter(function(item){return item.player.slot !== "Bench" && item.player.slot !== "IR";})
      .sort(function(a,b){var diff=starterOrder(a.player.slot)-starterOrder(b.player.slot);return diff || a.index-b.index;})
      .map(function(item){return item.player;});
  }

  function makeTeamSide(team) {
    var side=document.createElement("div"); side.className="matchup-team-side";
    var avatar=document.createElement("div"); avatar.className="team-avatar"; avatar.textContent=initials(team.teamName||team.name);
    var name=document.createElement("div"); name.className="matchup-team-name"; name.textContent=normalizeName(team.teamName||team.name);
    var score=document.createElement("div"); score.className="matchup-big-score"; score.textContent=Number(team.score||0).toFixed(2);
    var projection=document.createElement("div"); projection.className="matchup-projection"; projection.textContent="Proj. "+Number(team.projection||0).toFixed(2);
    side.appendChild(avatar); side.appendChild(name); side.appendChild(score); side.appendChild(projection); return side;
  }

  function makeProjectionBar(home,away) {
    var hp=Math.max(0,Number(home.projection||0)), ap=Math.max(0,Number(away.projection||0)), total=hp+ap;
    var homePct=total>0?Math.round((hp/total)*100):50, awayPct=100-homePct, homeFavored=hp>=ap;
    var wrap=document.createElement("div"); wrap.className="edge-wrap";
    var labels=document.createElement("div"); labels.className="edge-labels"; labels.innerHTML="<span>"+homePct+"%</span><small>Projection Edge</small><span>"+awayPct+"%</span>";
    var bar=document.createElement("div"); bar.className="edge-bar"; bar.style.position="relative"; bar.style.background="#2a4053";
    var marker=document.createElement("span"); marker.style.position="absolute"; marker.style.top="0"; marker.style.bottom="0"; marker.style.width=(homeFavored?homePct:awayPct)+"%"; marker.style.background="linear-gradient(90deg,#a9ea2d,var(--lime))"; marker.style.boxShadow="0 0 10px rgba(201,255,54,.35)"; marker.style.left=homeFavored?"0":"auto"; marker.style.right=homeFavored?"auto":"0"; marker.style.borderRadius="999px";
    var midpoint=document.createElement("i"); midpoint.setAttribute("aria-hidden","true"); midpoint.style.position="absolute"; midpoint.style.left="50%"; midpoint.style.top="-2px"; midpoint.style.bottom="-2px"; midpoint.style.width="1px"; midpoint.style.background="rgba(255,255,255,.42)"; midpoint.style.zIndex="2";
    bar.appendChild(marker); bar.appendChild(midpoint); wrap.appendChild(labels); wrap.appendChild(bar); return wrap;
  }

  function makeRosterPanel(side,teamData) {
    var panel=document.createElement("div"); panel.className="matchup-roster-team";
    var heading=document.createElement("div"); heading.className="matchup-roster-title"; heading.textContent=normalizeName(side.teamName||side.name); panel.appendChild(heading);
    var starters=startersFor(teamData);
    if (!starters.length) {
      var empty=document.createElement("div"); empty.className="matchup-projection"; empty.style.textAlign="center"; empty.textContent="Lineup unavailable"; panel.appendChild(empty);
    } else {
      starters.forEach(function(player){
        var row=document.createElement("div"); row.className="matchup-starter-row";
        var slot=document.createElement("span"); slot.className="matchup-starter-slot"; slot.textContent=player.slot||player.position||"—";
        var name=document.createElement("span"); name.className="matchup-starter-name"; name.textContent=player.name||"Unknown Player";
        var score=document.createElement("span"); score.className="matchup-starter-score"; score.textContent=Number(player.actual||0).toFixed(2);
        row.appendChild(slot); row.appendChild(name); row.appendChild(score); panel.appendChild(row);
      });
    }
    var total=document.createElement("div"); total.className="matchup-roster-total"; total.innerHTML="<span>Total</span><span>"+Number(side.score||0).toFixed(2)+"</span>"; panel.appendChild(total);
    return panel;
  }

  function makeCard(matchup,teamMap,key) {
    var home=matchup.home||{}, away=matchup.away||{};
    var card=document.createElement("div"); card.className="live-matchup-card"; card.dataset.matchupKey=key;
    var top=document.createElement("div"); top.className="matchup-status-row";
    var live=document.createElement("span"); live.className="live-badge"; live.textContent="LIVE";
    var note=document.createElement("span"); note.className="matchup-details-link"; note.textContent="Official live score"; top.appendChild(live); top.appendChild(note);
    var teams=document.createElement("div"); teams.className="matchup-faceoff"; teams.appendChild(makeTeamSide(home));
    var versus=document.createElement("div"); versus.className="matchup-versus"; versus.textContent="VS"; teams.appendChild(versus); teams.appendChild(makeTeamSide(away));
    card.appendChild(top); card.appendChild(teams); card.appendChild(makeProjectionBar(home,away));

    var expandRow=document.createElement("div"); expandRow.className="matchup-expand-row";
    var button=document.createElement("button"); button.type="button"; button.className="matchup-expand-btn";
    var isOpen=openMatchupKey===key; button.setAttribute("aria-expanded",isOpen?"true":"false"); button.innerHTML='<span>More</span><span class="chevron">⌄</span>'; expandRow.appendChild(button); card.appendChild(expandRow);

    var details=document.createElement("div"); details.className="matchup-rosters"; details.hidden=!isOpen;
    details.appendChild(makeRosterPanel(home,teamMap[String(home.teamId)])); details.appendChild(makeRosterPanel(away,teamMap[String(away.teamId)])); card.appendChild(details);

    button.addEventListener("click",function(){
      var opening=button.getAttribute("aria-expanded")!=="true";
      container.querySelectorAll(".matchup-expand-btn").forEach(function(other){other.setAttribute("aria-expanded","false");});
      container.querySelectorAll(".matchup-rosters").forEach(function(panel){panel.hidden=true;});
      if(opening){button.setAttribute("aria-expanded","true");details.hidden=false;openMatchupKey=key;}else{openMatchupKey=null;}
    });
    return card;
  }

  async function loadLive() {
    var response=await fetch("data/live.json?ts="+Date.now(),{cache:"no-store"});
    if(!response.ok) throw new Error("live data unavailable"); return response.json();
  }

  async function loadLiveProjections() {
    try {
      var response=await fetch("data/live-projections.json?ts="+Date.now(),{cache:"no-store"});
      if(!response.ok) return null;
      return await response.json();
    } catch(error) {
      return null;
    }
  }

  function applyLiveProjections(data,projectionData) {
    if(!projectionData || !projectionData.projections) return data;
    var projectionWeek=Number(projectionData.week||projectionData.scoringPeriod||0);
    var liveWeek=Number(data.week||data.scoringPeriod||0);
    if(projectionWeek && liveWeek && projectionWeek!==liveWeek) return data;
    var map=projectionData.projections;
    (data.matchups||[]).forEach(function(matchup){
      [matchup.home,matchup.away].forEach(function(side){
        if(!side) return;
        var key=String(side.teamId);
        var value=Number(map[key]);
        if(Number.isFinite(value) && value>0) side.projection=value;
      });
    });
    return data;
  }

  function showUnavailableWeek(week) {container.innerHTML='<div class="empty-week-card"><strong>Week '+week+'</strong><span>Live matchup cards will appear here when that week becomes available.</span></div>';}

  async function render() {
    try {
      var results=await Promise.all([loadLive(),loadLiveProjections()]);
      var data=applyLiveProjections(results[0],results[1]);
      var liveWeek=Number(data.week||data.scoringPeriod||1);
      if(select&&!select.dataset.userChanged) select.value=String(liveWeek);
      var requestedWeek=select?Number(select.value||liveWeek):liveWeek;
      if(title) title.textContent="Week "+requestedWeek;
      if(requestedWeek!==liveWeek){openMatchupKey=null;showUnavailableWeek(requestedWeek);return;}
      var teamMap={}; (data.teams||[]).forEach(function(team){teamMap[String(team.id)]=team;});
      container.innerHTML="";
      (data.matchups||[]).forEach(function(matchup,index){
        var key=String((matchup.home||{}).teamId||"h")+"-"+String((matchup.away||{}).teamId||"a")+"-"+index;
        container.appendChild(makeCard(matchup,teamMap,key));
      });
      if(!(data.matchups||[]).length) container.innerHTML='<div class="app-loading">No live matchups are available yet.</div>';
    } catch(error) {container.innerHTML='<div class="app-loading">Live matchup data is temporarily unavailable.</div>';}
  }

  if(select){select.addEventListener("change",function(){select.dataset.userChanged="true";openMatchupKey=null;render();});}
  render(); setInterval(render,10000);
})();