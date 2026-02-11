const menuToggle = document.getElementById("menuToggle");
const SIDEBAR_STATE_KEY = "sidebarState";
const LIST_PAGE_SIZE = 8;
const VALID_SCOPE = new Set(["upcoming", "past", "all"]);

const scopeButtons = Array.from(document.querySelectorAll(".scope-btn"));
const typeButtons = Array.from(document.querySelectorAll(".type-chip"));
const eventList = document.getElementById("eventList");
const eventStatus = document.getElementById("eventStatus");
const loadMoreBtn = document.getElementById("loadMoreBtn");

const eventState = {
  scope: "upcoming",
  selectedTypes: new Set(),
  items: [],
  nextCursor: null,
  isLoading: false,
  isLoadingMore: false,
  error: ""
};

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

function formatEventType(type) {
  const normalized = String(type || "").trim();
  if (!normalized) return "Other";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDueDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getDueContextLabel(isoDate) {
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    return "";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  const dayDiff = Math.round(diffMs / 86400000);

  if (dayDiff === 0) return "Due today";
  if (dayDiff === 1) return "Due tomorrow";
  if (dayDiff > 1) return `Due in ${dayDiff} days`;
  if (dayDiff === -1) return "Due yesterday";
  return `${Math.abs(dayDiff)} days ago`;
}

function buildEventsQuery(cursor) {
  const params = new URLSearchParams();
  params.set("scope", eventState.scope);
  params.set("limit", String(LIST_PAGE_SIZE));

  for (const type of eventState.selectedTypes) {
    params.append("type", type);
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  return params.toString();
}

function createStateMessageItem(text, variant = "") {
  const item = document.createElement("li");
  item.className = "event-state";
  if (variant) {
    item.classList.add(variant);
  }
  item.textContent = text;
  return item;
}

function createSkeletonItem() {
  const item = document.createElement("li");
  item.className = "event-skeleton-row";
  return item;
}

function createEventCard(event) {
  const item = document.createElement("li");
  item.className = "event-card";

  const head = document.createElement("div");
  head.className = "event-card-head";

  const title = document.createElement("h3");
  title.className = "event-title";
  title.textContent = event.title;

  const type = document.createElement("span");
  type.className = "event-type-badge";
  type.textContent = formatEventType(event.type);

  head.append(title, type);

  const dueDate = document.createElement("p");
  dueDate.className = "event-date";
  dueDate.textContent = formatDueDate(event.dueDate);

  const context = document.createElement("p");
  context.className = "event-meta";
  context.textContent = getDueContextLabel(event.dueDate);

  item.append(head, dueDate, context);
  return item;
}

function renderFilterControls() {
  scopeButtons.forEach((button) => {
    const isActive = button.dataset.scope === eventState.scope;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  typeButtons.forEach((button) => {
    const type = String(button.dataset.type || "").toLowerCase();
    const isActive = eventState.selectedTypes.has(type);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderStatusText() {
  if (!eventStatus) return;

  if (eventState.isLoading && eventState.items.length === 0) {
    eventStatus.textContent = "Loading events...";
    return;
  }

  if (eventState.error && eventState.items.length === 0) {
    eventStatus.textContent = eventState.error;
    return;
  }

  if (eventState.items.length === 0) {
    eventStatus.textContent = "No events match the current filters.";
    return;
  }

  const count = eventState.items.length;
  const noun = count === 1 ? "event" : "events";
  const suffix = eventState.nextCursor ? " More available." : "";
  eventStatus.textContent = `Showing ${count} ${noun}.${suffix}`;
}

function renderEventList() {
  if (!eventList) return;

  eventList.innerHTML = "";

  if (eventState.isLoading && eventState.items.length === 0) {
    for (let index = 0; index < 4; index += 1) {
      eventList.appendChild(createSkeletonItem());
    }
    return;
  }

  if (eventState.error && eventState.items.length === 0) {
    const errorItem = createStateMessageItem(eventState.error, "error");
    eventList.appendChild(errorItem);
    return;
  }

  if (eventState.items.length === 0) {
    eventList.appendChild(createStateMessageItem("No events were found for this view."));
    return;
  }

  eventState.items.forEach((event) => {
    eventList.appendChild(createEventCard(event));
  });

  if (eventState.isLoadingMore) {
    for (let index = 0; index < 2; index += 1) {
      eventList.appendChild(createSkeletonItem());
    }
  }
}

function renderLoadMore() {
  if (!loadMoreBtn) return;

  if (eventState.isLoading && eventState.items.length === 0) {
    loadMoreBtn.hidden = true;
    return;
  }

  const hasMore = Boolean(eventState.nextCursor);
  loadMoreBtn.hidden = !hasMore && !eventState.isLoadingMore;
  loadMoreBtn.disabled = eventState.isLoadingMore || !hasMore;
  loadMoreBtn.textContent = eventState.isLoadingMore ? "Loading..." : "Load more";
}

function renderEventView() {
  renderFilterControls();
  renderStatusText();
  renderEventList();
  renderLoadMore();
}

async function fetchEvents(options = {}) {
  const append = options.append === true;

  if (append) {
    if (!eventState.nextCursor || eventState.isLoadingMore || eventState.isLoading) {
      return;
    }
    eventState.isLoadingMore = true;
  } else {
    eventState.isLoading = true;
    eventState.error = "";
    eventState.items = [];
    eventState.nextCursor = null;
  }

  renderEventView();

  try {
    const query = buildEventsQuery(append ? eventState.nextCursor : null);
    const response = await fetch(`/api/events?${query}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Unable to load events.");
    }

    const incomingItems = Array.isArray(payload.items) ? payload.items : [];
    eventState.items = append ? eventState.items.concat(incomingItems) : incomingItems;
    eventState.nextCursor = payload.nextCursor || null;
    eventState.error = "";
  } catch (error) {
    eventState.error = error instanceof Error ? error.message : "Unable to load events.";
  } finally {
    eventState.isLoading = false;
    eventState.isLoadingMore = false;
    renderEventView();
  }
}

function setScope(scope) {
  if (!VALID_SCOPE.has(scope) || scope === eventState.scope) {
    return;
  }
  eventState.scope = scope;
  fetchEvents();
}

function toggleTypeFilter(type) {
  const normalizedType = String(type || "").toLowerCase();
  if (!normalizedType) return;

  if (eventState.selectedTypes.has(normalizedType)) {
    eventState.selectedTypes.delete(normalizedType);
  } else {
    eventState.selectedTypes.add(normalizedType);
  }

  fetchEvents();
}

function initializeEventView() {
  if (!eventList || !eventStatus || !loadMoreBtn) {
    return;
  }

  scopeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setScope(String(button.dataset.scope || ""));
    });
  });

  typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toggleTypeFilter(button.dataset.type);
    });
  });

  loadMoreBtn.addEventListener("click", () => {
    fetchEvents({ append: true });
  });

  renderEventView();
  fetchEvents();
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isCollapsed = !document.body.classList.contains("sidebar-collapsed");
    setCollapsedState(isCollapsed);
    localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? "collapsed" : "expanded");
  });
}

initializeSidebarState();
initializeEventView();
