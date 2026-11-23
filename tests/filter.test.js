import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterItems,
  paginateItems,
  parseHashState,
  parseUrlState,
  serializeHashState,
} from '../src/js/filter.ts';
import { buildDepartment, buildItem, buildLab } from './helpers.js';
import {
  ACCESS_LEVELS,
  AVAILABILITY_STATUSES,
  EQUIPMENT_TYPES,
  LIMITS,
} from '../src/js/constants.ts';

function createFilterFixture() {
  const departments = [
    buildDepartment({ id: 'dept-physics', code: 'PHYS', name: 'Physics' }),
    buildDepartment({ id: 'dept-ece', code: 'ECE', name: 'Electronics & ECE' }),
    buildDepartment({ id: 'dept-biotech', code: 'BIO', name: 'Biotechnology' }),
  ];

  const labs = [
    buildLab({ id: 'lab-phy-optics', departmentId: 'dept-physics', name: 'Laser & Optics Bench', room: 'SHN-204' }),
    buildLab({ id: 'lab-ece-fpga', departmentId: 'dept-ece', name: 'Embedded & FPGA Studio', room: 'ENG-312' }),
    buildLab({ id: 'lab-bio-micro', departmentId: 'dept-biotech', name: 'Microfluidics Suite', room: 'BIO-110' }),
  ];

  const items = [
    buildItem({
      id: 'eq-phy-01',
      name: 'UV-Vis Optical Spectrometer',
      departmentId: 'dept-physics',
      labId: 'lab-phy-optics',
      type: EQUIPMENT_TYPES[0],
      status: AVAILABILITY_STATUSES[0],
      accessLevel: ACCESS_LEVELS[0],
      specs: '190–1100 nm wavelength range, fiber-coupled detector',
    }),
    buildItem({
      id: 'eq-ece-01',
      name: 'Xilinx Artix-7 FPGA Kit',
      departmentId: 'dept-ece',
      labId: 'lab-ece-fpga',
      type: EQUIPMENT_TYPES[1],
      status: AVAILABILITY_STATUSES[0],
      accessLevel: ACCESS_LEVELS[1],
      specs: '100 MHz oscillator, JTAG USB bridge, logic analyzer header',
    }),
    buildItem({
      id: 'eq-ece-02',
      name: 'Thermal Imaging Workstation',
      departmentId: 'dept-ece',
      labId: 'lab-ece-fpga',
      type: EQUIPMENT_TYPES[2],
      status: AVAILABILITY_STATUSES[1],
      accessLevel: ACCESS_LEVELS[2],
      specs: 'Dual-GPU CUDA workstation with CAD suite',
    }),
    buildItem({
      id: 'eq-bio-01',
      name: 'Class II Biosafety Hood',
      departmentId: 'dept-biotech',
      labId: 'lab-bio-micro',
      type: EQUIPMENT_TYPES[3],
      status: AVAILABILITY_STATUSES[2],
      accessLevel: ACCESS_LEVELS[2],
      specs: 'HEPA laminar airflow cabinet with UV sterilization',
    }),
  ];

  return { departments, labs, items };
}

describe('filterItems search and criteria matching', () => {
  it('performs case-insensitive and whitespace-trimmed search across item name', () => {
    const { departments, labs, items } = createFilterFixture();
    const matches = filterItems(items, { query: '   sPeCtRoMeTeR   ' }, { departments, labs });
    assert.deepEqual(matches.map((i) => i.id), ['eq-phy-01']);
  });

  it('matches search queries against lab name and room code', () => {
    const { departments, labs, items } = createFilterFixture();
    const byLabName = filterItems(items, { query: 'microfluidics' }, { departments, labs });
    const byRoom = filterItems(items, { query: 'ENG-312' }, { departments, labs });
    assert.deepEqual(byLabName.map((i) => i.id), ['eq-bio-01']);
    assert.deepEqual(byRoom.map((i) => i.id), ['eq-ece-01', 'eq-ece-02']);
  });

  it('matches search queries against department name and code', () => {
    const { departments, labs, items } = createFilterFixture();
    const byDeptName = filterItems(items, { query: 'biotechnology' }, { departments, labs });
    const byDeptCode = filterItems(items, { query: 'phys' }, { departments, labs });
    assert.deepEqual(byDeptName.map((i) => i.id), ['eq-bio-01']);
    assert.deepEqual(byDeptCode.map((i) => i.id), ['eq-phy-01']);
  });

  it('matches search queries against equipment type and technical specs', () => {
    const { departments, labs, items } = createFilterFixture();
    const byType = filterItems(items, { query: 'development kits' }, { departments, labs });
    const bySpecs = filterItems(items, { query: 'HEPA laminar' }, { departments, labs });
    assert.deepEqual(byType.map((i) => i.id), ['eq-ece-01']);
    assert.deepEqual(bySpecs.map((i) => i.id), ['eq-bio-01']);
  });

  it('filters accurately by each individual criterion alone', () => {
    const { departments, labs, items } = createFilterFixture();
    assert.deepEqual(
      filterItems(items, { departmentId: 'dept-ece' }, { departments, labs }).map((i) => i.id),
      ['eq-ece-01', 'eq-ece-02']
    );
    assert.deepEqual(
      filterItems(items, { labId: 'lab-phy-optics' }, { departments, labs }).map((i) => i.id),
      ['eq-phy-01']
    );
    assert.deepEqual(
      filterItems(items, { type: EQUIPMENT_TYPES[2] }, { departments, labs }).map((i) => i.id),
      ['eq-ece-02']
    );
    assert.deepEqual(
      filterItems(items, { status: AVAILABILITY_STATUSES[2] }, { departments, labs }).map((i) => i.id),
      ['eq-bio-01']
    );
    assert.deepEqual(
      filterItems(items, { accessLevel: ACCESS_LEVELS[2] }, { departments, labs }).map((i) => i.id),
      ['eq-ece-02', 'eq-bio-01']
    );
  });

  it('combines multiple filters and query text with logical AND', () => {
    const { departments, labs, items } = createFilterFixture();
    const matches = filterItems(
      items,
      {
        departmentId: 'dept-ece',
        type: EQUIPMENT_TYPES[2],
        status: AVAILABILITY_STATUSES[1],
        accessLevel: ACCESS_LEVELS[2],
        query: 'cuda',
      },
      { departments, labs }
    );
    assert.deepEqual(matches.map((i) => i.id), ['eq-ece-02']);
  });

  it('returns an empty list when no items match the search or combined filters', () => {
    const { departments, labs, items } = createFilterFixture();
    assert.deepEqual(filterItems(items, { query: 'cryo-electron-999' }, { departments, labs }), []);
    assert.deepEqual(
      filterItems(items, { departmentId: 'dept-physics', type: EQUIPMENT_TYPES[3] }, { departments, labs }),
      []
    );
  });

  it('ignores unknown extra filter keys without throwing and returns a fresh array copy', () => {
    const { departments, labs, items } = createFilterFixture();
    const result = filterItems(
      items,
      { unknownKey: 'injected', extra: 123 },
      { departments, labs }
    );
    assert.equal(result.length, items.length);
    assert.notEqual(result, items);
  });
});

describe('paginateItems', () => {
  it('clamps out-of-range and non-finite page numbers within valid bounds', () => {
    const { items } = createFilterFixture();
    const low = paginateItems(items, -3, 2);
    assert.equal(low.page, 1);
    assert.equal(low.totalPages, 2);
    assert.deepEqual(low.items.map((i) => i.id), ['eq-phy-01', 'eq-ece-01']);

    const high = paginateItems(items, 99, 2);
    assert.equal(high.page, 2);
    assert.deepEqual(high.items.map((i) => i.id), ['eq-ece-02', 'eq-bio-01']);

    const empty = paginateItems([], 2, LIMITS.CATALOG_PAGE_SIZE);
    assert.equal(empty.totalItems, 0);
    assert.equal(empty.totalPages, 1);
    assert.equal(empty.page, 1);
    assert.deepEqual(empty.items, []);
  });
});

describe('parseHashState, parseUrlState, and serializeHashState', () => {
  it('parses valid page slugs, aliases, and query parameters', () => {
    const valid = createFilterFixture();
    const parsed = parseHashState('#dept=electronics&type=dev-kits&status=available&access=faculty-approval&q=%20FPGA%20&p=2', valid);
    assert.equal(parsed.page, 'discover');
    assert.equal(parsed.filters.departmentId, 'dept-ece');
    assert.equal(parsed.filters.type, EQUIPMENT_TYPES[1]);
    assert.equal(parsed.filters.status, AVAILABILITY_STATUSES[0]);
    assert.equal(parsed.filters.accessLevel, ACCESS_LEVELS[1]);
    assert.equal(parsed.filters.query, 'FPGA');
    assert.equal(parsed.catalogPage, 2);
  });

  it('ignores unknown filter values, unknown pages, and mismatched lab/department pairs safely', () => {
    const valid = createFilterFixture();
    const parsed = parseHashState(
      '#discover&dept=dept-physics&lab=lab-ece-fpga&type=Spaceship&status=Broken&access=Admin&p=-4&item=eq-missing',
      valid
    );
    assert.equal(parsed.page, 'discover');
    assert.equal(parsed.filters.departmentId, 'dept-physics');
    assert.equal(parsed.filters.labId, '');
    assert.equal(parsed.filters.type, '');
    assert.equal(parsed.filters.status, '');
    assert.equal(parsed.filters.accessLevel, '');
    assert.equal(parsed.catalogPage, 1);
    assert.equal(parsed.itemId, 'eq-phy-01');
  });

  it('strips dangerous characters, control bytes, and oversized strings from malicious hashes', () => {
    const valid = createFilterFixture();
    const longMalicious = `a<script>alert(1)</script>\u0007${'x'.repeat(120)}`;
    const parsed = parseHashState(
      `#discover&q=${encodeURIComponent(longMalicious)}&item=${encodeURIComponent('<img/src=x>')}`,
      valid
    );
    assert.equal(parsed.filters.query.includes('<'), false);
    assert.equal(parsed.filters.query.includes('>'), false);
    assert.equal(parsed.filters.query.includes('\u0007'), false);
    assert.ok(parsed.filters.query.length <= LIMITS.PROJECT_MAX);
    assert.equal(parsed.itemId, 'eq-phy-01');

    const badUrl = parseUrlState('?page=javascript:alert(1)&unknown=dropTable', '', valid);
    assert.equal(badUrl.page, 'home');

    const unknownHash = parseHashState('#nonexistent-section', valid);
    assert.equal(unknownHash.page, 'not-found');

    const skipAnchor = parseHashState('#main-content', valid);
    assert.equal(skipAnchor.page, 'home');
  });

  it('serializes discover and booking state into clean bookmarkable hashes', () => {
    assert.equal(
      serializeHashState({
        page: 'discover',
        filters: { departmentId: 'dept-ece', query: '  FPGA  ' },
        catalogPage: 3,
      }),
      '#discover&dept=dept-ece&q=FPGA&p=3'
    );
    assert.equal(
      serializeHashState({ page: 'booking', itemId: 'eq-phy-01' }),
      '#booking&item=eq-phy-01'
    );
    assert.equal(serializeHashState({ page: 'home' }), '#home');
  });
});
