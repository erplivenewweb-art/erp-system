import type { CartItem } from "@/features/customer-intent";
import {
  CUSTOMER_ACCOUNT_SCHEMA_VERSION,
  FIXTURE_CREATED_AT,
  MAX_SIMULATED_ADDRESSES,
  type AddressInput,
  type CheckoutReadiness,
  type CheckoutSelections,
  type CustomerProfile,
  type PersistedCustomerAccount,
  type ProfileCompleteness,
  type ProfileInput,
  type SimulatedAddress,
  type SimulatedCustomerSession,
  type ValidationResult,
} from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[6-9]\d{9}$/;
const POSTAL_CODE = /^[1-9]\d{5}$/;
const SAFE_NAME = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

function clean(value: string, maximum: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maximum);
}

export function normalizeEmail(value: string) {
  return clean(value, 120).toLowerCase();
}

export function validateSignInEmail(value: string) {
  const email = normalizeEmail(value);
  return EMAIL.test(email)
    ? { valid: true as const, email }
    : {
        valid: false as const,
        email,
        error: "Enter a valid email address.",
      };
}

export function normalizePhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits.slice(0, 10);
}

export function profileCompleteness(
  input: Partial<ProfileInput>,
): ProfileCompleteness {
  const values = [input.firstName, input.lastName, input.email].filter(Boolean);
  return values.length === 0
    ? "empty"
    : values.length === 3
      ? "complete"
      : "partial";
}

export function validateProfile(
  input: ProfileInput,
  now = new Date().toISOString(),
  createdAt = FIXTURE_CREATED_AT,
): ValidationResult<CustomerProfile> {
  const firstName = clean(input.firstName, 50);
  const lastName = clean(input.lastName, 50);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const errors: Record<string, string> = {};
  if (!firstName || !SAFE_NAME.test(firstName))
    errors.firstName = "Enter a valid first name using 1–50 letters.";
  if (!lastName || !SAFE_NAME.test(lastName))
    errors.lastName = "Enter a valid last name using 1–50 letters.";
  if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (phone && !PHONE.test(phone))
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (
    input.shoppingPreference !== "retail" &&
    input.shoppingPreference !== "wholesale-interest"
  )
    errors.shoppingPreference = "Choose a supported shopping preference.";
  if (Object.keys(errors).length) return { valid: false, errors };
  return {
    valid: true,
    errors,
    value: {
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      email,
      ...(phone ? { phone } : {}),
      marketingPreference: input.marketingPreference,
      shoppingPreference: input.shoppingPreference,
      createdAt,
      updatedAt: now,
      completeness: "complete",
    },
  };
}

export function localCustomerId(email: string) {
  let hash = 2166136261;
  for (const character of normalizeEmail(email)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sim-customer-${(hash >>> 0).toString(36)}`;
}

export function createSignedInSession(
  email: string,
  issuedAt = new Date().toISOString(),
): SimulatedCustomerSession {
  return {
    status: "simulated-signed-in",
    customerId: localCustomerId(email),
    issuedAt,
  };
}

export function createGuestSession(
  issuedAt = new Date().toISOString(),
): SimulatedCustomerSession {
  return {
    status: "guest",
    customerId: "sim-guest-current-browser",
    issuedAt,
  };
}

export function validateAddress(
  input: AddressInput,
  id: string,
  now = new Date().toISOString(),
  createdAt = now,
): ValidationResult<SimulatedAddress> {
  const value = {
    label: input.label,
    recipientName: clean(input.recipientName, 80),
    phone: normalizePhone(input.phone),
    addressLine1: clean(input.addressLine1, 120),
    addressLine2: clean(input.addressLine2 ?? "", 120),
    landmark: clean(input.landmark ?? "", 80),
    city: clean(input.city, 60),
    state: clean(input.state, 60),
    postalCode: clean(input.postalCode, 6),
    country: clean(input.country || "India", 60),
    deliveryInstructions: clean(input.deliveryInstructions ?? "", 200),
  };
  const errors: Record<string, string> = {};
  if (!["Home", "Work", "Other"].includes(value.label))
    errors.label = "Choose a supported address label.";
  if (!value.recipientName || !SAFE_NAME.test(value.recipientName))
    errors.recipientName = "Enter a valid recipient name.";
  if (!PHONE.test(value.phone))
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (value.addressLine1.length < 5)
    errors.addressLine1 = "Enter at least 5 characters for address line 1.";
  if (!value.city) errors.city = "Enter a city.";
  if (!value.state) errors.state = "Choose a state.";
  if (!POSTAL_CODE.test(value.postalCode))
    errors.postalCode = "Enter a valid 6-digit Indian postal code.";
  if (!value.country) errors.country = "Enter a country.";
  if (Object.keys(errors).length) return { valid: false, errors };
  return {
    valid: true,
    errors,
    value: {
      id,
      label: value.label,
      recipientName: value.recipientName,
      phone: value.phone,
      addressLine1: value.addressLine1,
      ...(value.addressLine2 ? { addressLine2: value.addressLine2 } : {}),
      ...(value.landmark ? { landmark: value.landmark } : {}),
      city: value.city,
      state: value.state,
      postalCode: value.postalCode,
      country: value.country,
      ...(value.deliveryInstructions
        ? { deliveryInstructions: value.deliveryInstructions }
        : {}),
      isDefault: input.isDefault,
      createdAt,
      updatedAt: now,
    },
  };
}

export function addressesEqual(a: SimulatedAddress, b: SimulatedAddress) {
  return (
    a.recipientName.toLowerCase() === b.recipientName.toLowerCase() &&
    a.addressLine1.toLowerCase() === b.addressLine1.toLowerCase() &&
    a.city.toLowerCase() === b.city.toLowerCase() &&
    a.postalCode === b.postalCode
  );
}

export function addAddress(
  addresses: readonly SimulatedAddress[],
  address: SimulatedAddress,
) {
  if (
    addresses.length >= MAX_SIMULATED_ADDRESSES ||
    addresses.some((item) => addressesEqual(item, address))
  )
    return addresses;
  const makeDefault = address.isDefault || addresses.length === 0;
  return [
    ...addresses.map((item) =>
      makeDefault ? { ...item, isDefault: false } : item,
    ),
    { ...address, isDefault: makeDefault },
  ];
}

export function updateAddress(
  addresses: readonly SimulatedAddress[],
  address: SimulatedAddress,
) {
  if (
    addresses.some(
      (item) => item.id !== address.id && addressesEqual(item, address),
    )
  )
    return addresses;
  return addresses.map((item) =>
    item.id === address.id
      ? address
      : address.isDefault
        ? { ...item, isDefault: false }
        : item,
  );
}

export function deleteAddress(
  addresses: readonly SimulatedAddress[],
  id: string,
) {
  const removed = addresses.find((item) => item.id === id);
  const next = addresses.filter((item) => item.id !== id);
  if (removed?.isDefault && next.length)
    return next.map((item, index) => ({ ...item, isDefault: index === 0 }));
  return next;
}

export function setDefaultAddress(
  addresses: readonly SimulatedAddress[],
  id: string,
) {
  return addresses.map((item) => ({ ...item, isDefault: item.id === id }));
}

export function checkoutReadiness(
  cartItems: readonly CartItem[],
  session: SimulatedCustomerSession | null,
  profile: CustomerProfile | null,
  addresses: readonly SimulatedAddress[],
  checkout: CheckoutSelections,
): CheckoutReadiness {
  const checks = [
    {
      id: "cart",
      label: "Cart contains a valid simulated item",
      complete: cartItems.length > 0,
      blocking: true,
    },
    {
      id: "availability",
      label: "Every simulated item remains available",
      complete: cartItems.every((item) => item.availability !== "OUT_OF_STOCK"),
      blocking: true,
    },
    {
      id: "customer",
      label: "Guest or simulated customer path selected",
      complete: session !== null,
      blocking: false,
    },
    {
      id: "profile",
      label: "Required simulated profile details are complete",
      complete:
        session?.status === "guest" || profile?.completeness === "complete",
      blocking: false,
    },
    {
      id: "address",
      label: "A valid simulated delivery address is selected",
      complete:
        addresses.length > 0 &&
        addresses.some((item) => item.id === checkout.addressId),
      blocking: false,
    },
    {
      id: "delivery",
      label: "An illustrative delivery option is selected",
      complete: checkout.deliveryOption !== undefined,
      blocking: false,
    },
    {
      id: "payment",
      label: "A non-functional payment preview is selected",
      complete: checkout.paymentPreview !== undefined,
      blocking: false,
    },
    {
      id: "acknowledgement",
      label: "Simulation limitations are acknowledged",
      complete: checkout.acknowledged,
      blocking: false,
    },
  ] as const;
  const blocked = checks.some((check) => check.blocking && !check.complete);
  return {
    checks,
    status: blocked
      ? "blocked"
      : session === null
        ? "not-started"
        : checks.every((check) => check.complete)
          ? "ready-for-preview"
          : "incomplete",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parsePersistedCustomerAccount(
  value: unknown,
): PersistedCustomerAccount | null {
  if (
    !isRecord(value) ||
    value.version !== CUSTOMER_ACCOUNT_SCHEMA_VERSION ||
    !Array.isArray(value.addresses) ||
    value.addresses.length > MAX_SIMULATED_ADDRESSES ||
    !isRecord(value.checkout)
  )
    return null;
  const sessionValue = value.session;
  const checkoutValue = value.checkout;
  if (
    sessionValue !== null &&
    (!isRecord(sessionValue) ||
      (sessionValue.status !== "guest" &&
        sessionValue.status !== "simulated-signed-in") ||
      typeof sessionValue.customerId !== "string" ||
      !sessionValue.customerId.startsWith("sim-") ||
      !isTimestamp(sessionValue.issuedAt))
  )
    return null;
  let profile: CustomerProfile | null = null;
  if (value.profile !== null) {
    if (
      !isRecord(value.profile) ||
      typeof value.profile.firstName !== "string" ||
      typeof value.profile.lastName !== "string" ||
      typeof value.profile.displayName !== "string" ||
      typeof value.profile.email !== "string" ||
      (value.profile.phone !== undefined &&
        typeof value.profile.phone !== "string") ||
      typeof value.profile.marketingPreference !== "boolean" ||
      (value.profile.shoppingPreference !== "retail" &&
        value.profile.shoppingPreference !== "wholesale-interest") ||
      (value.profile.completeness !== "empty" &&
        value.profile.completeness !== "partial" &&
        value.profile.completeness !== "complete") ||
      !isTimestamp(value.profile.createdAt) ||
      !isTimestamp(value.profile.updatedAt)
    )
      return null;
    const email = normalizeEmail(value.profile.email);
    const firstName = clean(value.profile.firstName, 50);
    const lastName = clean(value.profile.lastName, 50);
    const phone = normalizePhone(value.profile.phone);
    if (
      !EMAIL.test(email) ||
      (firstName && !SAFE_NAME.test(firstName)) ||
      (lastName && !SAFE_NAME.test(lastName)) ||
      (phone && !PHONE.test(phone))
    )
      return null;
    const completeness = profileCompleteness({ firstName, lastName, email });
    if (completeness !== value.profile.completeness) return null;
    profile = {
      firstName,
      lastName,
      displayName: clean(value.profile.displayName, 101),
      email,
      ...(phone ? { phone } : {}),
      marketingPreference: value.profile.marketingPreference,
      shoppingPreference: value.profile.shoppingPreference,
      createdAt: value.profile.createdAt,
      updatedAt: value.profile.updatedAt,
      completeness,
    };
  }
  const addresses: SimulatedAddress[] = [];
  for (const raw of value.addresses) {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      !raw.id.startsWith("sim-address-") ||
      !isTimestamp(raw.createdAt) ||
      !isTimestamp(raw.updatedAt)
    )
      return null;
    const checked = validateAddress(
      {
        label:
          raw.label === "Home" || raw.label === "Work" || raw.label === "Other"
            ? raw.label
            : "Home",
        recipientName: String(raw.recipientName ?? ""),
        phone: String(raw.phone ?? ""),
        addressLine1: String(raw.addressLine1 ?? ""),
        addressLine2:
          typeof raw.addressLine2 === "string" ? raw.addressLine2 : undefined,
        landmark: typeof raw.landmark === "string" ? raw.landmark : undefined,
        city: String(raw.city ?? ""),
        state: String(raw.state ?? ""),
        postalCode: String(raw.postalCode ?? ""),
        country: String(raw.country ?? ""),
        deliveryInstructions:
          typeof raw.deliveryInstructions === "string"
            ? raw.deliveryInstructions
            : undefined,
        isDefault: raw.isDefault === true,
      },
      raw.id,
      raw.updatedAt,
      raw.createdAt,
    );
    if (!checked.valid || !checked.value || raw.label !== checked.value.label)
      return null;
    addresses.push(checked.value);
  }
  if (addresses.filter((item) => item.isDefault).length > 1) return null;
  const checkout: CheckoutSelections = {
    acknowledged: checkoutValue.acknowledged === true,
  };
  if (checkoutValue.addressId !== undefined) {
    if (
      typeof checkoutValue.addressId !== "string" ||
      !addresses.some((item) => item.id === checkoutValue.addressId)
    )
      return null;
    checkout.addressId = checkoutValue.addressId;
  }
  if (checkoutValue.deliveryOption !== undefined) {
    if (
      checkoutValue.deliveryOption !== "standard" &&
      checkoutValue.deliveryOption !== "priority"
    )
      return null;
    checkout.deliveryOption = checkoutValue.deliveryOption;
  }
  if (checkoutValue.paymentPreview !== undefined) {
    if (
      checkoutValue.paymentPreview !== "upi-preview" &&
      checkoutValue.paymentPreview !== "card-preview"
    )
      return null;
    checkout.paymentPreview = checkoutValue.paymentPreview;
  }
  return {
    version: CUSTOMER_ACCOUNT_SCHEMA_VERSION,
    session:
      sessionValue === null
        ? null
        : {
            status:
              sessionValue.status === "guest" ? "guest" : "simulated-signed-in",
            customerId: String(sessionValue.customerId),
            issuedAt: String(sessionValue.issuedAt),
          },
    profile,
    addresses,
    checkout,
  };
}
