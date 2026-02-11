export function createThemeSettingsFeature(ctx) {
  const { constants, dom, state } = ctx;

  function syncModalLock() {
    const shouldLock = state.auth.isOpen || state.settings.isOpen || state.profileMenu.isOpen;
    document.body.classList.toggle("modal-open", shouldLock);
  }

  function resolveTheme(preference) {
    if (preference === "light" || preference === "dark") {
      return preference;
    }
    return state.theme.mediaQuery?.matches ? "dark" : "light";
  }

  function applyTheme() {
    const resolved = resolveTheme(state.theme.preference);
    document.documentElement.setAttribute("data-theme", resolved);
  }

  function renderThemeOptions() {
    dom.themeModeInputs.forEach((input) => {
      input.checked = input.value === state.theme.preference;
    });
  }

  function setThemePreference(preference, persist = true) {
    const normalized = ctx.normalizeThemePreference(preference);
    state.theme.preference = normalized;

    if (persist) {
      localStorage.setItem(constants.THEME_KEY, normalized);
    }

    applyTheme();
    renderThemeOptions();
  }

  function openSettingsPanel() {
    if (!dom.settingsOverlay) return;

    ctx.actions.closeAuthPanel?.();
    ctx.actions.closeProfileMenu?.();

    dom.settingsOverlay.hidden = false;
    state.settings.isOpen = true;
    syncModalLock();
    renderThemeOptions();
  }

  function closeSettingsPanel() {
    if (!dom.settingsOverlay) return;

    dom.settingsOverlay.hidden = true;
    state.settings.isOpen = false;
    syncModalLock();
  }

  function initializeTheme() {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    state.theme.mediaQuery = mediaQuery;

    setThemePreference(state.theme.preference, false);

    const onSystemThemeChange = () => {
      if (state.theme.preference === "system") {
        applyTheme();
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onSystemThemeChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(onSystemThemeChange);
    }
  }

  function initializeSettingsUi() {
    if (!dom.settingsTrigger || !dom.settingsOverlay || !dom.settingsPanel || !dom.settingsClose) {
      return;
    }

    dom.settingsTrigger.addEventListener("click", () => {
      openSettingsPanel();
    });

    dom.settingsClose.addEventListener("click", () => {
      closeSettingsPanel();
    });

    dom.settingsOverlay.addEventListener("click", (event) => {
      if (event.target === dom.settingsOverlay) {
        closeSettingsPanel();
      }
    });

    dom.themeModeInputs.forEach((input) => {
      input.addEventListener("change", () => {
        setThemePreference(input.value);
      });
    });
  }

  return {
    actions: {
      closeSettingsPanel,
      openSettingsPanel,
      setThemePreference,
      syncModalLock
    },
    initializeTheme,
    initializeSettingsUi
  };
}
