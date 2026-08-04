"use client";

import { Icon } from "@/components/icons";
import { MAX_SIMULATED_QUANTITY } from "./types";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";

export function QuantityControl({
  itemKey,
  name,
  quantity,
}: {
  itemKey: string;
  name: string;
  quantity: number;
}) {
  const { setQuantity } = useCustomerIntent();
  return (
    <div
      aria-label={`${name} quantity`}
      className={styles.quantity}
      role="group"
    >
      <button
        aria-label={`Decrease ${name} quantity`}
        onClick={() => setQuantity(itemKey, quantity - 1)}
        type="button"
      >
        <Icon name="minus" />
      </button>
      <label>
        <span className={styles.visuallyHidden}>{name} quantity</span>
        <input
          aria-label={`${name} quantity`}
          inputMode="numeric"
          max={MAX_SIMULATED_QUANTITY}
          min="1"
          onChange={(event) => setQuantity(itemKey, Number(event.target.value))}
          type="number"
          value={quantity}
        />
      </label>
      <button
        aria-label={`Increase ${name} quantity`}
        disabled={quantity >= MAX_SIMULATED_QUANTITY}
        onClick={() => setQuantity(itemKey, quantity + 1)}
        type="button"
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
