(function () {
  var valueEl = document.getElementById("league-median-score");
  if (!valueEl) return;

  function median(values) {
    var nums = values.filter(function (value) {
      return Number.isFinite(value) && value > 0;
    }).sort(function (a, b) {
      return a - b;
    });

    if (!nums.length) return 0;
    var mid = Math.floor(nums.length / 2);
    return nums.length % 2
      ? nums[mid]
      : (nums[mid - 1] + nums[mid]) / 2;
  }

  async function loadProjectedMedian() {
    var response = await fetch("data/live-projections.json?ts=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load live projections");
    var data = await response.json();
    var values = Object.keys(data.projections || {}).map(function (teamId) {
      return Number(data.projections[teamId]);
    });
    return median(values);
  }

  async function updateMedian() {
    try {
      var projectedMedian = await loadProjectedMedian();
      valueEl.textContent = projectedMedian > 0 ? projectedMedian.toFixed(2) : "—";
    } catch (error) {
      valueEl.textContent = "—";
    }
  }

  updateMedian();
  setInterval(updateMedian, 10000);
})();
