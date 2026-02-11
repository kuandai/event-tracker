import {
  AUTH_ROLE_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USERNAME_KEY,
  THEME_KEY,
  VALID_THEME_MODE,
  VALID_USER_ROLE,
  VIEW_EVENTS
} from "./constants.js";

export function normalizeAuthRole(value) {
  return VALID_USER_ROLE.has(value) ? value : "user";
}

export function normalizeThemePreference(value) {
  return VALID_THEME_MODE.has(value) ? value : "system";
}

export const state = {
  event: {
    scope: "upcoming",
    selectedTypes: new Set(),
    items: [],
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    error: ""
  },
  view: {
    active: VIEW_EVENTS
  },
  management: {
    items: [],
    isLoading: false,
    isSubmitting: false,
    error: "",
    feedbackText: "",
    feedbackTone: "",
    hasLoaded: false
  },
  auth: {
    mode: "login",
    token: localStorage.getItem(AUTH_TOKEN_KEY) || "",
    username: localStorage.getItem(AUTH_USERNAME_KEY) || "",
    role: normalizeAuthRole(localStorage.getItem(AUTH_ROLE_KEY) || ""),
    isOpen: false,
    isSubmitting: false
  },
  profileMenu: {
    isOpen: false
  },
  settings: {
    isOpen: false
  },
  theme: {
    preference: localStorage.getItem(THEME_KEY) || "system",
    mediaQuery: null
  }
};
