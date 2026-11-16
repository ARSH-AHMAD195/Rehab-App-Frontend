/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_URL: string;
  readonly VITE_HEALTH_API_URL: string;
  readonly VITE_EXERCISE_API_URL: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_IDLE_TIMEOUT_MINUTES?: string;
  /** Domain of patients' phone login alias; must match the Auth API. */
  readonly VITE_PATIENT_LOGIN_EMAIL_DOMAIN?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
