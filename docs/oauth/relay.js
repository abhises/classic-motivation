// Forwards an OAuth callback to the studio running on this computer.
// The studio appends its local port to the state ("<random>.<port>").
(function () {
  var platform = location.pathname.split("/").pop().replace(/\.html$/, "");
  var state = new URLSearchParams(location.search).get("state") || "";
  var port = (state.match(/\.(\d{2,5})$/) || [])[1] || "3000";
  location.replace("http://localhost:" + port + "/api/auth/" + platform + "/callback" + location.search);
})();
