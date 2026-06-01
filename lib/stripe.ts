import Stripe from "stripe";

let cachedStripeClient: Stripe | null = null;

function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is required to initialize Stripe. Set this env var in Vercel."
    );
  }
  return key;
}

function createStripeClient() {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: "2026-04-22.dahlia",
  });
}

function getStripeClient() {
  if (!cachedStripeClient) {
    cachedStripeClient = createStripeClient();
  }
  return cachedStripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripeClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, prop, value) {
    return Reflect.set(getStripeClient() as any, prop, value);
  },
  has(_target, prop) {
    return Reflect.has(getStripeClient(), prop);
  },
});

export function getStripe() {
  return getStripeClient();
}

