# Security Specification - LogisticsManager

## Data Invariants
1. A Job must have a valid `jobCode` and `customerId`.
2. A PaymentRequest must have a `lineCode` and `booking`.
3. Only Admins can modify `User` roles.
4. Users can only see data they are authorized for (Admins see all, Docs see most, Cus sees limited).

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create a job as a guest.
2. **Identity Spoofing**: Attempt to delete a job as a Docs user (if restricted).
3. **Privilege Escalation**: Attempt to change own role to 'Admin'.
4. **Shadow Update**: Attempt to update a job with an extra field `isVerified: true`.
5. **ID Poisoning**: Attempt to create a job with a 2KB junk string as the ID.
6. **Relational Breakdown**: Attempt to create a job with a non-existent `customerId`.
7. **Resource Exhaustion**: Attempt to upload a 5MB base64 string into a job field.
8. **PII Leak**: Attempt to read all users as a 'Cus' user.
9. **State Shortcut**: Attempt to change a payment status from 'completed' back to 'pending'.
10. **Orphaned Write**: Attempt to create a job without a customer.
11. **Type Mismatch**: Attempt to set 'cost' as a string "FREE".
12. **Insecure Query**: Attempt to list all jobs without any filters as a 'Cus' user (if they should only see theirs).

## Test Runner (firestore.rules.test.ts)
... (will be implemented if needed for full verification)
