(function () {
  var valueEl = document.getElementById("league-median-score");
  if (!valueEl) return;

  function median(values) {
    var nums = values.filter(function (value) {
      return Number.isFinite(value);
    }).sort(function (a, b) {
      return a - b;
    });

    if (!nums.length) return 0;
    var mid = Math.floor(nums.length / 2);
    return nums.length % 2
      ? nums[mid]
      : (nums[mid - 1] + nums[mid]) / 2;
  }

  async function updateMedian() {
    try {
      var response = await fetch("data/live.json?ts=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load live scores");
      var data = await response.json();
      var scores = [];

      (data.matchups || []).forEach(function (matchup) {
        if (matchup.home) scores.push(Number(matchup.home.score));
        if (matchup.away) scores.push(Number(matchup.away.score));
      });

      valueEl.textContent = median(scores).toFixed(2);
    } catch (error) {
      valueEl.textContent = "—";
    }
  }

  updateMedian();
  setInterval(updateMedian, 10000);
})();