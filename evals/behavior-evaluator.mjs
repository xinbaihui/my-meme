#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

const CASES_URL = new URL('./cases.json', import.meta.url)

function usage() {
  console.error(
    'Usage: node my-meme/evals/behavior-evaluator.mjs E1=<session.jsonl> [E2=<session.jsonl> ...]',
  )
}

function parseToolCalls(jsonl, filePath) {
  const calls = []
  const lines = jsonl.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line.length === 0) continue

    let event
    try {
      event = JSON.parse(line)
    } catch (error) {
      throw new Error(
        `${filePath}:${index + 1}: invalid JSON: ${error.message}`,
      )
    }

    if (event?.type !== 'tool/call') continue
    if (typeof event.data?.name !== 'string') {
      throw new Error(
        `${filePath}:${index + 1}: tool/call is missing string data.name`,
      )
    }
    if (!Number.isSafeInteger(event.seq)) {
      throw new Error(
        `${filePath}:${index + 1}: tool/call is missing integer seq`,
      )
    }

    const turn = event.data.turn
    if (!Number.isSafeInteger(turn)) {
      throw new Error(
        `${filePath}:${index + 1}: tool/call is missing integer data.turn`,
      )
    }

    calls.push({ name: event.data.name, seq: event.seq, turn })
  }

  return calls.sort((left, right) => left.seq - right.seq)
}

function evaluateRequiredTools(requiredTools, toolCalls) {
  const calledTools = new Set(toolCalls.map((call) => call.name))
  const missing = requiredTools.filter((tool) => !calledTools.has(tool))

  return missing.length === 0
    ? null
    : `missing required tool${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`
}

function evaluateForbiddenTools(forbiddenTools, toolCalls) {
  const calledTools = new Set(toolCalls.map((call) => call.name))
  const present = forbiddenTools.filter((tool) => calledTools.has(tool))

  return present.length === 0
    ? null
    : `called forbidden tool${present.length === 1 ? '' : 's'}: ${present.join(', ')}`
}

function evaluateRequiredBefore(requiredBefore, toolCalls) {
  const failures = []

  for (const constraint of requiredBefore) {
    const firstRequired = toolCalls.find(
      (call) => call.name === constraint.tool,
    )
    const firstTarget = toolCalls.find((call) =>
      constraint.before.includes(call.name),
    )

    if (!firstRequired) {
      failures.push(`${constraint.tool} was not called`)
      continue
    }
    if (!firstTarget) {
      failures.push(
        `none of the ordered target tools were called: ${constraint.before.join(', ')}`,
      )
      continue
    }
    if (firstRequired.seq >= firstTarget.seq) {
      failures.push(
        `${constraint.tool} (seq ${firstRequired.seq}) did not occur before ${firstTarget.name} (seq ${firstTarget.seq})`,
      )
    }
  }

  return failures
}

function evaluateRequiredToolsInTurn(requiredToolsInTurn, toolCalls) {
  const failures = []

  for (const constraint of requiredToolsInTurn) {
    const namesInTurn = new Set(
      toolCalls
        .filter((call) => call.turn === constraint.turn)
        .map((call) => call.name),
    )
    const missing = constraint.tools.filter((tool) => !namesInTurn.has(tool))
    if (missing.length > 0) {
      failures.push(
        `turn ${constraint.turn} missing required tool${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
      )
    }
  }

  return failures
}

function evaluateForbiddenToolsInTurn(forbiddenToolsInTurn, toolCalls) {
  const failures = []

  for (const constraint of forbiddenToolsInTurn) {
    const namesInTurn = new Set(
      toolCalls
        .filter((call) => call.turn === constraint.turn)
        .map((call) => call.name),
    )
    const present = constraint.tools.filter((tool) => namesInTurn.has(tool))
    if (present.length > 0) {
      failures.push(
        `turn ${constraint.turn} called forbidden tool${present.length === 1 ? '' : 's'}: ${present.join(', ')}`,
      )
    }
  }

  return failures
}

function evaluateCase(evalCase, toolCalls) {
  const failures = [
    evaluateRequiredTools(evalCase.requiredTools, toolCalls),
    evaluateForbiddenTools(evalCase.forbiddenTools, toolCalls),
    ...evaluateRequiredBefore(evalCase.requiredBefore ?? [], toolCalls),
    ...evaluateRequiredToolsInTurn(evalCase.requiredToolsInTurn ?? [], toolCalls),
    ...evaluateForbiddenToolsInTurn(evalCase.forbiddenToolsInTurn ?? [], toolCalls),
  ].filter(Boolean)

  if (failures.length > 0) {
    return { passed: false, reason: failures.join('; ') }
  }

  const checks = [
    `required tools present: ${evalCase.requiredTools.join(', ')}`,
    evalCase.forbiddenTools.length > 0
      ? `forbidden tools absent: ${evalCase.forbiddenTools.join(', ')}`
      : null,
    evalCase.requiredBefore?.length > 0
      ? 'required tool order satisfied'
      : null,
    evalCase.requiredToolsInTurn?.length > 0
      ? 'required per-turn tools present'
      : null,
    evalCase.forbiddenToolsInTurn?.length > 0
      ? 'forbidden per-turn tools absent'
      : null,
  ].filter(Boolean)

  return { passed: true, reason: checks.join('; ') }
}

function parseAssignments(arguments_) {
  return arguments_.map((argument) => {
    const separator = argument.indexOf('=')
    if (separator <= 0 || separator === argument.length - 1) {
      throw new Error(`invalid case assignment: ${argument}`)
    }

    return {
      caseId: argument.slice(0, separator),
      filePath: argument.slice(separator + 1),
    }
  })
}

async function main() {
  if (process.argv.length < 3) {
    usage()
    process.exitCode = 2
    return
  }

  const cases = JSON.parse(await readFile(CASES_URL, 'utf8'))
  const casesById = new Map(cases.map((evalCase) => [evalCase.id, evalCase]))
  const assignments = parseAssignments(process.argv.slice(2))
  let failed = false
  let passedCount = 0

  for (const assignment of assignments) {
    const evalCase = casesById.get(assignment.caseId)
    if (!evalCase) {
      throw new Error(`unknown eval case: ${assignment.caseId}`)
    }

    const jsonl = await readFile(assignment.filePath, 'utf8')
    const toolCalls = parseToolCalls(jsonl, assignment.filePath)
    const result = evaluateCase(evalCase, toolCalls)
    const status = result.passed ? 'PASS' : 'FAIL'

    console.log(`${evalCase.id} ${status} — ${result.reason}`)
    if (result.passed) passedCount += 1
    failed ||= !result.passed
  }

  const total = assignments.length
  const failedCount = total - passedCount
  const passRate = ((passedCount / total) * 100).toFixed(2)

  console.log('\nEval Suite Summary')
  console.log(`Total: ${total}`)
  console.log(`Passed: ${passedCount}`)
  console.log(`Failed: ${failedCount}`)
  console.log(`Pass rate: ${passRate}%`)

  process.exitCode = failed ? 1 : 0
}

try {
  await main()
} catch (error) {
  console.error(`Deterministic behavior evaluator error: ${error.message}`)
  process.exitCode = 2
}
