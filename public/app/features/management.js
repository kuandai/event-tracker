import { formatDueDate, formatEventType } from "../core/event-format.js";

export function createManagementFeature(ctx) {
  const { dom, state } = ctx;

  function setManagementFeedback(text, tone = "") {
    state.management.feedbackText = text;
    state.management.feedbackTone = tone;
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

  function renderManagementStatus() {
    if (!dom.managementStatus) return;

    dom.managementStatus.classList.remove("error", "success");

    if (state.management.error) {
      dom.managementStatus.textContent = state.management.error;
      dom.managementStatus.classList.add("error");
      return;
    }

    if (state.management.isLoading && state.management.items.length === 0) {
      dom.managementStatus.textContent = "Loading managed events...";
      return;
    }

    if (state.management.feedbackText) {
      dom.managementStatus.textContent = state.management.feedbackText;
      if (state.management.feedbackTone) {
        dom.managementStatus.classList.add(state.management.feedbackTone);
      }
      return;
    }

    const count = state.management.items.length;
    const noun = count === 1 ? "event" : "events";
    dom.managementStatus.textContent = `${count} managed ${noun}.`;
  }

  function createManagementEventItem(event) {
    const item = document.createElement("li");
    item.className = "management-item";

    const head = document.createElement("div");
    head.className = "management-item-head";

    const title = document.createElement("h3");
    title.className = "management-item-title";
    title.textContent = event.title;

    const typeBadge = document.createElement("span");
    typeBadge.className = "event-type-badge";
    typeBadge.textContent = formatEventType(event.type);

    head.append(title, typeBadge);

    const dueDate = document.createElement("p");
    dueDate.className = "management-item-meta";
    dueDate.textContent = `Due ${formatDueDate(event.dueDate)}`;

    const actions = document.createElement("div");
    actions.className = "management-item-actions";

    const deleteButton = document.createElement("button");
    deleteButton.className = "management-delete-btn";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.eventId = String(event.id);
    deleteButton.textContent = "Delete";
    deleteButton.disabled = state.management.isSubmitting;

    actions.append(deleteButton);
    item.append(head, dueDate, actions);
    return item;
  }

  function renderManagementList() {
    if (!dom.managementList) return;

    dom.managementList.innerHTML = "";

    if (state.management.isLoading && state.management.items.length === 0) {
      dom.managementList.appendChild(createStateMessageItem("Loading management list..."));
      return;
    }

    if (state.management.error && state.management.items.length === 0) {
      dom.managementList.appendChild(createStateMessageItem(state.management.error, "error"));
      return;
    }

    if (state.management.items.length === 0) {
      dom.managementList.appendChild(createStateMessageItem("No events yet. Add your first event above."));
      return;
    }

    state.management.items.forEach((event) => {
      dom.managementList.appendChild(createManagementEventItem(event));
    });
  }

  function renderManagementView() {
    renderManagementStatus();
    renderManagementList();

    if (dom.managementSubmit) {
      dom.managementSubmit.disabled = state.management.isSubmitting;
      dom.managementSubmit.textContent = state.management.isSubmitting ? "Saving..." : "Add Event";
    }

    if (dom.managementTitleInput) dom.managementTitleInput.disabled = state.management.isSubmitting;
    if (dom.managementTypeInput) dom.managementTypeInput.disabled = state.management.isSubmitting;
    if (dom.managementDueDateInput) dom.managementDueDateInput.disabled = state.management.isSubmitting;
  }

  async function fetchManagementEvents() {
    if (!dom.managementList || !dom.managementStatus) {
      return;
    }

    state.management.isLoading = true;
    state.management.error = "";
    renderManagementView();

    try {
      const payload = await ctx.requestJson("/api/events?scope=all&limit=100", {
        method: "GET",
        withJson: false,
        withAuth: false
      });
      state.management.items = Array.isArray(payload.items) ? payload.items : [];
      state.management.hasLoaded = true;
    } catch (error) {
      state.management.error = error instanceof Error ? error.message : "Failed to load managed events.";
    } finally {
      state.management.isLoading = false;
      renderManagementView();
    }
  }

  async function handleManagementSubmit(event) {
    event.preventDefault();

    if (!state.auth.token || state.auth.role !== "admin") {
      state.management.error = "Admin sign-in required.";
      renderManagementView();
      return;
    }

    const title = String(dom.managementTitleInput?.value || "").trim();
    const type = String(dom.managementTypeInput?.value || "").trim().toLowerCase();
    const dueDate = String(dom.managementDueDateInput?.value || "").trim();

    if (!title || !type || !dueDate) {
      state.management.error = "Title, type, and due date are required.";
      renderManagementView();
      return;
    }

    state.management.error = "";
    state.management.isSubmitting = true;
    setManagementFeedback("");
    renderManagementView();

    try {
      await ctx.requestJson("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({ title, type, dueDate })
      });

      if (dom.managementTitleInput) {
        dom.managementTitleInput.value = "";
        dom.managementTitleInput.focus();
      }

      setManagementFeedback("Event created.", "success");
      await fetchManagementEvents();
      ctx.actions.fetchEvents?.();
    } catch (error) {
      state.management.error = error instanceof Error ? error.message : "Failed to create event.";
    } finally {
      state.management.isSubmitting = false;
      renderManagementView();
    }
  }

  async function handleManagementDelete(eventId) {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId || state.management.isSubmitting) {
      return;
    }

    if (!state.auth.token || state.auth.role !== "admin") {
      state.management.error = "Admin sign-in required.";
      renderManagementView();
      return;
    }

    state.management.error = "";
    state.management.isSubmitting = true;
    setManagementFeedback("");
    renderManagementView();

    try {
      await ctx.requestJson(`/api/admin/events/${encodeURIComponent(normalizedId)}`, {
        method: "DELETE",
        body: JSON.stringify({})
      });

      setManagementFeedback("Event deleted.", "success");
      await fetchManagementEvents();
      ctx.actions.fetchEvents?.();
    } catch (error) {
      state.management.error = error instanceof Error ? error.message : "Failed to delete event.";
    } finally {
      state.management.isSubmitting = false;
      renderManagementView();
    }
  }

  function initializeManagementView() {
    if (
      !dom.managementView ||
      !dom.managementForm ||
      !dom.managementTitleInput ||
      !dom.managementTypeInput ||
      !dom.managementDueDateInput ||
      !dom.managementList ||
      !dom.managementStatus
    ) {
      return;
    }

    dom.managementForm.addEventListener("submit", handleManagementSubmit);
    dom.managementList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const deleteButton = target.closest("button[data-action='delete']");
      if (!deleteButton) {
        return;
      }

      handleManagementDelete(deleteButton.dataset.eventId);
    });

    renderManagementView();
  }

  return {
    actions: {
      fetchManagementEvents
    },
    initializeManagementView
  };
}
