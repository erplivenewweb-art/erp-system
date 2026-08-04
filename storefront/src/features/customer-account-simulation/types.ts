export const CUSTOMER_ACCOUNT_SCHEMA_VERSION = 1;
export const CUSTOMER_ACCOUNT_STORAGE_KEY =
  "silver-sankha-development-account-v1";
export const MAX_SIMULATED_ADDRESSES = 5;
export const FIXTURE_CREATED_AT = "2026-01-01T00:00:00.000Z";

export type CustomerSessionStatus = "guest" | "simulated-signed-in";
export type ShoppingPreference = "retail" | "wholesale-interest";
export type ProfileCompleteness = "empty" | "partial" | "complete";
export type AddressLabel = "Home" | "Work" | "Other";
export type CheckoutReadinessStatus =
  "not-started" | "incomplete" | "ready-for-preview" | "blocked";
export type DeliveryOptionId = "standard" | "priority";
export type PaymentPreviewId = "upi-preview" | "card-preview";

export interface SimulatedCustomerSession {
  status: CustomerSessionStatus;
  customerId: string;
  issuedAt: string;
}

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone?: string;
  marketingPreference: boolean;
  shoppingPreference: ShoppingPreference;
  createdAt: string;
  updatedAt: string;
  completeness: ProfileCompleteness;
}

export interface SimulatedAddress {
  id: string;
  label: AddressLabel;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryInstructions?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutSelections {
  addressId?: string;
  deliveryOption?: DeliveryOptionId;
  paymentPreview?: PaymentPreviewId;
  acknowledged: boolean;
}

export interface PersistedCustomerAccount {
  version: typeof CUSTOMER_ACCOUNT_SCHEMA_VERSION;
  session: SimulatedCustomerSession | null;
  profile: CustomerProfile | null;
  addresses: readonly SimulatedAddress[];
  checkout: CheckoutSelections;
}

export interface ValidationResult<T> {
  value?: T;
  errors: Record<string, string>;
  valid: boolean;
}

export interface CheckoutReadiness {
  status: CheckoutReadinessStatus;
  checks: readonly {
    id: string;
    label: string;
    complete: boolean;
    blocking: boolean;
  }[];
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  marketingPreference: boolean;
  shoppingPreference: ShoppingPreference;
}

export interface AddressInput {
  label: AddressLabel;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryInstructions?: string;
  isDefault: boolean;
}
