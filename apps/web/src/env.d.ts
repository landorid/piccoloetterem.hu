interface ImportMetaEnv {
  /** API origin, `https://api.<domain>`. See .env.example. */
  readonly PUBLIC_API_URL?: string;
  readonly PUBLIC_IMAGES_URL?: string;
  /** Sentry DSN for browser errors; unset turns reporting off. See .env.example. */
  readonly PUBLIC_SENTRY_DSN?: string;
  /** development | staging | production, the Sentry environment. See .env.example. */
  readonly PUBLIC_ENVIRONMENT?: string;
}
