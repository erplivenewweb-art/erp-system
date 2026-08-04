export { AccountNavigationAction } from "./AccountNavigationAction";
export { SimulationAccountDashboard } from "./AccountDashboard";
export { SimulationAddressBookPage } from "./AddressBookExperience";
export {
  CustomerAccountProvider,
  useCustomerAccount,
} from "./CustomerAccountProvider";
export { SimulationCheckoutPage } from "./CheckoutPreview";
export { SimulationProfilePage } from "./ProfileExperience";
export { AccountSimulationNotice } from "./SimulationNotice";
export { SimulatedSignInPage } from "./SignInExperience";
export {
  addAddress,
  addressesEqual,
  checkoutReadiness,
  createGuestSession,
  createSignedInSession,
  deleteAddress,
  localCustomerId,
  normalizeEmail,
  normalizePhone,
  parsePersistedCustomerAccount,
  profileCompleteness,
  setDefaultAddress,
  updateAddress,
  validateAddress,
  validateProfile,
  validateSignInEmail,
} from "./domain";
export {
  clearPersistedCustomerAccount,
  persistCustomerAccount,
  restoreCustomerAccount,
} from "./persistence";
export {
  CUSTOMER_ACCOUNT_SCHEMA_VERSION,
  CUSTOMER_ACCOUNT_STORAGE_KEY,
  FIXTURE_CREATED_AT,
  MAX_SIMULATED_ADDRESSES,
} from "./types";
export type {
  AddressInput,
  CheckoutReadiness,
  CheckoutReadinessStatus,
  CheckoutSelections,
  CustomerProfile,
  CustomerSessionStatus,
  PersistedCustomerAccount,
  ProfileInput,
  SimulatedAddress,
  SimulatedCustomerSession,
} from "./types";
