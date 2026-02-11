import { formatDueDate, formatEventType, getDueContextLabel } from "../core/event-format.js";

export function createEventsFeature(ctx) {
  const { constants, dom, state } = ctx;

  function buildEventsQuery(cursor) {
    const params = new URLSearchParams();
    params.set("scope", state.event.scope);
    params.set("limit", String(constants.LIST_PAGE_SIZE));

    for (const type of state.event.selectedTypes) {
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
    dom.scopeButtons.forEach((button) => {
      const isActive = button.dataset.scope === state.event.scope;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    dom.typeButtons.forEach((button) => {
      const type = String(button.dataset.type || "").toLowerCase();
      const isActive = state.event.selectedTypes.has(type);
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function renderStatusText() {
    if (!dom.eventStatus) return;

    if (state.event.isLoading && state.event.items.length === 0) {
      dom.eventStatus.textContent = "Loading events...";
      return;
    }

    if (state.event.error && state.event.items.length === 0) {
      dom.eventStatus.textContent = state.event.error;
      return;
    }

    if (state.event.items.length === 0) {
      dom.eventStatus.textContent = "No events match the current filters.";
      return;
    }

    const count = state.event.items.length;
    const noun = count === 1 ? "event" : "events";
    const suffix = state.event.nextCursor ? " More available." : "";
    dom.eventStatus.textContent = `Showing ${count} ${noun}.${suffix}`;
  }

  function renderEventList() {
    if (!dom.eventList) return;

    dom.eventList.innerHTML = "";

    if (state.event.isLoading && state.event.items.length === 0) {
      for (let index = 0; index < 4; index += 1) {
        dom.eventList.appendChild(createSkeletonItem());
      }
      return;
    }

    if (state.event.error && state.event.items.length === 0) {
      const errorItem = createStateMessageItem(state.event.error, "error");
      dom.eventList.appendChild(errorItem);
      return;
    }

    if (state.event.items.length === 0) {
      dom.eventList.appendChild(createStateMessageItem("No events were found for this view."));
      return;
    }

    state.event.items.forEach((event) => {
      dom.eventList.appendChild(createEventCard(event));
    });

    if (state.event.isLoadingMore) {
      for (let index = 0; index < 2; index += 1) {
        dom.eventList.appendChild(createSkeletonItem());
      }
    }
  }

  function renderLoadMore() {
    if (!dom.loadMoreBtn) return;

    if (state.event.isLoading && state.event.items.length === 0) {
      dom.loadMoreBtn.hidden = true;
      return;
    }

    const hasMore = Boolean(state.event.nextCursor);
    dom.loadMoreBtn.hidden = !hasMore && !state.event.isLoadingMore;
    dom.loadMoreBtn.disabled = state.event.isLoadingMore || !hasMore;
    dom.loadMoreBtn.textContent = state.event.isLoadingMore ? "Loading..." : "Load more";
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
      if (!state.event.nextCursor || state.event.isLoadingMore || state.event.isLoading) {
        return;
      }
      state.event.isLoadingMore = true;
    } else {
      state.event.isLoading = true;
      state.event.error = "";
      state.event.items = [];
      state.event.nextCursor = null;
    }

    renderEventView();

    try {
      const query = buildEventsQuery(append ? state.event.nextCursor : null);
      const payload = await ctx.requestJson(`/api/events?${query}`, {
        method: "GET",
        withJson: false,
        withAuth: false
      });
      const incomingItems = Array.isArray(payload.items) ? payload.items : [];
      state.event.items = append ? state.event.items.concat(incomingItems) : incomingItems;
      state.event.nextCursor = payload.nextCursor || null;
      state.event.error = "";
    } catch (error) {
      state.event.error = error instanceof Error ? error.message : "Unable to load events.";
    } finally {
      state.event.isLoading = false;
      state.event.isLoadingMore = false;
      renderEventView();
    }
  }

  function setScope(scope) {
    if (!constants.VALID_SCOPE.has(scope) || scope === state.event.scope) {
      return;
    }

    state.event.scope = scope;
    fetchEvents();
  }

  function toggleTypeFilter(type) {
    const normalizedType = String(type || "").toLowerCase();
    if (!normalizedType) return;

    if (state.event.selectedTypes.has(normalizedType)) {
      state.event.selectedTypes.delete(normalizedType);
    } else {
      state.event.selectedTypes.add(normalizedType);
    }

    fetchEvents();
  }

  function initializeEventView() {
    if (!dom.eventList || !dom.eventStatus || !dom.loadMoreBtn) {
      return;
    }

    dom.scopeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setScope(String(button.dataset.scope || ""));
      });
    });

    dom.typeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        toggleTypeFilter(button.dataset.type);
      });
    });

    dom.loadMoreBtn.addEventListener("click", () => {
      fetchEvents({ append: true });
    });

    renderEventView();
    fetchEvents();
  }

  return {
    actions: {
      fetchEvents
    },
    initializeEventView
  };
}
