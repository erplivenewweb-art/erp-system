import styles from "@/features/cart/CommerceFlow.module.css";
const steps = ["Cart", "Address", "Payment", "Review", "Confirmation"];
export function CheckoutStepper({ current = "Address" }: { current?: (typeof steps)[number] }) { const active = steps.indexOf(current); return <nav aria-label="Checkout progress"><ol className={styles.stepper}>{steps.map((step, index) => <li aria-current={step === current ? "step" : undefined} className={`${styles.step} ${index <= active ? styles.stepActive : ""}`} key={step}>{step}</li>)}</ol></nav>; }
