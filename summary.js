// Print a summary of what tasks will be performed
function printSummary (orphanedProjects, orphanedMedia) {
  const out = []

  if (orphanedProjects.length) {
    out.push('Wistia PROJECTS attached to DELETED bundles to be REMOVED:')
    orphanedProjects.forEach((p) => out.push(`    ${p.id} ${p.name}`))
  }

  if (orphanedMedia.length) {
    if (out.length) out.push('')
    out.push('Wistia MEDIA NOT attached to ACTIVE bundles to be REMOVED:')
    orphanedMedia.forEach((m) => out.push(`    ${m.id} ${m.name}`))
  }

  console.log(out.join('\n'))
}

module.exports = printSummary
