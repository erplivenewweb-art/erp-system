const publicEnvironmentAllowlist = ["NEXT_PUBLIC_STOREFRONT_MODE"] as const;

type PublicEnvironmentName = (typeof publicEnvironmentAllowlist)[number];

export function readPublicEnvironment(
  name: PublicEnvironmentName,
): string | undefined {
  return process.env[name];
}

export function validatePublicEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  return Object.keys(environment).filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") &&
      !publicEnvironmentAllowlist.includes(key as PublicEnvironmentName),
  );
}

export { publicEnvironmentAllowlist };

