import { bug } from '../src/bug.js';

if (bug() !== 1) throw new Error('fixture test failed');
