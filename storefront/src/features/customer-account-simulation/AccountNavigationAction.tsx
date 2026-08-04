"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { useCustomerAccount } from "./CustomerAccountProvider";
import styles from "./CustomerAccount.module.css";

export function AccountNavigationAction({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const { session, profile } = useCustomerAccount();
  const pathname = usePathname();
  const label =
    session?.status === "guest"
      ? "Guest account"
      : profile?.firstName
        ? `${profile.firstName} account`
        : "Account";
  if (mobile)
    return (
      <>
        <Link
          aria-current={pathname === "/account" ? "page" : undefined}
          href="/account"
          onClick={onNavigate}
        >
          <Icon name="account" />
          {label}
        </Link>
        <Link
          aria-current={pathname === "/account/profile" ? "page" : undefined}
          href="/account/profile"
          onClick={onNavigate}
        >
          Profile
        </Link>
        <Link
          aria-current={pathname === "/account/addresses" ? "page" : undefined}
          href="/account/addresses"
          onClick={onNavigate}
        >
          Addresses
        </Link>
      </>
    );
  return (
    <Link
      aria-label={label}
      aria-current={pathname?.startsWith("/account") ? "page" : undefined}
      className={styles.navigationAccount}
      href="/account"
    >
      <Icon name="account" />
      <span>{label}</span>
    </Link>
  );
}
