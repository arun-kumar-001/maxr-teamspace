import type { EmployeeDetail } from '../../employees/types';

const NOT_PROVIDED = <span className="text-text-muted font-normal">Not provided</span>;

function Item({
  label,
  children,
  mono,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1 ${wide ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
      <span className="text-xs text-text-subtle font-medium block">{label}</span>
      <div className={`text-sm font-medium text-text ${mono ? 'font-mono' : ''}`}>{children}</div>
    </div>
  );
}

function LinkList({
  values,
  kind,
}: {
  values: readonly string[] | undefined;
  kind: 'mail' | 'tel';
}) {
  if (!values || values.length === 0) return NOT_PROVIDED;
  return (
    <div className="space-y-1">
      {values.map((v) => (
        <p key={v}>
          <a
            href={`${kind === 'mail' ? 'mailto' : 'tel'}:${v}`}
            className="text-primary-ink hover:underline"
          >
            {v}
          </a>
        </p>
      ))}
    </div>
  );
}

/**
 * The rest of an employee record, below the profile cards: other contacts, identity and addresses,
 * and bank details. The API leaves out what the viewer may not read, so a group with no field at
 * all is not shown (rather than a row of "Not provided" that would say the data is missing).
 */
export function ContactAndBankDetails({ employee }: { employee: EmployeeDetail }) {
  const showIdentity = employee.panNumber !== undefined || employee.aadhaarNumber !== undefined;
  const showBank = [
    employee.bankAccountHolder,
    employee.bankName,
    employee.bankAccountNumber,
    employee.bankIfscCode,
    employee.bankBranch,
  ].some((v) => v !== undefined);

  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card space-y-6"
      aria-labelledby="contact-bank-heading"
      data-testid="contact-bank-card"
    >
      <div className="border-b border-border pb-4">
        <h2 id="contact-bank-heading" className="text-base font-semibold text-text">
          Contact, Identity &amp; Bank Details
        </h2>
        <p className="text-xs text-text-muted">
          Other contacts, addresses and the records only HR may see.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Item label="Additional Emails">
          <LinkList values={employee.additionalEmails} kind="mail" />
        </Item>
        <Item label="Additional Phones">
          <LinkList values={employee.additionalPhones} kind="tel" />
        </Item>
        <Item label="Blood Group">{employee.bloodGroup || NOT_PROVIDED}</Item>
        {showIdentity && (
          <>
            <Item label="PAN Number" mono>
              {employee.panNumber || NOT_PROVIDED}
            </Item>
            <Item label="Aadhaar Number" mono>
              {employee.aadhaarNumber || NOT_PROVIDED}
            </Item>
          </>
        )}
        <Item label="Permanent Address">
          <span className="whitespace-pre-line">{employee.permanentAddress || NOT_PROVIDED}</span>
        </Item>
        <Item label="Current Address" wide>
          <span className="whitespace-pre-line">{employee.currentAddress || NOT_PROVIDED}</span>
        </Item>
      </div>

      {showBank && (
        <div className="pt-6 border-t border-border space-y-4" data-testid="bank-details">
          <h3 className="text-sm font-semibold text-text">Bank Account Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Item label="Account Holder Name">{employee.bankAccountHolder || NOT_PROVIDED}</Item>
            <Item label="Bank Name">{employee.bankName || NOT_PROVIDED}</Item>
            <Item label="Account Number" mono>
              {employee.bankAccountNumber || NOT_PROVIDED}
            </Item>
            <Item label="IFSC Code" mono>
              {employee.bankIfscCode || NOT_PROVIDED}
            </Item>
            <Item label="Branch Name">{employee.bankBranch || NOT_PROVIDED}</Item>
          </div>
        </div>
      )}
    </section>
  );
}
