// Runs automatically before every build (npm "prebuild"), and on demand with
// "npm run check". It stops the build with a plain message when:
//   - a source file is empty (a blank upload),
//   - an import points to a file that does not exist,
//   - an import asks for a name the other file does not export,
//   - an import uses a package that is not listed in package.json.
// If this checker itself ever breaks, it prints a warning and lets the build
// continue, so it can never block a deploy by mistake.
// To skip it once: set SKIP_FILE_CHECK=1 in Vercel.
import fs from 'fs'
import path from 'path'
import { builtinModules } from 'module'

if (process.env.SKIP_FILE_CHECK === '1') {
  console.log('File check skipped (SKIP_FILE_CHECK=1).')
  process.exit(0)
}

const root = process.cwd()
const problems = []
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => 'node:' + m)])
const CODE = /\.(js|jsx|mjs)$/

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const rel = (f) => path.relative(root, f).split(path.sep).join('/')

function run() {
  let pkg = {}
  try { pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) } catch (e) { problems.push('package.json is missing or is not valid JSON.') }
  const deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})])

  const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'api')), ...walk(path.join(root, 'public'))]
  for (const f of ['index.html', 'package.json', 'vite.config.js', 'vercel.json']) {
    const full = path.join(root, f)
    if (fs.existsSync(full)) files.push(full)
  }

  // 1. Empty files
  for (const f of files) {
    if (path.basename(f) === '.gitkeep') continue
    const size = fs.statSync(f).size
    if (size === 0 || (/\.(js|jsx|mjs|css|html|json)$/.test(f) && fs.readFileSync(f, 'utf8').trim() === '')) {
      problems.push(`${rel(f)} is EMPTY. Upload the file again (an empty file usually means the upload did not finish).`)
    }
  }

  // 2. Imports
  const exportsOf = (file) => {
    const src = fs.readFileSync(file, 'utf8')
    if (/export\s*\*\s*from/.test(src)) return null // cannot list names, skip the name check
    const names = new Set()
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)/g)) names.add(m[1])
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
      m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.add(s.split(/\s+as\s+/).pop().trim()))
    }
    if (/export\s+default\b/.test(src)) names.add('default')
    return names
  }
  const resolveRel = (fromFile, spec) => {
    const base = path.resolve(path.dirname(fromFile), spec)
    const tries = [base, base + '.js', base + '.jsx', base + '.mjs', base + '.json', path.join(base, 'index.js'), path.join(base, 'index.jsx')]
    return tries.find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) || null
  }

  let checked = 0
  for (const f of files.filter((x) => CODE.test(x) && !x.includes(path.sep + 'public' + path.sep))) {
    const src = fs.readFileSync(f, 'utf8')
    checked++
    const re = /(?:^|\n)\s*import\s+(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]/g
    for (const m of src.matchAll(re)) {
      const clause = (m[1] || '').trim()
      const spec = m[2]
      if (spec.startsWith('.')) {
        const target = resolveRel(f, spec)
        if (!target) { problems.push(`${rel(f)} imports "${spec}" but that file does not exist.`); continue }
        if (!clause || !CODE.test(target)) continue
        const have = exportsOf(target)
        if (!have) continue
        const wanted = []
        const def = /^([\w$]+)\s*(?:,|$)/.exec(clause)
        if (def) wanted.push('default')
        const named = /\{([^}]*)\}/.exec(clause)
        if (named) named[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => wanted.push(s.split(/\s+as\s+/)[0].trim()))
        for (const w of wanted) {
          if (!have.has(w)) problems.push(`${rel(f)} imports "${w}" from "${spec}", but ${rel(target)} does not export it (the file may be empty, old, or missing this update).`)
        }
      } else if (!BUILTINS.has(spec)) {
        const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
        if (deps.size && !deps.has(pkgName)) problems.push(`${rel(f)} imports the package "${pkgName}", which is not listed in package.json.`)
      }
    }
  }
  return checked
}

try {
  const checked = run()
  if (problems.length) {
    console.error('\nRADIUS file check FAILED. Fix these before deploying:\n')
    problems.forEach((p) => console.error('  - ' + p))
    console.error('')
    process.exit(1)
  }
  console.log(`RADIUS file check passed (${checked} code files).`)
} catch (e) {
  console.warn('RADIUS file check could not run (' + (e && e.message) + '). Continuing with the build.')
}
