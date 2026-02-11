const menuToggle = document.getElementById("menuToggle");
const SIDEBAR_STATE_KEY = "sidebarState";

function setCollapsedState(isCollapsed) {
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", String(!isCollapsed));
  }
}

function initializeSidebarState() {
  const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
  const isCollapsed = savedState === "collapsed";
  setCollapsedState(isCollapsed);
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isCollapsed = !document.body.classList.contains("sidebar-collapsed");
    setCollapsedState(isCollapsed);
    localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? "collapsed" : "expanded");
  });
}

initializeSidebarState();
