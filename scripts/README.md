# scripts

## `verify-account-deletion.sql`

The only check that genuinely exercises the account-teardown path, including the
last-fuel-category trigger bypass. It seeds a throwaway user across all seven
owned tables, calls `public.delete_own_account_data()`, asserts every table is
empty, and then rolls back — so it is safe to run and leaves nothing behind.

```bash
psql -f scripts/verify-account-deletion.sql   # needs a privileged connection
```

Deliberately not part of `bun run test`: it needs database credentials, and a
check that silently no-ops in CI is worse than no check at all. Run it by hand
whenever the teardown SQL changes.

Note: `tests/account-teardown-contract.test.ts` is a *structural* guard only —
it proves the two SQL halves still reference the same flag, not that deletion
works. Only the script above proves that.
