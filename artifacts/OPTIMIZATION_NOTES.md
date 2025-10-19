# Build Optimization Notes

## Completed Optimizations (Oct 2025)

### 1. Fixed Stale Configuration
- **File:** `packages/nextjs/next.config.ts`
- **Change:** Removed deleted `/blockexplorer` route reference
- **Impact:** Cleaner output file tracing

### 2. Added .dockerignore ✅ ACTIVE (Fixed)
- **Impact:** Reduces build context size by ~1.8GB
- **Excludes:**
  - Heavy foundry directories: `node_modules` (66MB), `out` (2.8MB), `cache`, `lib`, `broadcast`
  - Build artifacts (.next/cache)
  - Development dependencies
  - Git and IDE files
- **Keeps:** Foundry package.json + source (~17MB) for workspace resolution
- **Result:** Major reduction in copy time (78s → ~30s estimated)
- **Fix Applied:** Initially excluded entire `packages/foundry`, broke workspace lockfile validation
  - Error: `YN0028: The lockfile would have been modified by this install`
  - Root cause: Missing workspace breaks Yarn resolution
  - Solution: Surgical exclusion of heavy dirs only

### 3. ~~Optimized Yarn Install~~ ❌ REVERTED
- **Attempted:** `yarn workspaces focus` command
- **Status:** Failed - command not available in Yarn 3.2.3
- **Lesson:** Requires `@yarnpkg/plugin-workspace-tools` plugin
- **Decision:** Reverted to `yarn install --immutable` (proven stable)

---

## Lessons Learned: Production Safety

### What Went Wrong (Twice!)

#### Mistake #1: yarn workspaces focus
1. **Assumed command availability** without verifying Yarn 3.2.3 capabilities
2. **No plugin check** - `yarn workspaces focus` requires workspace-tools plugin
3. **Production testing** - broke deployment without staging test
4. **Optimization greed** - pursued 10s savings with risky change

#### Mistake #2: Overzealous .dockerignore
1. **Excluded entire workspace** - `packages/foundry` removal broke Yarn resolution
2. **Didn't understand Yarn workspaces** - all workspaces in package.json must exist
3. **Lockfile validation failed** - `YN0028: The lockfile would have been modified`
4. **Root cause:** Missing workspace changes dependency tree → lockfile mismatch

### Production Change Checklist
Before modifying production configs:
- [ ] Verify exact command/feature exists in deployed version
- [ ] Check required plugins in `.yarnrc.yml`
- [ ] **Understand workspace dependencies** - all declared workspaces must exist
- [ ] **Test lockfile validation** - `yarn install --immutable` must pass
- [ ] Test changes in isolated environment first
- [ ] Measure actual impact vs risk
- [ ] Have instant rollback ready
- [ ] **Prefer simple, proven solutions over clever ones**

### The 90/10 Rule
- `.dockerignore` (surgical) = 90% of the win (medium risk, now fixed)
- Workspace filtering = 10% additional gain (high risk, abandoned)
- **Ship the 90% first, iterate carefully on the 10%**

### Key Insight: Monorepo Gotchas
- **Yarn workspaces require ALL packages** declared in package.json to exist
- **Lockfile is workspace-aware** - changing workspace structure invalidates it
- **Solution:** Exclude heavy subdirectories, not entire workspace packages

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
