function calcDV(key43) {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  let wIndex = 0;
  for (let i = key43.length - 1; i >= 0; i--) {
    sum += parseInt(key43[i], 10) * weights[wIndex % weights.length];
    wIndex++;
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  return 11 - remainder;
}

const keys = [
  { nf: '25101', key: '21260803995515021083550020000251011000251020' },
  { nf: '25102', key: '21260803995515021083550020000251021000251035' },
  { nf: '25103', key: '21260803995515021083550020000251031000251040' },
  { nf: '25105', key: '21260803995515021083550020000251051000251061' },
  { nf: '25127', key: '21260803995515021083550020000251271000251280' },
  { nf: '25129', key: '21260803995515021083550020000251291000251306' },
  { nf: '25329', key: '21260803995515021083550020000253291000253300' },
  { nf: '25330', key: '21260803995515021083550020000253301000253319' },
  { nf: '25331', key: '21260803995515021083550020000253311000253324' },
  { nf: '25397', key: '21260803995515021083550020000253971000253989' }
];

keys.forEach(k => {
  const key43 = k.key.substring(0, 43);
  const givenDV = parseInt(k.key.substring(43), 10);
  const calculatedDV = calcDV(key43);
  console.log(`NF ${k.nf}: Informado DV=${givenDV}, Calculado DV=${calculatedDV}, Válido? ${givenDV === calculatedDV}`);
});
