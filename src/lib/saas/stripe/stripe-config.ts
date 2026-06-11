import "server-only";

/* Conservé pour rétro-compat : la configuration vit désormais dans config.ts. */
export {
  isStripeEnabled,
  getStripeMode,
  getStripeConfigStatus,
  requireStripeEnabled,
  requireStripeEnabled as assertStripeEnabled,
} from "./config";
