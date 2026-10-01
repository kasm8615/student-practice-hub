import { api as realApi } from "./api.js";
import { configured, configError } from "./supabase.js";
import { demoApi } from "./demo.js";

// VITE_DEMO=1 runs the whole app on sample data in the browser (no database), for previews.
const DEMO = import.meta.env.VITE_DEMO === "1";
export const api = DEMO ? demoApi : realApi;
export const ready = DEMO || configured;
export const setupError = DEMO ? "" : configError;
