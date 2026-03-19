#!/usr/bin/env node

/**
 * Generate a sample Excel file for testing the import pipeline.
 */

import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const data = [
  { Name: 'John Smith', Email: 'john@passivehouse-architects.co.nz', Company: 'Passive House Architects Auckland' },
  { Name: 'Sarah Jones', Email: 'sarah@greendesign.co.nz', Company: 'Green Design Studio Wellington' },
  { Name: 'Mike Brown', Email: 'mike@brownarchitects.co.nz', Company: 'Brown & Associates Architects Christchurch' },
  { Name: 'Lisa Chen', Email: 'lisa@homearchitects.co.nz', Company: 'Home Architects Ltd' },
  { Name: 'David Wilson', Email: 'david@commercialgroup.co.nz', Company: 'Commercial Architecture Group' },
  { Name: 'Emma Taylor', Email: 'emma@interiordesign.co.nz', Company: 'Taylor Interior Design Studio' },
  { Name: 'James Lee', Email: 'james@sustainable-homes.co.nz', Company: 'Sustainable Homes Design' },
  { Name: 'Anna White', Email: 'anna@landscapearch.co.nz', Company: 'White Landscape Architects' },
  { Name: 'Tom Harris', Email: 'tom@schooldesign.co.nz', Company: 'Harris Education Architecture' },
  { Name: 'Kate Robinson', Email: 'kate@homestar-design.co.nz', Company: 'Homestar Design Practice Tauranga' },
  { Name: '', Email: 'noemail@', Company: 'Bad Data Corp' },
  { Name: 'Duplicate Dave', Email: 'david@commercialgroup.co.nz', Company: 'Commercial Architecture Group' },
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Architects');

const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync('./data/sample-architects.xlsx', buf);

console.log('Generated data/sample-architects.xlsx with', data.length, 'rows');
