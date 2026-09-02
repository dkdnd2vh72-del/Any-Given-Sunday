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
});
