export type CommerceAudience = "public" | "customer" | "dealer";

export function commercePath(
  audience: CommerceAudience,
  resource: string,
): string {
  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(resource) || resource.includes("..")) {
    throw new Error("Invalid commerce resource path.");
  }
  return `/commerce/v1/${audience}/${resource}`;
}

