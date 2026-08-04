import styles from "./CustomerAccount.module.css";

export function AccountSimulationNotice({
  persistenceStatus,
}: {
  persistenceStatus?: string;
}) {
  return (
    <div className={styles.notice} role="status">
      <strong>Development simulation only.</strong> No account, password, OTP,
      order, payment, reservation, shipment, invoice, or backend record is
      created.
      {persistenceStatus ? ` Local persistence: ${persistenceStatus}.` : ""}
    </div>
  );
}
