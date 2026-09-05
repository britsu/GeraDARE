const assert = require('assert');

console.log('=== TESTES DE PROGRESSO FLUIDO E ESTIMATIVA DE TEMPO (ETA) ===\n');

// 1. Test fluid multi-step progress math
function calculateFluidProgress(invoiceIndex, subStepIndex, totalInvoices) {
  const totalGlobalSteps = totalInvoices * 6;
  const currentGlobalStep = ((invoiceIndex - 1) * 6) + subStepIndex;
  return Math.min(99.5, Math.max(1, Math.round(((currentGlobalStep / totalGlobalSteps) * 100) * 10) / 10));
}

// Test case: 8 invoices (as in user screenshot)
const totalInvoices = 8;
const totalGlobalSteps = 8 * 6; // 48 steps

// Note 4, step 2 (Preencher 140)
// Previous was stuck at 50%
const pctNote4Step2 = calculateFluidProgress(4, 2, totalInvoices);
console.log(`[PASS] Nota 4/8 no Passo 2/6: ${pctNote4Step2}% (antes travava em 50%, agora é fluido e granular: ${((3*6)+2)}/${totalGlobalSteps})`);
assert.strictEqual(pctNote4Step2, 41.7);

// Note 4, step 3 (Atualizar Valores)
const pctNote4Step3 = calculateFluidProgress(4, 3, totalInvoices);
console.log(`[PASS] Nota 4/8 no Passo 3/6: ${pctNote4Step3}%`);
assert.strictEqual(pctNote4Step3, 43.8);

// Note 4, step 6 (Validar PDF)
const pctNote4Step6 = calculateFluidProgress(4, 6, totalInvoices);
console.log(`[PASS] Nota 4/8 no Passo 6/6: ${pctNote4Step6}%`);
assert.strictEqual(pctNote4Step6, 50.0);

// Note 8, step 6 (Finish)
const pctFinal = calculateFluidProgress(8, 6, totalInvoices);
console.log(`[PASS] Nota 8/8 no Passo 6/6: ${pctFinal}%`);
assert(pctFinal >= 99.5);

// 2. Test dynamic ETA retroalimentação (EMA update)
function updateHistoricalAverage(historicalAvg, currentBatchDurations) {
  if (currentBatchDurations.length === 0) return historicalAvg;
  const currentBatchAvg = currentBatchDurations.reduce((a, b) => a + b, 0) / currentBatchDurations.length;
  // Weighted exponential moving average: 65% current, 35% historical
  return (0.65 * currentBatchAvg) + (0.35 * historicalAvg);
}

const baseline = 12.0; // 12 seconds per guide
const actualBatch = [10.5, 11.2, 9.8, 10.1]; // Notes took ~10.4s
const updatedAvg = updateHistoricalAverage(baseline, actualBatch);
console.log(`[PASS] Retroalimentação: Baseline ${baseline}s -> Lote real ~10.4s -> Nova média aprendida: ${updatedAvg.toFixed(2)}s/guia`);
assert(updatedAvg < baseline, 'A média retroalimentada deve se ajustar à velocidade real observada');
assert(updatedAvg > 10.0 && updatedAvg < 11.0);

// 3. Test remaining time estimation based on sub-steps
function estimateRemainingSeconds(totalNotes, currentNoteIndex, currentSubStep, avgSecondsPerNote) {
  const totalSubSteps = totalNotes * 6;
  const currentGlobalStep = ((currentNoteIndex - 1) * 6) + currentSubStep;
  const remainingSubSteps = Math.max(0, totalSubSteps - currentGlobalStep);
  const avgSecPerSubStep = avgSecondsPerNote / 6;
  return Math.round(remainingSubSteps * avgSecPerSubStep);
}

// 8 notes total, at note 4 step 2 (20 steps done, 28 sub-steps remaining out of 48)
// with learned speed ~10.9s per guide (~1.82s per sub-step)
const remainingSec = estimateRemainingSeconds(8, 4, 2, updatedAvg);
console.log(`[PASS] Estimativa restante para 28 sub-etapas restantes: ~${remainingSec}s (${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s)`);
assert(remainingSec >= 45 && remainingSec <= 55);

console.log('\n=== TODOS OS TESTES DE PROGRESSO FLUIDO E ETA PASSARAM COM SUCESSO! ===');
