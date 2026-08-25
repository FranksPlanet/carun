/**
 * ACCOUNT TEARDOWN CONTRACT -- STRUCTURAL GUARD ONLY.
 *
 * WHAT THIS PROVES:
 *   The two halves of the teardown contract still reference each other in SQL.
 *   `public.delete_own_account_data()` sets a transaction-local setting, and
 *   `public.tg_protect_last_fuel_category()` reads that *same* setting name and
 *   skips the last-fuel-category guard when it is on. Rename the setting on one
 *   side only, or drop either half, and this test fails.
 *
 * WHAT THIS DOES **NOT** PROVE:
 *   That account deletion actually works. Nothing here connects to a database,
 *   runs the function, fires the trigger, or deletes a single row. A green tick
 *   here is NOT evidence that the deletion path is tested. The only check that
 *   genuinely exercises it is `scripts/verify-account-deletion.sql`, which must
 *   be run by hand against a privileged connection.
 *
 * It reads the newest migration that (re)defines each function, so a later
 * migration superseding these definitions is what gets checked. If it cannot
 * work out which definition is in effect, it fails loudly rather than passing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Migration files in application order (timestamp-prefixed filenames sort correctly). */
function migrationFiles(): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(`No migration files found in ${MIGRATIONS_DIR} -- cannot verify the teardown contract.`);
  }
  return files;
}

/**
 * Body of the *last* definition of `public.<name>()` across all migrations, i.e.
 * the definition actually in effect. Throws with a specific message when the
 * function is missing or its dollar-quoted body cannot be delimited.
 */
function latestFunctionBody(name: string): { file: string; body: string } {
  const declRe = new RegExp(
    String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?${name}\s*\(`,
    "gi",
  );

  let found: { file: string; body: string } | null = null;

  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    declRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    let lastIndex = -1;
    while ((m = declRe.exec(sql)) !== null) lastIndex = m.index;
    if (lastIndex === -1) continue;

    const rest = sql.slice(lastIndex);
    const open = rest.match(/\$([A-Za-z_]*)\$/);
    if (!open) {
      throw new Error(
        `Found a definition of public.${name}() in ${file} but could not locate its dollar-quoted body. ` +
          `The teardown contract test can no longer tell what is in effect -- fix the test.`,
      );
    }
    const tag = open[0];
    const bodyStart = (open.index ?? 0) + tag.length;
    const bodyEnd = rest.indexOf(tag, bodyStart);
    if (bodyEnd === -1) {
      throw new Error(
        `Unterminated ${tag} body for public.${name}() in ${file} -- cannot verify the teardown contract.`,
      );
    }
    found = { file, body: rest.slice(bodyStart, bodyEnd) };
  }

  if (!found) {
    throw new Error(
      `No migration defines public.${name}(). Either it was removed or renamed; ` +
        `the account teardown contract can no longer be verified.`,
    );
  }
  return found;
}

describe("account teardown contract is structurally intact", () => {
  it("keeps both halves of the contract present and agreeing on one setting name", () => {
    const teardown = latestFunctionBody("delete_own_account_data");
    const trigger = latestFunctionBody("tg_protect_last_fuel_category");

    // --- Half 1: the teardown sets a transaction-local flag. -----------------
    // set_config(<name>, <value>, true) -- the third argument MUST be true so
    // the flag cannot leak out of the teardown transaction.
    const setConfig = teardown.body.match(
      /set_config\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*(true|false)\s*\)/i,
    );
    expect(
      setConfig,
      `public.delete_own_account_data() (${teardown.file}) no longer calls set_config(...). ` +
        `Without it the last-fuel-category guard will fire and the teardown will fail part-way.`,
    ).not.toBeNull();

    const settingName = setConfig![1];
    const settingValue = setConfig![2];
    const isLocal = setConfig![3].toLowerCase();

    expect(
      isLocal,
      `set_config('${settingName}', ...) in ${teardown.file} must pass is_local => true, ` +
        `otherwise the teardown bypass leaks into ordinary editing sessions.`,
    ).toBe("true");

    // --- Half 2: the trigger reads that same flag and bails out. -------------
    const currentSetting = trigger.body.match(
      /current_setting\(\s*'([^']+)'\s*,\s*(true|false)\s*\)/i,
    );
    expect(
      currentSetting,
      `public.tg_protect_last_fuel_category() (${trigger.file}) no longer reads a setting via ` +
        `current_setting(...). It will therefore block the account teardown.`,
    ).not.toBeNull();

    // --- The two halves must name the SAME setting. --------------------------
    expect(
      currentSetting![1],
      `Setting name mismatch: public.delete_own_account_data() sets '${settingName}' ` +
        `(${teardown.file}) but public.tg_protect_last_fuel_category() reads ` +
        `'${currentSetting![1]}' (${trigger.file}). The teardown bypass is broken.`,
    ).toBe(settingName);

    // missing_ok => true, or the trigger throws for every normal edit.
    expect(
      currentSetting![2].toLowerCase(),
      `current_setting('${settingName}', ...) in ${trigger.file} must pass missing_ok => true, ` +
        `otherwise every ordinary category edit errors when the flag is unset.`,
    ).toBe("true");

    // The trigger must compare against the value the teardown actually writes.
    expect(
      trigger.body,
      `public.tg_protect_last_fuel_category() (${trigger.file}) does not compare the setting ` +
        `against '${settingValue}', the value written by public.delete_own_account_data().`,
    ).toContain(`'${settingValue}'`);

    // And it must return early (skip the guard) rather than merely reading the flag.
    expect(
      /IF\s+coalesce\(\s*current_setting\(/i.test(trigger.body),
      `public.tg_protect_last_fuel_category() (${trigger.file}) reads '${settingName}' but no longer ` +
        `branches on it, so the guard is not actually skipped during a teardown.`,
    ).toBe(true);
  });

  it("still deletes every owned table inside the single teardown transaction", () => {
    const { file, body } = latestFunctionBody("delete_own_account_data");
    for (const table of [
      "expenses",
      "past_repairs",
      "recurring_costs",
      "reminders",
      "categories",
      "vehicles",
      "profiles",
    ]) {
      expect(
        new RegExp(String.raw`DELETE\s+FROM\s+public\.${table}\b`, "i").test(body),
        `public.delete_own_account_data() (${file}) no longer deletes from public.${table}. ` +
          `Those rows would survive account deletion (GDPR erasure gap).`,
      ).toBe(true);
    }
    // Scoped to the caller only -- never a caller-supplied id.
    expect(body, `public.delete_own_account_data() (${file}) must derive the owner from auth.uid().`).toContain(
      "auth.uid()",
    );
  });
});
