import { computeProjectMagboardSheetsWithFloors } from './magboardOptimizer.js';
import { computeProjectEpsBlocksWithFloors } from './epsOptimizer.js';
import { computeProjectGlueWithFloors } from './glueCalculator.js';
import { computeProjectTimber } from './timberCalculator.js';

/**
 * Aggregates material quantities from all project calculators into
 * the shape expected by POST /api/quotes.
 *
 * @param {Array} walls - Array of wall definition objects
 * @param {Array} floors - Array of floor definition objects
 * @returns {Object} Material quantities for the quote API
 */
export function aggregateProjectMaterials(walls, floors) {
  const magboard = computeProjectMagboardSheetsWithFloors(walls, floors || []);
  const eps = computeProjectEpsBlocksWithFloors(walls, floors || []);
  const glue = computeProjectGlueWithFloors(walls, floors || []);
  const timber = computeProjectTimber(walls, floors || []);

  return {
    magboard: {
      totalSheets: magboard.totalSheets,
      sheets2745: magboard.total2745,
      sheets3050: magboard.total3050,
    },
    eps: {
      totalBlocks: eps.totalBlocks,
      panelBlocks: eps.panelBlocks,
      splineBlocks: eps.splineBlocks,
    },
    glue: {
      totalLitres: glue.totalLitres,
      drumsNeeded: glue.drumsNeeded,
    },
    timber: {
      totalLinealMetres: timber.totalLinealMetres,
      totalPieces: timber.totalPieces,
    },
  };
}
