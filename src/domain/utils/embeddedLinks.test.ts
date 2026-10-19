import { describe, expect, it } from 'vitest';
import {
  fieldDescriptionHtml,
  normalizeEmbeddedLinkHtml,
  visibleAnchor,
} from '@/domain/utils/embeddedLinks';

describe('visibleAnchor', () => {
  it('keeps the name when the address is written inside the link', () => {
    expect(
      visibleAnchor({
        href: 'https://jira.example/browse/1',
        text: 'форма входа https://jira.example/browse/1',
      }),
    ).toEqual({ text: 'форма входа', href: 'https://jira.example/browse/1' });
  });

  it('uses the title when the link text is only the address', () => {
    expect(
      visibleAnchor({
        href: 'https://jira.example/browse/1',
        text: 'https://jira.example/browse/1',
        title: 'Форма входа',
      }),
    ).toEqual({ text: 'Форма входа', href: 'https://jira.example/browse/1' });
  });

  it('leaves a name that is already separate from the address', () => {
    expect(visibleAnchor({ href: 'https://jira.example/browse/1', text: 'форма входа' })).toEqual({
      text: 'форма входа',
      href: 'https://jira.example/browse/1',
    });
  });
});

describe('normalizeEmbeddedLinkHtml', () => {
  it('rewrites the link text to the name and keeps the address in href', () => {
    expect(
      normalizeEmbeddedLinkHtml(
        '<p>Проверить <a href="https://jira.example/browse/1">форму https://jira.example/browse/1</a></p>',
      ),
    ).toBe(
      '<p>Проверить <a href="https://jira.example/browse/1" target="_blank" rel="noopener noreferrer">форму</a></p>',
    );
  });
});

describe('fieldDescriptionHtml', () => {
  it('shows the name as a clickable link', () => {
    expect(
      fieldDescriptionHtml({
        html: '<p><a href="https://jira.example/browse/1">форму https://jira.example/browse/1</a></p>',
        plainText: 'форму https://jira.example/browse/1',
      }),
    ).toBe(
      '<a href="https://jira.example/browse/1" target="_blank" rel="noopener noreferrer">форму</a>',
    );
  });
});
