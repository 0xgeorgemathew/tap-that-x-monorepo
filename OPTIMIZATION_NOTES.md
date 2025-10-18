# Build Optimization Notes

## Completed Optimizations (Oct 2025)

### 1. Fixed Stale Configuration
- **File:** `packages/nextjs/next.config.ts`
- **Change:** Removed deleted `/blockexplorer` route reference
- **Impact:** Cleaner output file tracing

### 2. Added .dockerignore
- **Impact:** Reduces build context size by ~1.8GB
- **Excludes:**
  - Foundry workspace (not needed for deployment)
  - Build artifacts (.next/cache)
  - Development dependencies
  - Git and IDE files

### 3. Optimized Yarn Install
- **File:** `railpack.json`
- **Change:** `yarn workspaces focus @se-2/nextjs --production=false`
- **Impact:** Only installs nextjs workspace dependencies
- **Estimated savings:** 20-30% faster install

---

## Additional Optimization Opportunities

### Immediate (High Impact)

1. **Dependency Audit**
   - Current: 52,020 TypeScript files in node_modules
   - Action: Review unused dependencies in `packages/nextjs/package.json`
   - Candidates to check:
     - `burner-connector` (if not actively used)
     - Dev dependencies that might be in `dependencies`
   - Tool: `npx depcheck`

2. **Output Optimization**
   - Enable Next.js standalone output mode
   - Add to `next.config.ts`: `output: "standalone"`
   - Impact: Smaller deployment bundle

### Medium Impact

3. **Build Cache Persistence**
   - Use Railway build cache volumes
   - Cache `.next/cache` between builds
   - Requires Railway config update

4. **Parallel Builds** (if multiple packages)
   - Use turbo or nx for better caching
   - Currently: serial workspace builds

### Low Priority

5. **Image Optimization**
   - Review image assets in public/
   - Use WebP format
   - Implement lazy loading

6. **Bundle Analysis**
   - Run: `yarn workspace @se-2/nextjs build -- --analyze`
   - Identify large dependencies
   - Consider code splitting

---

## Current Build Metrics

- **Build time:** ~5 minutes (309.85s)
- **Target:** 2-3 minutes
- **Breakdown:**
  - Install: 58s
  - Build: 82s
  - Copy: 78s
  - Docker import: 33s

### Expected After These Changes
- **Install:** ~30-40s (workspace focus + .dockerignore)
- **Build:** 70-80s (cleaner config)
- **Copy:** 20-30s (.dockerignore reduction)
- **Total:** ~2-3 minutes ✓

---

## Commands for Further Analysis

```bash
# Dependency analysis
npx depcheck

# Bundle size analysis
cd packages/nextjs
ANALYZE=true yarn build

# Find large files
find packages/nextjs/node_modules -type f -size +1M

# Check workspace dependencies
yarn workspaces list --json
```

## Notes

- Avoid removing scaffold-eth utilities without testing
- Keep production vs dev dependencies separate
- Test builds locally before Railway deployment
