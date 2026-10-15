import Typograf from 'typograf';
const t = new Typograf({ locale: ['ru', 'en-US'] });
t.disableRule('common/number/times');
t.disableRule('common/number/mathSigns');
const samples = [
  ' world',
  'hello ',
  'hello world',
  'Привет мир',
  'не равно != x',
  'шаг 1',
  '1. шаг',
  '(скобки)',
  'текст, текст',
  'текст. Текст',
  '"кавычки"',
  'кавычки "внутри"',
  '№ 5',
  'тест №1',
  'foo\u00a0bar',
  'и\nзатем',
];
for (const s of samples) {
  const n = t.execute(s);
  if (n !== s) {
    console.log(JSON.stringify(s) + ' => ' + JSON.stringify(n));
  }
}
console.log('isEnabled math', t.isEnabledRule('common/number/mathSigns'));
console.log('isEnabled times', t.isEnabledRule('common/number/times'));
if (typeof t.getData === 'function') {
  console.log('data keys', Object.keys(t.getData()));
}
