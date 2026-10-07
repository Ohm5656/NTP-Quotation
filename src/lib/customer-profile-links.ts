export type NamedCustomerProfile = {
  name: string;
};

/**
 * Normalize harmless presentation differences only.  The quotation keeps the
 * original name the user selected; this key is solely for finding profile data.
 */
export function normalizeCustomerProfileKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("th")
    .replace(/[.(),]/g, " ")
    .replace(/\b(company|limited|ltd|co)\b/gi, " ")
    .replace(/บริษัท|บจ|บมจ/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Historical quotation files sometimes use an English trading name while the
 * customer master uses the legal Thai name.  These are reviewed, unambiguous
 * links; the displayed quotation name is never replaced by the target name.
 */
const CUSTOMER_PROFILE_ALIASES = new Map<string, string>([
  ["MAYEKAWA (THAILAND)CO.,LTD", "บริษัท มาเยคาว่า (ประเทศไทย) จำกัด"],
  ["SANDEN ENGINEERING SYSTEM (THAILAND)CO.,LTD", "ซันเด้น เอ็นจิเนียริ่ง ซิสเต็ม (ประเทศไทย) จำกัด"],
  ["Tyson Poulrty (Thailand) Limited", "บริษัท ไทสัน โพลทรี่ (ไทยแลนด์) จำกัด"],
  ["ART OF BAKING COMPANY LIMITED", "อาร์ต ออฟ เบคกิ้ง จำกัด"],
].map(([alias, profile]) => [normalizeCustomerProfileKey(alias), normalizeCustomerProfileKey(profile)]));

export function findLinkedCustomerProfile<T extends NamedCustomerProfile>(
  profiles: T[],
  customerName: string | null | undefined,
): T | undefined {
  const sourceKey = normalizeCustomerProfileKey(customerName);
  if (!sourceKey) return undefined;

  const directMatches = profiles.filter((profile) => normalizeCustomerProfileKey(profile.name) === sourceKey);
  if (directMatches.length === 1) return directMatches[0];

  const targetKey = CUSTOMER_PROFILE_ALIASES.get(sourceKey);
  if (!targetKey) return undefined;

  const aliasMatches = profiles.filter((profile) => normalizeCustomerProfileKey(profile.name) === targetKey);
  return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
}
