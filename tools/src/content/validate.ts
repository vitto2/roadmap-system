import { checkSeedIntegrity, checkTrackSizes, defaultSeedDir, readSeedContent } from './files'

const dir = process.argv[2] ?? defaultSeedDir
const content = readSeedContent(dir)
const problems = [...checkTrackSizes(content), ...checkSeedIntegrity(content)]

for (const [track, topics] of content.topics) console.log(`${track}: ${topics.length} tópicos`)
console.log(`projetos: ${content.projects.length}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problema(s):`)
  for (const p of problems) console.error(` - ${p}`)
  process.exit(1)
}
console.log('Seed OK')
