export type ScaffoldStatus = "isolated" | "not-production";

export interface ScaffoldDescriptor {
  readonly status: ScaffoldStatus;
  readonly phase: "3A";
  readonly runtimeDependencies: readonly ["next", "react", "react-dom"];
}

