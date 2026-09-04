// =========================================
// app.js
// Shared behavior for every page:
// 1. Open/close the mobile nav menu
// 2. Highlight the current page's nav link
// =========================================

document.addEventListener("DOMContentLoaded", function () {
  var toggleButton = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");

  // 1. Mobile menu open/close
  if (toggleButton && nav) {
    toggleButton.addEventListener("click", function () {
      nav.classList.toggle("open");
    });

    // Close the menu automatically when a link is tapped
    var navLinks = nav.querySelectorAll("a");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
  }

  // 2. Highlight the active page in the nav menu
  // Every page's <body> has a data-page="..." attribute (e.g. "home").
  // Every nav link has a matching data-page="..." attribute.
  var currentPage = document.body.getAttribute("data-page");
  var allLinks = document.querySelectorAll(".main-nav a");

  allLinks.forEach(function (link) {
    if (link.getAttribute("data-page") === currentPage) {
      link.classList.add("active");
    }
  });

  // 3. Draft countdown (only runs on pages that have the #draft-countdown box)
  var countdownEl = document.getElementById("draft-countdown");
  if (countdownEl) {
    var draftDate = new Date("September 7, 2026 00:00:00").getTime();

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
});
