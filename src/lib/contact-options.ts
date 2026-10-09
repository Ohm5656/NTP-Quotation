import { customerProfileIdentityKey } from "./customer-profile-links";

export type ContactOption = {
  name: string;
  email: string;
  customerName: string;
  updatedAt?: string;
};

export function normalizeContactName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("th");
}

export function findContactEmail(
  contacts: ContactOption[],
  name: string,
  customerName: string,
): string | undefined {
  const matches = contacts.filter((contact) =>
    normalizeContactName(contact.name) === normalizeContactName(name)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email),
  );
  const customerKey = customerProfileIdentityKey(customerName);
  const sameCustomer = customerKey
    ? matches.filter((contact) => customerProfileIdentityKey(contact.customerName) === customerKey)
    : [];
  // The query supplies newest saved pairs first. A person's last saved email
  // is the default; the user can edit it on the form afterwards.
  if (sameCustomer.length) return sameCustomer[0].email;
  const emails = [...new Set(matches.map((contact) => contact.email.toLowerCase()))];
  return emails.length === 1 ? matches[0].email : undefined;
}
