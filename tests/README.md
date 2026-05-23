# Tests

## Golden Test Fixtures

Golden tests verify that the script generator produces structurally correct output. They compare against baseline outputs stored in `fixtures/golden/`.

### Running tests

```bash
# Run all tests
npm run test

# Run only golden tests
npx vitest run tests/script-generation.test.ts
```

### Updating golden outputs

When you intentionally change prompt behavior (new prompt version, structural changes), golden outputs need to be regenerated:

```bash
UPDATE_GOLDEN=true npm run test
```

This will overwrite all golden files with new outputs. Review the diff before committing.

### When a golden test fails

1. **Unintentional change**: Your code change broke something. Fix the regression.
2. **Intentional change**: You changed a prompt or the script structure on purpose. Update goldens with `UPDATE_GOLDEN=true` and review the diff.

### Structural comparison

Golden tests do NOT compare exact text (LLM output varies between runs). They check:

- Scene count is within ±3 of the baseline
- Required beats are present (hook, action)
- Insurance fixtures have disclaimer beats
- Every scene has narration, beat, and slidePrompt fields
- Narration is at least 10 characters

### Source fixtures

| Fixture | Industry | Purpose |
|---------|----------|---------|
| `insurance-illustration.json` | Insurance | IUL policy with projections, riders, disclaimers |
| `financial-portfolio.json` | Financial Services | Quarterly portfolio review with asset allocation |
| `real-estate-listing.json` | Real Estate | Property listing with comparables |
| `marketing-onepager.json` | Technology/SaaS | Product one-pager with pricing |
| `scraped-website.json` | Insurance (IMO) | Website scrape output for an insurance agency |
| `short-text-input.json` | Technology | Edge case: minimal input (~50 words) |

### Adding a new fixture

1. Create a source file in `fixtures/sources/` matching `ExtractedData` or `ExtractedPolicyData` interface
2. Add the fixture name to the `FIXTURES` array in `script-generation.test.ts`
3. Add params mapping in `getCallParams()` if the fixture needs special handling
4. Run `UPDATE_GOLDEN=true npm run test` to generate the golden output
5. Review the golden output and commit both files
