import { captureReactError } from "./sentry";

interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

/**
 * Sanitizes and translates backend/database error objects into safe,
 * user-friendly error messages while ensuring unhandled technical exceptions
 * are logged to Sentry.
 */
export function formatAppError(err: unknown, fallback = "An unexpected error occurred. Please try again."): string {
  if (!err) return fallback;

  // String error
  if (typeof err === "string") {
    if (err.includes("Failed to fetch") || err.includes("NetworkError")) {
      return "Network connection issue. Please check your internet connection.";
    }
    return err;
  }

  const pgErr = err as PostgrestLikeError;
  const code = pgErr.code;
  const message = pgErr.message || "";

  // PostgreSQL Error Code mappings
  switch (code) {
    case "23505": // unique_violation
      return "A record with this identifier or name already exists.";
    case "23503": // foreign_key_violation
      return "This action cannot be completed because the record is linked to other data.";
    case "23502": // not_null_violation
      return "A required field was missing. Please check your input.";
    case "42501": // insufficient_privilege / RLS violation
      return "You do not have permission to perform this action.";
    case "55006": // custom rate limit exception
      return "Too many requests. Please wait a few minutes before trying again.";
    case "22P02": // invalid_text_representation
      return "Invalid data format submitted. Please check the entered values.";
    case "PGRST116": // JSON single row returned 0 rows
      return "The requested record was not found.";
    default:
      break;
  }

  // Network / fetch checks
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network error")) {
    return "Network connection issue. Please check your internet connection.";
  }

  if (message.toLowerCase().includes("jwt expired") || message.toLowerCase().includes("token expired")) {
    return "Your session has expired. Please sign in again.";
  }

  // Log unexpected errors to Sentry for diagnostics
  if (err instanceof Error) {
    captureReactError(err);
    return err.message || fallback;
  }

  return message || fallback;
}
