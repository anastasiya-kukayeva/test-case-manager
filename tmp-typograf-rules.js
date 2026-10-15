import Typograf from 'typograf';

const samples = [
  'Привет мир',
  'ghbdtn',
  'hello',
  'тест test',
  '!= == <= >= => ->',
  'не равно != x',
  'шаг — описание',
  'шаг - описание',
  'шаг-описание',
  'foo--bar',
  '1. шаг',
  'Текст "в кавычках"',
  'https://example.com/a b',
  'user@mail.ru',
  'C:\\temp\\file',
  'a.b.c',
  '(см. пункт)',
  '№ 12',
  '10%',
  'п. 1',
  'т.е. пример',
  'и т.д.',
  'в т.ч.',
];

function run(label, setup) {
  const t = new Typograf({ locale: ['ru', 'en-US'] });
  t.disableRule('common/number/times');
  t.disableRule('common/number/mathSigns');
  setup(t);
  console.log('\n== ' + label);
  for (const s of samples) {
    const n = t.execute(s);
    if (n !== s) console.log(JSON.stringify(s) + ' => ' + JSON.stringify(n));
  }
}

run('current', () => {});
run('no afterExclamation', (t) => t.disableRule('common/space/afterExclamationMark'));
run('no delBeforePunct', (t) => t.disableRule('common/space/delBeforePunctuation'));
run('no both punct', (t) => {
  t.disableRule('common/space/afterExclamationMark');
  t.disableRule('common/space/delBeforePunctuation');
});
run('no keyboard', (t) => t.disableRule('ru/typo/switchingKeyboardLayout'));
run('no trim', (t) => {
  t.disableRule('common/space/trimLeft');
  t.disableRule('common/space/trimRight');
  t.disableRule('common/space/delTrailingBlanks');
});
