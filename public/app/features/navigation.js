export function createNavigationFeature(ctx) {
  const { constants, dom, state } = ctx;

  function setCollapsedState(isCollapsed) {
    document.body.classList.toggle("sidebar-collapsed", isCollapsed);
    if (dom.menuToggle) {
      dom.menuToggle.setAttribute("aria-expanded", String(!isCollapsed));
    }
  }

  function initializeSidebarState() {
    const savedState = localStorage.getItem(constants.SIDEBAR_STATE_KEY);
    const isCollapsed = savedState === "collapsed";
    setCollapsedState(isCollapsed);
  }

  function renderSidebarSelection() {
    if (dom.eventsNavItem) {
      const isEventsActive = state.view.active === constants.VIEW_EVENTS;
      dom.eventsNavItem.classList.toggle("is-active", isEventsActive);
      dom.eventsNavItem.setAttribute("aria-current", isEventsActive ? "page" : "false");
    }

    if (dom.managementNavItem) {
      const isManagementActive = state.view.active === constants.VIEW_MANAGEMENT;
      dom.managementNavItem.classList.toggle("is-active", isManagementActive);
      dom.managementNavItem.setAttribute("aria-current", isManagementActive ? "page" : "false");
    }
  }

  function renderActiveView() {
    if (dom.eventView) {
      dom.eventView.hidden = state.view.active !== constants.VIEW_EVENTS;
    }
    if (dom.managementView) {
      dom.managementView.hidden = state.view.active !== constants.VIEW_MANAGEMENT;
    }
    renderSidebarSelection();
  }

  function renderManagementNav() {
    if (!dom.managementNavItem) return;

    const isAdmin = Boolean(state.auth.username) && state.auth.role === "admin";
    dom.managementNavItem.hidden = !isAdmin;

    if (!isAdmin && state.view.active === constants.VIEW_MANAGEMENT) {
      state.view.active = constants.VIEW_EVENTS;
      renderActiveView();
      return;
    }

    renderSidebarSelection();
  }

  function setActiveView(nextView) {
    if (nextView !== constants.VIEW_EVENTS && nextView !== constants.VIEW_MANAGEMENT) {
      return;
    }

    if (nextView === constants.VIEW_MANAGEMENT && (!state.auth.username || state.auth.role !== "admin")) {
      return;
    }

    if (state.view.active === nextView) {
      return;
    }

    state.view.active = nextView;
    renderActiveView();

    if (nextView === constants.VIEW_MANAGEMENT && !state.management.hasLoaded) {
      ctx.actions.fetchManagementEvents?.();
    }
  }

  function initializeNavigationUi() {
    if (dom.eventsNavItem) {
      dom.eventsNavItem.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveView(constants.VIEW_EVENTS);
      });
    }

    if (dom.managementNavItem) {
      dom.managementNavItem.addEventListener("click", () => {
        setActiveView(constants.VIEW_MANAGEMENT);
      });
    }
  }

  function initializeSidebarToggle() {
    if (!dom.menuToggle) {
      return;
    }

    dom.menuToggle.addEventListener("click", () => {
      const isCollapsed = !document.body.classList.contains("sidebar-collapsed");
      setCollapsedState(isCollapsed);
      localStorage.setItem(constants.SIDEBAR_STATE_KEY, isCollapsed ? "collapsed" : "expanded");
    });
  }

  return {
    actions: {
      renderActiveView,
      renderManagementNav,
      setActiveView
    },
    initializeNavigationUi,
    initializeSidebarState,
    initializeSidebarToggle
  };
}
