import { generateCase, pickTheme } from './caseGenerator.js';
import { validateCase } from './caseValidator.js';
import { detectiveCheck } from './detectiveCheck.js';

export class CaseEngineError extends Error {
  constructor(message, log) {
    super(message);
    this.name = 'CaseEngineError';
    this.log = log;
  }
}

/**
 * Create a checked, playable case.
 * Returns { caseData, meta, validation: { attempts, log, detective, warnings } }.
 */
export async function createCase({ maxAttempts = 3, onProgress = () => {} } = {}) {
  const theme = pickTheme();
  const log = [];
  let feedback = [];
  let previousCase = null;
  let bestSoftPass = null; // passed code checks, but the detective was not satisfied

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress(attempt === 1 ? 'The AI is writing your mystery...' : `Revising the mystery (attempt ${attempt})...`);

    let generated;
    try {
      generated = await generateCase({ theme, feedback, previousCase });
    } catch (err) {
      log.push({ attempt, stage: 'generate', error: err.message, issues: err.issues });
      feedback = err.issues ?? [`The previous output was unusable: ${err.message}`];
      continue; // keep previousCase as it was
    }

    const { caseData } = generated;
    previousCase = caseData;

    onProgress('Checking the logic...');
    const code = validateCase(caseData);
    if (!code.ok) {
      log.push({ attempt, stage: 'code', errors: code.errors, provider: generated.meta.provider });
      feedback = code.errors;
      continue;
    }

    onProgress('A detective is testing the clues...');
    let detective;
    try {
      detective = await detectiveCheck(caseData);
    } catch (err) {
      log.push({ attempt, stage: 'detective', error: `Detective unavailable: ${err.message}` });
      return { ...generated, validation: { attempts: attempt, log, detective: null, warnings: ['Detective check skipped (AI unavailable).'] } };
    }

    if (detective.ok) {
      log.push({ attempt, stage: 'passed', provider: generated.meta.provider });
      return { ...generated, validation: { attempts: attempt, log, detective: detective.verdict, warnings: [] } };
    }

    log.push({ attempt, stage: 'detective', errors: detective.errors });
    bestSoftPass = { generated, detective };
    feedback = detective.errors;
  }

  if (bestSoftPass) {
    const { generated, detective } = bestSoftPass;
    return {
      ...generated,
      validation: { attempts: maxAttempts, log, detective: detective.verdict, warnings: detective.errors },
    };
  }

  throw new CaseEngineError(`Could not create a valid case after ${maxAttempts} attempts.`, log);
}
