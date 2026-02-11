import * as constants from "./core/constants.js";
import { requestJson } from "./core/api.js";
import { dom } from "./core/dom.js";
import { normalizeAuthRole, normalizeThemePreference, state } from "./core/state.js";
import { createAuthFeature } from "./features/auth.js";
import { createEventsFeature } from "./features/events.js";
import { createManagementFeature } from "./features/management.js";
import { createNavigationFeature } from "./features/navigation.js";
import { createThemeSettingsFeature } from "./features/theme-settings.js";

const ctx = {
  constants,
  dom,
  state,
  normalizeAuthRole,
  normalizeThemePreference,
  requestJson: (path, options = {}) => requestJson(state, path, options),
  actions: {}
};

const themeFeature = createThemeSettingsFeature(ctx);
const navigationFeature = createNavigationFeature(ctx);
const eventsFeature = createEventsFeature(ctx);
const managementFeature = createManagementFeature(ctx);
const authFeature = createAuthFeature(ctx);

Object.assign(
  ctx.actions,
  themeFeature.actions,
  navigationFeature.actions,
  eventsFeature.actions,
  managementFeature.actions,
  authFeature.actions
);

navigationFeature.initializeSidebarToggle();
navigationFeature.initializeSidebarState();
themeFeature.initializeTheme();
navigationFeature.initializeNavigationUi();
authFeature.initializeAuthUi();
authFeature.initializeProfileMenuUi();
themeFeature.initializeSettingsUi();
authFeature.initializeAuthState();
eventsFeature.initializeEventView();
managementFeature.initializeManagementView();
ctx.actions.renderActiveView?.();
