/**
 * Centralized runtime configuration and feature flags.
 */

/**
 * Toggle for enabling the comments backend integration.
 * 
 * Source: NEXT_PUBLIC_COMMENTS_BACKEND_ENABLED ("true" to enable)
 * Default: false (disabled)
 * 
 * Keep this disabled until a new comments backend is implemented.
 */
export const COMMENTS_BACKEND_ENABLED: boolean = (
  (process.env.NEXT_PUBLIC_COMMENTS_BACKEND_ENABLED || 'false').toString().trim().toLowerCase() === 'true'
);

/** Utility to read boolean env flags with a default. */
export function readBooleanEnvFlag(envValue: string | undefined, defaultValue: boolean = false): boolean {
  if (envValue == null) return defaultValue;
  const normalized = envValue.toString().trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}


