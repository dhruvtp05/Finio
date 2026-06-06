import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

let plaidClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();

  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set in server/.env");
  }

  if (!plaidClient) {
    const plaidEnv = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
    const plaidBasePath = PlaidEnvironments[plaidEnv] ?? PlaidEnvironments.sandbox;

    plaidClient = new PlaidApi(
      new Configuration({
        basePath: plaidBasePath,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": clientId,
            "PLAID-SECRET": secret,
          },
        },
      })
    );
  }

  return plaidClient;
}

export function plaidErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error_message?: string; error_code?: string } } })?.response?.data;
  if (data?.error_message) {
    return data.error_code ? `${data.error_code}: ${data.error_message}` : data.error_message;
  }
  if (error instanceof Error) return error.message;
  return "Unknown Plaid error";
}
