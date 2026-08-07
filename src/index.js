import {
  PreferencesStore,
  SettingsStore,
  createUserscriptEnvironment,
  requestJson,
  requestText,
} from "./core/index.js";
import * as localization from "./localization/index.js";
import * as media from "./media/index.js";
import { INTERNAL_CSS } from "./resources/index.js";
import { startLegacyUserscript } from "./legacy/runtime.js";

const environment = createUserscriptEnvironment();
const settingsStore = new SettingsStore(environment);
const preferencesStore = new PreferencesStore(environment, {
  defaultLanguage:
    environment.window.navigator.language ||
    environment.window.navigator.userLanguage,
  now: environment.now,
});
const preferences = preferencesStore.load();

startLegacyUserscript(jQuery, Mediabunny, {
  environment,
  preferences,
  preferencesStore,
  settingsStore,
  resources: {
    internalCss: INTERNAL_CSS,
    localeManifest: localization.LOCALE_MANIFEST,
  },
  localization,
  media,
  jsonRequest: (options) => requestJson(environment, options),
  textRequest: (options) => requestText(environment, options),
});
