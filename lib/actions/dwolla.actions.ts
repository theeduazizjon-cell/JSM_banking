"use server";

import { Client } from "dwolla-v2";

const getEnvironment = (): "production" | "sandbox" => {
  const environment = process.env.DWOLLA_ENV as string;

  switch (environment) {
    case "sandbox":
      return "sandbox";
    case "production":
      return "production";
    default:
      // Never fall back to a default here: dwolla-v2 defaults to production.
      throw new Error(
        `DWOLLA_ENV must be set to \`sandbox\` or \`production\` (received: ${
          environment ? `"${environment}"` : "nothing"
        }). Add DWOLLA_ENV=sandbox to .env.local for local development and restart the dev server.`
      );
  }
};

const getRequiredEnv = (name: "DWOLLA_KEY" | "DWOLLA_SECRET"): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set. Add your Dwolla sandbox ${name} to .env.local and restart the dev server.`
    );
  }

  return value;
};

// Created on first use so pages that only import this module (e.g. via
// user.actions) still render when Dwolla is not configured yet.
let client: Client | undefined;

const getDwollaClient = () => {
  client ??= new Client({
    environment: getEnvironment(),
    key: getRequiredEnv("DWOLLA_KEY"),
    secret: getRequiredEnv("DWOLLA_SECRET"),
  });

  return client;
};

// Create a Dwolla Funding Source using a Plaid Processor Token
export const createFundingSource = async (
  options: CreateFundingSourceOptions
) => {
  try {
    return await getDwollaClient()
      .post(`customers/${options.customerId}/funding-sources`, {
        name: options.fundingSourceName,
        plaidToken: options.plaidToken,
      })
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Creating a Funding Source Failed: ", err);
  }
};

export const createOnDemandAuthorization = async () => {
  try {
    const onDemandAuthorization = await getDwollaClient().post(
      "on-demand-authorizations"
    );
    const authLink = onDemandAuthorization.body._links;
    return authLink;
  } catch (err) {
    console.error("Creating an On Demand Authorization Failed: ", err);
  }
};

export const createDwollaCustomer = async (
  newCustomer: NewDwollaCustomerParams
) => {
  try {
    return await getDwollaClient()
      .post("customers", newCustomer)
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Creating a Dwolla Customer Failed: ", err);

    // Pass Dwolla's validation messages (e.g. invalid state or SSN) on to the sign-up form
    const body = (err as { body?: { message?: string; _embedded?: { errors?: { message: string }[] } } })?.body;
    const details = body?._embedded?.errors?.map((e) => e.message).join(" ") || body?.message;

    if (details) throw new Error(`Dwolla rejected these details: ${details}`);
  }
};

export const createTransfer = async ({
  sourceFundingSourceUrl,
  destinationFundingSourceUrl,
  amount,
}: TransferParams) => {
  try {
    const requestBody = {
      _links: {
        source: {
          href: sourceFundingSourceUrl,
        },
        destination: {
          href: destinationFundingSourceUrl,
        },
      },
      amount: {
        currency: "USD",
        value: amount,
      },
    };
    return await getDwollaClient()
      .post("transfers", requestBody)
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Transfer fund failed: ", err);
  }
};

export const addFundingSource = async ({
  dwollaCustomerId,
  processorToken,
  bankName,
}: AddFundingSourceParams) => {
  try {
    // create dwolla auth link
    const dwollaAuthLinks = await createOnDemandAuthorization();

    // add funding source to the dwolla customer & get the funding source url
    const fundingSourceOptions = {
      customerId: dwollaCustomerId,
      fundingSourceName: bankName,
      plaidToken: processorToken,
      _links: dwollaAuthLinks,
    };
    return await createFundingSource(fundingSourceOptions);
  } catch (err) {
    console.error("Transfer fund failed: ", err);
  }
};
