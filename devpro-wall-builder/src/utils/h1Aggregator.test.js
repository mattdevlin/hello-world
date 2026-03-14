import { describe, it, expect } from 'vitest';
import { aggregateDesignData } from './h1Aggregator.js';

describe('aggregateDesignData', () => {
  it('standard wall, no openings', () => {
    const walls = [{
      name: 'W1',
      length_mm: 6000,
      height_mm: 2700,
      profile: 'standard',
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // 6000 * 2700 = 16,200,000 mm² = 16.2 m²
    expect(result.grossWallArea).toBeCloseTo(16.2, 2);
    expect(result.netOpaqueWallArea).toBeCloseTo(16.2, 2);
    expect(result.windowArea).toBe(0);
    expect(result.doorArea).toBe(0);
    expect(result.wallCount).toBe(1);
  });

  it('standard wall with deductions', () => {
    const walls = [{
      name: 'W1',
      length_mm: 6000,
      height_mm: 2700,
      profile: 'standard',
      deduction_left_mm: 162,
      deduction_right_mm: 162,
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // (6000 - 162 - 162) * 2700 = 5676 * 2700 = 15,325,200 mm² = 15.3252 m²
    expect(result.grossWallArea).toBeCloseTo(15.33, 1);
  });

  it('raked wall area (trapezoid)', () => {
    const walls = [{
      name: 'W1',
      length_mm: 6000,
      height_mm: 2400,
      height_right_mm: 3000,
      profile: 'raked',
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // Trapezoid: 6000 * (2400 + 3000) / 2 = 6000 * 2700 = 16,200,000 mm² = 16.2 m²
    expect(result.grossWallArea).toBeCloseTo(16.2, 2);
  });

  it('raked wall with deductions', () => {
    const walls = [{
      name: 'W1',
      length_mm: 6000,
      height_mm: 2400,
      height_right_mm: 3000,
      profile: 'raked',
      deduction_left_mm: 600,
      deduction_right_mm: 600,
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // netStart=600, netEnd=5400, span=4800
    // hAtStart = 2400 + 600*(3000-2400)/6000 = 2400 + 60 = 2460
    // hAtEnd = 2400 + 5400*600/6000 = 2400 + 540 = 2940
    // area = 4800 * (2460 + 2940) / 2 = 4800 * 2700 = 12,960,000 mm² = 12.96 m²
    expect(result.grossWallArea).toBeCloseTo(12.96, 2);
  });

  it('gable wall area (triangle on rectangle)', () => {
    const walls = [{
      name: 'W1',
      length_mm: 8000,
      height_mm: 2400,
      peak_height_mm: 4000,
      peak_position_mm: 4000,
      profile: 'gable',
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // Rectangle base: 8000 * 2400 = 19,200,000
    // Triangle top: 8000 * (4000 - 2400) / 2 = 8000 * 800 = 6,400,000
    // Total: 25,600,000 mm² = 25.6 m²
    expect(result.grossWallArea).toBeCloseTo(25.6, 2);
  });

  it('gable wall with asymmetric peak', () => {
    const walls = [{
      name: 'W1',
      length_mm: 10000,
      height_mm: 2400,
      peak_height_mm: 4400,
      peak_position_mm: 3000,
      profile: 'gable',
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // Left trapezoid: 0→3000, h(0)=2400, h(3000)=4400 → 3000*(2400+4400)/2 = 10,200,000
    // Right trapezoid: 3000→10000, h(3000)=4400, h(10000)=2400 → 7000*(4400+2400)/2 = 23,800,000
    // Total: 34,000,000 mm² = 34.0 m²
    expect(result.grossWallArea).toBeCloseTo(34.0, 2);
  });

  it('window vs door classification', () => {
    const walls = [{
      name: 'W1',
      length_mm: 10000,
      height_mm: 2700,
      profile: 'standard',
      openings: [
        { type: 'window', width_mm: 1200, height_mm: 1200 },
        { type: 'window', width_mm: 600, height_mm: 900 },
        { type: 'door', width_mm: 900, height_mm: 2150 },
        { type: 'single_garage', width_mm: 2440, height_mm: 2100 },
        { type: 'double_garage', width_mm: 4880, height_mm: 2100 },
      ],
    }];
    const result = aggregateDesignData(walls, []);
    // Windows: 1200*1200 + 600*900 = 1,440,000 + 540,000 = 1,980,000 mm² = 1.98 m²
    expect(result.windowArea).toBeCloseTo(1.98, 2);
    expect(result.windowCount).toBe(2);
    // Doors: 900*2150 + 2440*2100 + 4880*2100 = 1,935,000 + 5,124,000 + 10,248,000 = 17,307,000 = 17.307 m²
    expect(result.doorArea).toBeCloseTo(17.31, 1);
    expect(result.doorCount).toBe(3);
    // Net opaque = gross - windows - doors
    const gross = 10 * 2.7; // 27 m²
    expect(result.netOpaqueWallArea).toBeCloseTo(gross - 1.98 - 17.307, 0);
  });

  it('multiple walls aggregation', () => {
    const walls = [
      { name: 'W1', length_mm: 5000, height_mm: 2700, profile: 'standard', openings: [] },
      { name: 'W2', length_mm: 3000, height_mm: 2700, profile: 'standard', openings: [] },
    ];
    const result = aggregateDesignData(walls, []);
    // 5000*2700 + 3000*2700 = 13,500,000 + 8,100,000 = 21,600,000 = 21.6 m²
    expect(result.grossWallArea).toBeCloseTo(21.6, 2);
    expect(result.wallCount).toBe(2);
    expect(result.perWall).toHaveLength(2);
    expect(result.perWall[0].name).toBe('W1');
    expect(result.perWall[0].grossArea).toBeCloseTo(13.5, 2);
  });

  it('floor polygon area + perimeter', () => {
    // 6m x 4m rectangle
    const floors = [{
      name: 'F1',
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    }];
    const result = aggregateDesignData([], floors);
    expect(result.floorArea).toBeCloseTo(24.0, 2); // 6*4 = 24 m²
    expect(result.floorPerimeter).toBeCloseTo(20.0, 2); // 2*(6+4) = 20 m
    expect(result.floorCount).toBe(1);
  });

  it('multiple floors sum areas and perimeters', () => {
    const floors = [
      {
        name: 'F1',
        polygon: [
          { x: 0, y: 0 }, { x: 5000, y: 0 },
          { x: 5000, y: 3000 }, { x: 0, y: 3000 },
        ],
      },
      {
        name: 'F2',
        polygon: [
          { x: 0, y: 0 }, { x: 4000, y: 0 },
          { x: 4000, y: 2000 }, { x: 0, y: 2000 },
        ],
      },
    ];
    const result = aggregateDesignData([], floors);
    expect(result.floorArea).toBeCloseTo(15 + 8, 2); // 23 m²
    expect(result.floorPerimeter).toBeCloseTo(16 + 12, 2); // 28 m
  });

  it('empty arrays return zeroes', () => {
    const result = aggregateDesignData([], []);
    expect(result.wallCount).toBe(0);
    expect(result.floorCount).toBe(0);
    expect(result.grossWallArea).toBe(0);
    expect(result.windowArea).toBe(0);
    expect(result.doorArea).toBe(0);
    expect(result.floorArea).toBe(0);
    expect(result.floorPerimeter).toBe(0);
    expect(result.perWall).toEqual([]);
  });

  it('handles missing/undefined inputs', () => {
    const result = aggregateDesignData();
    expect(result.wallCount).toBe(0);
    expect(result.grossWallArea).toBe(0);
  });

  it('gable wall with deductions cutting into peak region', () => {
    const walls = [{
      name: 'W1',
      length_mm: 8000,
      height_mm: 2400,
      peak_height_mm: 4000,
      peak_position_mm: 4000,
      profile: 'gable',
      deduction_left_mm: 162,
      deduction_right_mm: 162,
      openings: [],
    }];
    const result = aggregateDesignData(walls, []);
    // Net span: 8000 - 324 = 7676
    // Should be slightly less than the no-deduction case (25.6 m²)
    expect(result.grossWallArea).toBeLessThan(25.6);
    expect(result.grossWallArea).toBeGreaterThan(20);
  });
});
