export function createAuthFeature(ctx) {
  const { constants, dom, state } = ctx;

  function setAuthMessage(text, tone = "") {
    if (!dom.authMessage) return;

    dom.authMessage.textContent = text;
    dom.authMessage.classList.remove("error", "success");

    if (tone) {
      dom.authMessage.classList.add(tone);
    }
  }

  function saveAuthSession(token, username, role = "user") {
    state.auth.token = token || "";
    state.auth.username = username || "";
    state.auth.role = ctx.normalizeAuthRole(role);

    if (state.auth.token) {
      localStorage.setItem(constants.AUTH_TOKEN_KEY, state.auth.token);
    } else {
      localStorage.removeItem(constants.AUTH_TOKEN_KEY);
    }

    if (state.auth.username) {
      localStorage.setItem(constants.AUTH_USERNAME_KEY, state.auth.username);
    } else {
      localStorage.removeItem(constants.AUTH_USERNAME_KEY);
    }

    if (state.auth.token && state.auth.username) {
      localStorage.setItem(constants.AUTH_ROLE_KEY, state.auth.role);
    } else {
      localStorage.removeItem(constants.AUTH_ROLE_KEY);
    }
  }

  function renderAuthTrigger() {
    if (!dom.authTrigger || !dom.authTriggerLabel) return;

    if (state.auth.username) {
      dom.authTriggerLabel.textContent = state.auth.username;
      dom.authTrigger.classList.add("is-authenticated");
      dom.authTrigger.setAttribute("aria-label", `Open profile menu for ${state.auth.username}`);
      dom.authTrigger.setAttribute("aria-haspopup", "menu");
      dom.authTrigger.setAttribute("aria-expanded", String(state.profileMenu.isOpen));
    } else {
      dom.authTriggerLabel.textContent = "Sign in";
      dom.authTrigger.classList.remove("is-authenticated");
      dom.authTrigger.setAttribute("aria-label", "Sign in");
      dom.authTrigger.setAttribute("aria-haspopup", "dialog");
      dom.authTrigger.setAttribute("aria-expanded", "false");
    }
  }

  function renderAuthPanel() {
    if (!dom.authTitle || !dom.authSubtitle || !dom.authSubmit || !dom.authModeSwitch) {
      return;
    }

    const isLoginMode = state.auth.mode === "login";
    dom.authTitle.textContent = isLoginMode ? "Sign in" : "Create account";
    dom.authSubtitle.textContent = isLoginMode
      ? "Use your account to track completed items."
      : "Create an account to track personal progress.";
    dom.authSubmit.textContent = isLoginMode ? "Sign in" : "Sign up";
    dom.authModeSwitch.textContent = isLoginMode ? "Create account instead" : "Use existing account";
    dom.authModeSwitch.disabled = state.auth.isSubmitting;

    if (dom.authUsernameInput && !dom.authUsernameInput.value && state.auth.username) {
      dom.authUsernameInput.value = state.auth.username;
    }
  }

  function renderProfileMenu() {
    if (!dom.profileMenuUsername || !dom.profileMenuRole) return;

    dom.profileMenuUsername.textContent = state.auth.username || "";
    dom.profileMenuRole.textContent = state.auth.role === "admin" ? "Admin" : "User";
  }

  function setAuthMode(mode) {
    if (!constants.VALID_AUTH_MODE.has(mode)) {
      return;
    }

    state.auth.mode = mode;

    if (dom.authPasswordInput) {
      dom.authPasswordInput.value = "";
      dom.authPasswordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
    }

    setAuthMessage("");
    renderAuthPanel();
  }

  function openAuthPanel(mode) {
    if (!dom.authOverlay) return;

    ctx.actions.closeSettingsPanel?.();
    closeProfileMenu();

    if (mode) {
      setAuthMode(mode);
    } else {
      renderAuthPanel();
    }

    dom.authOverlay.hidden = false;
    state.auth.isOpen = true;
    ctx.actions.syncModalLock?.();

    setTimeout(() => {
      dom.authUsernameInput?.focus();
    }, 0);
  }

  function closeAuthPanel() {
    if (!dom.authOverlay) return;

    dom.authOverlay.hidden = true;
    state.auth.isOpen = false;
    ctx.actions.syncModalLock?.();
    setAuthMessage("");
  }

  function openProfileMenu() {
    if (!dom.profileMenuOverlay || !state.auth.username) return;

    closeAuthPanel();
    ctx.actions.closeSettingsPanel?.();
    renderProfileMenu();

    dom.profileMenuOverlay.hidden = false;
    state.profileMenu.isOpen = true;
    ctx.actions.syncModalLock?.();
    renderAuthTrigger();
  }

  function closeProfileMenu() {
    if (!dom.profileMenuOverlay) return;

    dom.profileMenuOverlay.hidden = true;
    state.profileMenu.isOpen = false;
    ctx.actions.syncModalLock?.();
    renderAuthTrigger();
  }

  function setAuthSubmittingState(isSubmitting) {
    state.auth.isSubmitting = isSubmitting;

    if (dom.authSubmit) dom.authSubmit.disabled = isSubmitting;
    if (dom.authModeSwitch) dom.authModeSwitch.disabled = isSubmitting;
    if (dom.authClose) dom.authClose.disabled = isSubmitting;
    if (dom.authUsernameInput) dom.authUsernameInput.disabled = isSubmitting;
    if (dom.authPasswordInput) dom.authPasswordInput.disabled = isSubmitting;
    if (dom.profileSignOutBtn) dom.profileSignOutBtn.disabled = isSubmitting;
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!dom.authUsernameInput || !dom.authPasswordInput) {
      return;
    }

    const username = dom.authUsernameInput.value.trim();
    const password = dom.authPasswordInput.value;

    if (!username || !password) {
      setAuthMessage("Username and password are required.", "error");
      return;
    }

    if (state.auth.mode === "signup" && password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.", "error");
      return;
    }

    setAuthSubmittingState(true);
    setAuthMessage("");

    try {
      if (state.auth.mode === "signup") {
        await ctx.requestJson("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });

        setAuthMode("login");
        setAuthMessage("Account created. Sign in with your new credentials.", "success");
        return;
      }

      const payload = await ctx.requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      saveAuthSession(payload.token, payload.username, payload.role);
      renderAuthTrigger();
      renderProfileMenu();
      ctx.actions.renderManagementNav?.();
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
    if (!state.auth.username || state.auth.isSubmitting) {
      return;
    }

    setAuthSubmittingState(true);
    setAuthMessage("");

    try {
      await ctx.requestJson("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
        withJson: false
      });
    } catch (error) {
      // Session may already be expired; always clear local state.
    } finally {
      saveAuthSession("", "", "user");
      renderAuthTrigger();
      renderProfileMenu();
      ctx.actions.renderManagementNav?.();
      setAuthMode("login");
      setAuthSubmittingState(false);
      closeAuthPanel();
      closeProfileMenu();
    }
  }

  async function initializeAuthState() {
    if (!state.auth.token) {
      saveAuthSession("", "", "user");
      renderAuthTrigger();
      renderAuthPanel();
      renderProfileMenu();
      ctx.actions.renderManagementNav?.();
      return;
    }

    try {
      const payload = await ctx.requestJson("/api/me", {
        method: "GET",
        withJson: false
      });
      saveAuthSession(state.auth.token, payload.username || state.auth.username, payload.role || state.auth.role);
    } catch (error) {
      saveAuthSession("", "", "user");
    }

    renderAuthTrigger();
    renderAuthPanel();
    renderProfileMenu();
    ctx.actions.renderManagementNav?.();
  }

  function initializeAuthUi() {
    if (!dom.authTrigger || !dom.authOverlay || !dom.authPanel || !dom.authClose || !dom.authForm || !dom.authModeSwitch) {
      return;
    }

    dom.authTrigger.addEventListener("click", () => {
      if (state.auth.username) {
        if (state.profileMenu.isOpen) {
          closeProfileMenu();
        } else {
          openProfileMenu();
        }
        return;
      }

      openAuthPanel("login");
    });

    dom.authClose.addEventListener("click", () => {
      closeAuthPanel();
    });

    dom.authOverlay.addEventListener("click", (event) => {
      if (event.target === dom.authOverlay) {
        closeAuthPanel();
      }
    });

    dom.authModeSwitch.addEventListener("click", () => {
      const nextMode = state.auth.mode === "login" ? "signup" : "login";
      setAuthMode(nextMode);
    });

    dom.authForm.addEventListener("submit", handleAuthSubmit);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (state.auth.isOpen) {
        closeAuthPanel();
        return;
      }

      if (state.profileMenu.isOpen) {
        closeProfileMenu();
        return;
      }

      if (state.settings.isOpen) {
        ctx.actions.closeSettingsPanel?.();
      }
    });
  }

  function initializeProfileMenuUi() {
    if (!dom.profileMenuOverlay || !dom.profileMenuPanel || !dom.profileSignOutBtn) {
      return;
    }

    dom.profileMenuOverlay.addEventListener("click", (event) => {
      if (event.target === dom.profileMenuOverlay) {
        closeProfileMenu();
      }
    });

    dom.profileSignOutBtn.addEventListener("click", () => {
      handleAuthLogout();
    });
  }

  return {
    actions: {
      closeAuthPanel,
      closeProfileMenu,
      openAuthPanel,
      openProfileMenu,
      renderAuthTrigger
    },
    initializeAuthState,
    initializeAuthUi,
    initializeProfileMenuUi
  };
}
