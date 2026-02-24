/**
 * Patterns to detect quota/balance-related errors in 400 Bad Request responses.
 * Some providers return 400 instead of 402 for quota exhaustion.
 */
export const QUOTA_ERROR_PATTERNS = [
  'insufficient_quota',
  'credit balance is too low',
  'used up your points',
  'quota exceeded',
  'out of credits',
  'balance too low',
  'insufficient balance',
  'insufficient funds',
  'account balance',
  'quota limit',
  'usage limit',
];
