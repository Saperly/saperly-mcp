import {
  SaperlyError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConsentRequiredError,
  ConsentAlreadyGrantedError,
  CallInProgressError,
  CallNotActiveError,
  InsufficientCreditsError,
  PaymentMethodRequiredError,
  NumberOptedOutError,
  AgentScopeError,
  AgentCapExceededError,
  AgentPermissionDeniedError,
  M3FraudBlockError,
} from "@saperly/sdk";

function formatError(err: unknown): string {
  if (err instanceof ValidationError) {
    const details = err.details
      .map((d) => `  - ${d.field ? `${d.field}: ` : ""}${d.message}`)
      .join("\n");
    return `validation error: ${err.message}${details ? `\n${details}` : ""}`;
  }
  if (err instanceof AuthenticationError) {
    return `authentication failed: ${err.message}. check your SAPERLY_API_KEY.`;
  }
  if (err instanceof ForbiddenError) {
    return `forbidden: ${err.message}. check your API key permissions.`;
  }
  if (err instanceof NotFoundError) {
    return `not found: ${err.message}`;
  }
  if (err instanceof ConsentRequiredError) {
    return `consent required: ${err.message}. use saperly_grant_consent first.`;
  }
  if (err instanceof ConsentAlreadyGrantedError) {
    return `consent already granted: ${err.message}`;
  }
  if (err instanceof CallInProgressError) {
    return `call already in progress: ${err.message}`;
  }
  if (err instanceof CallNotActiveError) {
    return `call not active: ${err.message}`;
  }
  if (err instanceof InsufficientCreditsError) {
    return `insufficient credits: ${err.message}. check balance with saperly_get_balance.`;
  }
  if (err instanceof PaymentMethodRequiredError) {
    return `payment method required: ${err.message} add a card in the Saperly portal at https://saperly.com/billing#payment-method, then retry with a NEW Idempotency-Key (the original 402 is sticky-cached for ~12h).`;
  }
  if (err instanceof NumberOptedOutError) {
    return `number opted out: ${err.message}`;
  }
  if (err instanceof AgentCapExceededError) {
    const detail = err.details
      .map((d) => `${d.field ? `${d.field}=` : ""}${d.message}`)
      .join(", ");
    return `agent cap exceeded: ${err.message}${detail ? ` (${detail})` : ""}. raise the cap or wait for the cycle to reset.`;
  }
  if (err instanceof AgentScopeError) {
    const detail = err.details
      .map((d) => `${d.field ? `${d.field}=` : ""}${d.message}`)
      .join(", ");
    return `agent scope error: ${err.message}${detail ? ` (${detail})` : ""}. this key is restricted to a specific line.`;
  }
  if (err instanceof AgentPermissionDeniedError) {
    const detail = err.details
      .map((d) => `${d.field ? `${d.field}=` : ""}${d.message}`)
      .join(", ");
    return `agent permission denied: ${err.message}${detail ? ` (${detail})` : ""}. this key's tier doesn't permit this operation.`;
  }
  if (err instanceof M3FraudBlockError) {
    return `request blocked by fraud heuristic: ${err.message}. contact support if this is unexpected.`;
  }
  if (err instanceof SaperlyError) {
    return `api error (${err.code}): ${err.message}`;
  }
  if (err instanceof Error) {
    return `unexpected error: ${err.message}`;
  }
  return `unexpected error: ${String(err)}`;
}

export function toolResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function toolError(err: unknown) {
  return { content: [{ type: "text" as const, text: formatError(err) }], isError: true as const };
}
