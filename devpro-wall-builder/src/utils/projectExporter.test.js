import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportProjectZip } from './projectExporter.js';

// Mock jszip
const mockFile = vi.fn();
const mockFolder = vi.fn(() => ({ file: mockFile }));
const mockGenerateAsync = vi.fn(() => Promise.resolve(new Blob(['zip'])));

vi.mock('jszip', () => {
  class MockJSZip {
    constructor() {
      this.folder = mockFolder;
      this.file = mockFile;
      this.generateAsync = mockGenerateAsync;
    }
  }
  return { default: MockJSZip };
});

// Minimal wall that calculateWallLayout can process
function makeWall(name) {
  return {
    id: `wall-${name}`,
    name,
    length_mm: 3600,
    height_mm: 2745,
    profile: 'standard',
    openings: [],
  };
}

describe('exportProjectZip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL/DOM APIs for the download fallback
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('creates a folder per wall with 5 DXF files each', async () => {
    const walls = [makeWall('Wall A'), makeWall('Wall B')];

    await exportProjectZip('Test Project', walls);

    // Should create one folder per wall
    expect(mockFolder).toHaveBeenCalledTimes(2);
    expect(mockFolder).toHaveBeenCalledWith('Wall A');
    expect(mockFolder).toHaveBeenCalledWith('Wall B');

    // 5 DXF types per wall = 10 files total
    expect(mockFile).toHaveBeenCalledTimes(10);
  });

  it('calls onProgress for each file generated', async () => {
    const walls = [makeWall('Wall 1')];
    const onProgress = vi.fn();

    await exportProjectZip('Proj', walls, onProgress);

    // 5 DXF types for 1 wall
    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress).toHaveBeenCalledWith(1, 5);
    expect(onProgress).toHaveBeenCalledWith(5, 5);
  });

  it('generates DXF strings (not empty) for each file', async () => {
    const walls = [makeWall('Test')];

    await exportProjectZip('P', walls);

    // Each file call should have a non-empty string as second arg
    for (const call of mockFile.mock.calls) {
      const [filename, content] = call;
      expect(filename).toMatch(/\.dxf$/);
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('sanitizes filenames with special characters', async () => {
    const walls = [makeWall('Wall: A/B')];

    await exportProjectZip('Project <1>', walls);

    // Folder name should be sanitized
    expect(mockFolder).toHaveBeenCalledWith('Wall_ A_B');

    // Filenames should contain sanitized names
    for (const call of mockFile.mock.calls) {
      const [filename] = call;
      expect(filename).not.toMatch(/[<>:"/\\|?*]/);
    }
  });

  it('generates the zip blob', async () => {
    const walls = [makeWall('W')];

    await exportProjectZip('P', walls);

    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
  });
});
