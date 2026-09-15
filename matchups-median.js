(function () {
  var valueEl = document.getElementById("league-median-score");
  var select = document.getElementById("week-select");
  if (!valueEl) return;

  function median(values) {
    var nums = values.filter(function (value) { return Number.isFinite(value) && value > 0; }).sort(function (a, b) { return a - b; });
    if (!nums.length) return 0;
    var mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }

  async function loadProjectedMedian() {
    var responses = await Promise.all([
      fetch("data/live.json?ts=" + Date.now(), { cache: "no-store" }),
      fetch("data/live-projections.json?ts=" + Date.now(), { cache: "no-store" })
    ]);
    if (!responses[0].ok || !responses[1].ok) throw new Error("Unable to load current projections");
    var live = await responses[0].json();
    var projections = await responses[1].json();
    var currentWeek = Number(live.week || live.scoringPeriod || 0);
    var projectionWeek = Number(projections.week || projections.scoringPeriod || 0);
    var selectedWeek = select ? Number(select.value || currentWeek) : currentWeek;
    if (!currentWeek || selectedWeek !== currentWeek || projectionWeek !== currentWeek) return 0;
    var direct = Number(projections.projectedMedian);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return median(Object.keys(projections.projections || {}).map(function (teamId) { return Number(projections.projections[teamId]); }));
  }

  async function updateMedian() {
    try { var projectedMedian = await loadProjectedMedian(); valueEl.textContent = projectedMedian > 0 ? projectedMedian.toFixed(2) : "—"; }
    catch (error) { valueEl.textContent = "—"; }
  }

  if (select) select.addEventListener("change", updateMedian);
  updateMedian();
  setInterval(updateMedian, 10000);
})();
