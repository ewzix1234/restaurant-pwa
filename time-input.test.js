const test = require('node:test');
const assert = require('node:assert');
const { parseDigits, digitsToStorage, storageToDisplay, formatLiveDisplay } = require('./time-input.js');

test('parseDigits ne garde que les chiffres, max 4', () => {
  assert.strictEqual(parseDigits('11h30'), '1130');
  assert.strictEqual(parseDigits('abc9'), '9');
  assert.strictEqual(parseDigits('113055'), '1130');
  assert.strictEqual(parseDigits(''), '');
});

test('digitsToStorage gère les frappes complètes et partielles', () => {
  assert.strictEqual(digitsToStorage('1130'), '11:30');
  assert.strictEqual(digitsToStorage('1830'), '18:30');
  assert.strictEqual(digitsToStorage('2300'), '23:00');
  assert.strictEqual(digitsToStorage('9'), '09:00');
  assert.strictEqual(digitsToStorage('11'), '11:00');
  assert.strictEqual(digitsToStorage('930'), '09:30');
  assert.strictEqual(digitsToStorage('600'), '06:00');
  assert.strictEqual(digitsToStorage(''), '');
});

test('digitsToStorage arrondit les minutes au multiple de 5', () => {
  assert.strictEqual(digitsToStorage('1132'), '11:30');
  assert.strictEqual(digitsToStorage('1133'), '11:35');
});

test('digitsToStorage rejette les valeurs hors plage', () => {
  assert.strictEqual(digitsToStorage('0500'), '');  // heure < 6
  assert.strictEqual(digitsToStorage('2500'), '');  // heure > 23
  assert.strictEqual(digitsToStorage('1175'), '');  // minute > 59
});

test('storageToDisplay formate pour affichage', () => {
  assert.strictEqual(storageToDisplay('11:30'), '11h30');
  assert.strictEqual(storageToDisplay('09:00'), '09h00');
  assert.strictEqual(storageToDisplay(''), '');
});

test('formatLiveDisplay insère le h seulement avec des minutes', () => {
  assert.strictEqual(formatLiveDisplay('1'), '1');
  assert.strictEqual(formatLiveDisplay('11'), '11');
  assert.strictEqual(formatLiveDisplay('113'), '11h3');
  assert.strictEqual(formatLiveDisplay('1130'), '11h30');
  assert.strictEqual(formatLiveDisplay('11h30'), '11h30');
});
