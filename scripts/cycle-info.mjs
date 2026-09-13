import {collectionCycle} from '../src/collection-cycle.mjs';

const index=process.argv.indexOf('--prewarm-minutes');
const prewarmMinutes=index>=0?Number(process.argv[index+1]):15;
process.stdout.write(JSON.stringify(collectionCycle(new Date(),{prewarmMinutes}))+'\n');
