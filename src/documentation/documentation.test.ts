import { describe, expect, it } from 'vitest';
import {
  DESCRIPTIONS_REMEMBERED,
  SHORT_DESCRIPTION_LABELS,
  documentTemplate,
  hasDocumentation,
  headingId,
  linkElementRefs,
  outline,
  shortDescription,
  stripInline,
} from './documentation';
import { LANGUAGES, STRINGS, translator } from '../i18n/strings';

const PAGE = [
  '| Short description | The order of record from booking to invoice hand-off. |',
  '|---|---|',
  '| Owner | Logistics IT |',
  '| Business criticality | **High** |',
  '',
  '## Purpose',
  '',
  'Holds every order until it is handed to [[Billing]].',
  '',
  '## Interfaces',
  '',
  '```',
  '# not a heading',
  '```',
  '',
  '### Route Planner',
].join('\n');

describe('shortDescription', () => {
  it('is the "Short description" row of a leading header table', () => {
    expect(shortDescription(PAGE)).toBe('The order of record from booking to invoice hand-off.');
  });

  it('finds the row below an empty header row, and regardless of case', () => {
    const md = '| | |\n|---|---|\n| Owner | Ops |\n| SHORT DESCRIPTION: | *One* line |';
    expect(shortDescription(md)).toBe('One line');
  });

  it('accepts the Dutch label', () => {
    expect(shortDescription('| Korte omschrijving | Eén regel |\n|---|---|')).toBe('Eén regel');
  });

  it('falls back to the first paragraph, past a heading and a table without the row', () => {
    const md = '| Owner | Ops |\n|---|---|\n\n# Title\n\nFirst *paragraph*\nwraps here.\n\nSecond paragraph.';
    expect(shortDescription(md)).toBe('First paragraph wraps here.');
  });

  it('reads a plain old one-line description unchanged', () => {
    expect(shortDescription('Turns tomorrow’s orders into runs.')).toBe('Turns tomorrow’s orders into runs.');
  });

  it('takes a list item as the first thing said, without its marker', () => {
    expect(shortDescription('- [ ] first\n- second')).toBe('first second');
  });

  it('skips a fenced block on the way to the first paragraph', () => {
    expect(shortDescription('```\ncode\n```\n\nWords.')).toBe('Words.');
  });

  it('is empty for nothing', () => {
    expect(shortDescription(undefined)).toBe('');
    expect(shortDescription('')).toBe('');
    expect(shortDescription('| Owner | |\n|---|---|')).toBe('');
  });

  it('recognises the label every language uses for the row', () => {
    for (const language of LANGUAGES) {
      expect(SHORT_DESCRIPTION_LABELS).toContain(STRINGS[language]['doc.shortDescription'].toLowerCase());
    }
  });
});

describe('stripInline', () => {
  it('reduces emphasis, code, links and element refs to their words', () => {
    expect(stripInline('**bold** _it_ `code` [x](http://y) [[Billing]] ~~gone~~')).toBe('bold it code x Billing gone');
  });
});

describe('hasDocumentation', () => {
  it('is false for nothing, and for a one-liner', () => {
    expect(hasDocumentation(undefined)).toBe(false);
    expect(hasDocumentation('  ')).toBe(false);
    expect(hasDocumentation('Just a sentence.')).toBe(false);
  });

  it('is false for a header table that only carries the short description', () => {
    expect(hasDocumentation('| Short description | One line |\n|---|---|\n| Owner | |')).toBe(false);
  });

  it('is true for a filled header-table row, a heading, or a second paragraph', () => {
    expect(hasDocumentation('| Short description | One |\n|---|---|\n| Owner | Ops |')).toBe(true);
    expect(hasDocumentation('One.\n\n## More')).toBe(true);
    expect(hasDocumentation('One.\n\nTwo.')).toBe(true);
    expect(hasDocumentation(PAGE)).toBe(true);
  });
});

describe('outline', () => {
  it('lists ATX headings with their level and an anchor, ignoring fences', () => {
    expect(outline(PAGE)).toEqual([
      { level: 2, text: 'Purpose', id: 'purpose' },
      { level: 2, text: 'Interfaces', id: 'interfaces' },
      { level: 3, text: 'Route Planner', id: 'route-planner' },
    ]);
  });

  it('makes a readable anchor out of a heading', () => {
    expect(headingId('Decisions & open issues')).toBe('decisions-open-issues');
    expect(headingId('Éen **vet** kopje')).toBe('éen-vet-kopje');
  });

  it('is empty for nothing', () => {
    expect(outline(undefined)).toEqual([]);
  });
});

describe('linkElementRefs', () => {
  const elements = [
    { id: 'el-1', name: 'Billing' },
    { id: 'el-2', name: 'Track & Trace' },
    { id: 'el-3', name: 'Billing' },
  ];

  it('turns a known name into an element link, case-insensitively', () => {
    expect(linkElementRefs('see [[billing]] and [[Track & Trace]]', elements)).toBe(
      'see [billing](element:el-1) and [Track & Trace](element:el-2)',
    );
  });

  it('leaves an unknown name as written', () => {
    expect(linkElementRefs('see [[Nobody]]', elements)).toBe('see [[Nobody]]');
  });

  it('encodes an id that would not survive a URL', () => {
    expect(linkElementRefs('[[X]]', [{ id: 'a b/c', name: 'X' }])).toBe('[X](element:a%20b%2Fc)');
  });

  it('returns the same text when there is nothing to do', () => {
    const md = 'no refs here';
    expect(linkElementRefs(md, elements)).toBe(md);
  });
});

describe('documentTemplate', () => {
  it('starts with a header table whose first row is the short description', () => {
    const md = documentTemplate(translator('en'));
    expect(md.startsWith('| Short description | |\n|---|---|\n')).toBe(true);
    expect(md).toContain('## Purpose');
    expect(md).toContain('## Decisions');
  });

  it('gives a short description once the row is filled in', () => {
    const md = documentTemplate(translator('nl')).replace('| Korte omschrijving | |', '| Korte omschrijving | Eén regel |');
    expect(shortDescription(md)).toBe('Eén regel');
    // Untouched, the template already counts: its author has started a page.
    expect(hasDocumentation(documentTemplate(translator('nl')))).toBe(true);
  });

  it('does not repeat what the element already knows', () => {
    const md = documentTemplate(translator('en')).toLowerCase();
    expect(md).not.toContain('| vendor');
    expect(md).not.toContain('| technology');
    expect(md).not.toContain('| lifecycle');
  });
});

describe('reading a description more than once', () => {
  it('answers the same either way, however many have been read since', () => {
    const first = '| Short description | The one line |\n| --- | --- |\n\n## More\n\nAnd a paragraph.';
    const short = shortDescription(first);
    const has = hasDocumentation(first);
    expect(short).toBe('The one line');
    expect(has).toBe(true);

    // Past the point where the first one has certainly been evicted.
    for (let n = 0; n < DESCRIPTIONS_REMEMBERED + 100; n += 1) {
      shortDescription(`Description number ${n}.`);
      hasDocumentation(`Description number ${n}.`);
    }

    expect(shortDescription(first)).toBe(short);
    expect(hasDocumentation(first)).toBe(has);
  });

  it('tells two descriptions apart rather than answering with the last one', () => {
    expect(shortDescription('First thing.')).toBe('First thing.');
    expect(shortDescription('Second thing.')).toBe('Second thing.');
    expect(shortDescription('First thing.')).toBe('First thing.');
  });

  it('says nothing about an absent description, and does not remember it', () => {
    expect(shortDescription(undefined)).toBe('');
    expect(hasDocumentation(undefined)).toBe(false);
    expect(hasDocumentation('')).toBe(false);
    expect(hasDocumentation('   ')).toBe(false);
  });
});
