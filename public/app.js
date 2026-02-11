const menuToggle = document.getElementById("menuToggle");
const SIDEBAR_STATE_KEY = "sidebarState";
const LIST_PAGE_SIZE = 8;
const VALID_SCOPE = new Set(["upcoming", "past", "all"]);
const AUTH_TOKEN_KEY = "authToken";
const AUTH_USERNAME_KEY = "authUsername";
const VALID_AUTH_MODE = new Set(["login", "signup"]);
const THEME_KEY = "themePreference";
const VALID_THEME_MODE = new Set(["light", "dark", "system"]);

const scopeButtons = Array.from(document.querySelectorAll(".scope-btn"));
const typeButtons = Array.from(document.querySelectorAll(".type-chip"));
const eventList = document.getElementById("eventList");
const eventStatus = document.getElementById("eventStatus");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const authTrigger = document.getElementById("authTrigger");
const authTriggerLabel = document.getElementById("authTriggerLabel");
const authOverlay = document.getElementById("authOverlay");
const authPanel = document.getElementById("authPanel");
const authClose = document.getElementById("authClose");
const authForm = document.getElementById("authForm");
const authUsernameInput = document.getElementById("authUsername");
const authPasswordInput = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authMessage = document.getElementById("authMessage");
const authModeSwitch = document.getElementById("authModeSwitch");
const authLogout = document.getElementById("authLogout");
const settingsTrigger = document.getElementById("settingsTrigger");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsPanel = document.getElementById("settingsPanel");
const settingsClose = document.getElementById("settingsClose");
const themeModeInputs = Array.from(document.querySelectorAll("input[name='themeMode']"));

const eventState = {
  scope: "upcoming",
  selectedTypes: new Set(),
  items: [],
  nextCursor: null,
  isLoading: false,
  isLoadingMore: false,
  error: ""
};

const authState = {
  mode: "login",
  token: localStorage.getItem(AUTH_TOKEN_KEY) || "",
  username: localStorage.getItem(AUTH_USERNAME_KEY) || "",
  isOpen: false,
  isSubmitting: false
};

const settingsState = {
  isOpen: false
};

const themeState = {
  preference: localStorage.getItem(THEME_KEY) || "system",
  mediaQuery: null
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

function syncModalLock() {
  const shouldLock = authState.isOpen || settingsState.isOpen;
  document.body.classList.toggle("modal-open", shouldLock);
}

function normalizeThemePreference(value) {
  return VALID_THEME_MODE.has(value) ? value : "system";
}

function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return themeState.mediaQuery?.matches ? "dark" : "light";
}

function applyTheme() {
  const resolved = resolveTheme(themeState.preference);
  document.documentElement.setAttribute("data-theme", resolved);
}

function renderThemeOptions() {
  themeModeInputs.forEach((input) => {
    input.checked = input.value === themeState.preference;
  });
}

function setThemePreference(preference, persist = true) {
  const normalized = normalizeThemePreference(preference);
  themeState.preference = normalized;
  if (persist) {
    localStorage.setItem(THEME_KEY, normalized);
  }
  applyTheme();
  renderThemeOptions();
}

function openSettingsPanel() {
  if (!settingsOverlay) return;
  closeAuthPanel();
  settingsOverlay.hidden = false;
  settingsState.isOpen = true;
  syncModalLock();
  renderThemeOptions();
}

function closeSettingsPanel() {
  if (!settingsOverlay) return;
  settingsOverlay.hidden = true;
  settingsState.isOpen = false;
  syncModalLock();
}

function initializeTheme() {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  themeState.mediaQuery = mediaQuery;

  setThemePreference(themeState.preference, false);

  const onSystemThemeChange = () => {
    if (themeState.preference === "system") {
      applyTheme();
    }
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onSystemThemeChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(onSystemThemeChange);
  }
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.withJson !== false) {
    headers.set("Content-Type", "application/json");
  }
  if (authState.token && options.withAuth !== false) {
    headers.set("Authorization", `Bearer ${authState.token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || "Request failed.";
    throw new Error(message);
  }
  return payload;
}

function setAuthMessage(text, tone = "") {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.classList.remove("error", "success");
  if (tone) {
    authMessage.classList.add(tone);
  }
}

function saveAuthSession(token, username) {
  authState.token = token || "";
  authState.username = username || "";
  if (authState.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, authState.token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  if (authState.username) {
    localStorage.setItem(AUTH_USERNAME_KEY, authState.username);
  } else {
    localStorage.removeItem(AUTH_USERNAME_KEY);
  }
}

function renderAuthTrigger() {
  if (!authTrigger || !authTriggerLabel) return;

  if (authState.username) {
    authTriggerLabel.textContent = authState.username;
    authTrigger.classList.add("is-authenticated");
    authTrigger.setAttribute("aria-label", `Signed in as ${authState.username}`);
  } else {
    authTriggerLabel.textContent = "Sign in";
    authTrigger.classList.remove("is-authenticated");
    authTrigger.setAttribute("aria-label", "Sign in");
  }
}

function renderAuthPanel() {
  if (!authTitle || !authSubtitle || !authSubmit || !authModeSwitch || !authLogout) {
    return;
  }

  const isLoginMode = authState.mode === "login";
  authTitle.textContent = isLoginMode ? "Sign in" : "Create account";
  authSubtitle.textContent = isLoginMode
    ? "Use your account to track completed items."
    : "Create an account to track personal progress.";
  authSubmit.textContent = isLoginMode ? "Sign in" : "Sign up";
  authModeSwitch.textContent = isLoginMode ? "Create account instead" : "Use existing account";
  authModeSwitch.disabled = authState.isSubmitting;
  authLogout.hidden = !authState.username;
  authLogout.disabled = authState.isSubmitting;

  if (authUsernameInput && !authUsernameInput.value && authState.username) {
    authUsernameInput.value = authState.username;
  }
}

function setAuthMode(mode) {
  if (!VALID_AUTH_MODE.has(mode)) {
    return;
  }
  authState.mode = mode;
  if (authPasswordInput) {
    authPasswordInput.value = "";
    authPasswordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
  }
  setAuthMessage("");
  renderAuthPanel();
}

function openAuthPanel(mode) {
  if (!authOverlay) return;
  closeSettingsPanel();

  if (mode) {
    setAuthMode(mode);
  } else {
    renderAuthPanel();
  }

  authOverlay.hidden = false;
  authState.isOpen = true;
  syncModalLock();
  setTimeout(() => {
    authUsernameInput?.focus();
  }, 0);
}

function closeAuthPanel() {
  if (!authOverlay) return;
  authOverlay.hidden = true;
  authState.isOpen = false;
  syncModalLock();
  setAuthMessage("");
}

function setAuthSubmittingState(isSubmitting) {
  authState.isSubmitting = isSubmitting;
  if (authSubmit) authSubmit.disabled = isSubmitting;
  if (authModeSwitch) authModeSwitch.disabled = isSubmitting;
  if (authClose) authClose.disabled = isSubmitting;
  if (authUsernameInput) authUsernameInput.disabled = isSubmitting;
  if (authPasswordInput) authPasswordInput.disabled = isSubmitting;
  if (authLogout) authLogout.disabled = isSubmitting;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!authUsernameInput || !authPasswordInput) {
    return;
  }

  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;
  if (!username || !password) {
    setAuthMessage("Username and password are required.", "error");
    return;
  }

  if (authState.mode === "signup" && password.length < 6) {
    setAuthMessage("Password must be at least 6 characters.", "error");
    return;
  }

  setAuthSubmittingState(true);
  setAuthMessage("");

  try {
    if (authState.mode === "signup") {
      await requestJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setAuthMode("login");
      setAuthMessage("Account created. Sign in with your new credentials.", "success");
      return;
    }

    const payload = await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    saveAuthSession(payload.token, payload.username);
    renderAuthTrigger();
    setAuthMessage("Signed in successfully.", "success");
    closeAuthPanel();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    setAuthMessage(message, "error");
  } finally {
    setAuthSubmittingState(false);
  }
}

async function handleAuthLogout() {
  if (!authState.username || authState.isSubmitting) {
    return;
  }

  setAuthSubmittingState(true);
  setAuthMessage("");
  try {
    await requestJson("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
      withJson: false
    });
  } catch (error) {
    // session may already be expired; still clear local state
  } finally {
    saveAuthSession("", "");
    renderAuthTrigger();
    setAuthMode("login");
    setAuthSubmittingState(false);
    closeAuthPanel();
  }
}

async function initializeAuthState() {
  if (!authState.token) {
    renderAuthTrigger();
    renderAuthPanel();
    return;
  }

  try {
    const payload = await requestJson("/api/me", {
      method: "GET",
      withJson: false
    });
    saveAuthSession(authState.token, payload.username || authState.username);
  } catch (error) {
    saveAuthSession("", "");
  }

  renderAuthTrigger();
  renderAuthPanel();
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
    const payload = await requestJson(`/api/events?${query}`, {
      method: "GET",
      withJson: false,
      withAuth: false
    });
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

function initializeAuthUi() {
  if (
    !authTrigger ||
    !authOverlay ||
    !authPanel ||
    !authClose ||
    !authForm ||
    !authModeSwitch ||
    !authLogout
  ) {
    return;
  }

  authTrigger.addEventListener("click", () => {
    openAuthPanel("login");
  });

  authClose.addEventListener("click", () => {
    closeAuthPanel();
  });

  authOverlay.addEventListener("click", (event) => {
    if (event.target === authOverlay) {
      closeAuthPanel();
    }
  });

  authModeSwitch.addEventListener("click", () => {
    const nextMode = authState.mode === "login" ? "signup" : "login";
    setAuthMode(nextMode);
  });

  authForm.addEventListener("submit", handleAuthSubmit);
  authLogout.addEventListener("click", () => {
    handleAuthLogout();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (authState.isOpen) {
      closeAuthPanel();
      return;
    }
    if (settingsState.isOpen) {
      closeSettingsPanel();
    }
  });
}

function initializeSettingsUi() {
  if (!settingsTrigger || !settingsOverlay || !settingsPanel || !settingsClose) {
    return;
  }

  settingsTrigger.addEventListener("click", () => {
    openSettingsPanel();
  });

  settingsClose.addEventListener("click", () => {
    closeSettingsPanel();
  });

  settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) {
      closeSettingsPanel();
    }
  });

  themeModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      setThemePreference(input.value);
    });
  });
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isCollapsed = !document.body.classList.contains("sidebar-collapsed");
    setCollapsedState(isCollapsed);
    localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? "collapsed" : "expanded");
  });
}

initializeSidebarState();
initializeTheme();
initializeAuthUi();
initializeSettingsUi();
initializeAuthState();
initializeEventView();
