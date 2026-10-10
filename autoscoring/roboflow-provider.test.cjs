// Node regression test for the actual TS normalizer (types stripped only for Node).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../supabase/functions/autoscoring-roboflow/index.ts','utf8');
const begin = source.indexOf('function normalizedDetections(');
const end = source.indexOf('\nDeno.serve(', begin);
assert.ok(begin >= 0 && end > begin);
const snippet = source.slice(begin, end)
  .replace('function normalizedDetections(input: unknown)', 'function normalizedDetections(input)')
  .replace('input as {predictions?: RoboflowDetection[]}', 'input')
  .replace('const detections: {x: number; y: number; confidence: number; className: string}[] = [];', 'const detections = [];');
const context = {};
vm.runInNewContext(snippet + '\nthis.normalize = normalizedDetections;',context);
const n = context.normalize;
const empty=n({predictions:[]});
assert.equal(empty.diagnostics.providerPredictions,0);
assert.equal(empty.detections.length,0);
assert.equal(empty.diagnostics.responseFormat,'predictions');
const missing=n({predictions:[{x:20,y:60,confidence:.85,class:'dart_tip'}]});
assert.equal(missing.diagnostics.providerPredictions,1);
assert.equal(missing.diagnostics.keypointsReceived,0);
assert.equal(missing.detections.length,0); // bbox center must NOT be mistaken for tip
const pose=n({predictions:[{x:100,y:110,class:'dart_tip',confidence:.7,
  keypoints:[{x:9,y:11,confidence:.8,class:'tip'},{x:0,y:0,confidence:.9,class:'tail'}]}]});
assert.equal(pose.diagnostics.providerPredictions,1);
assert.equal(pose.diagnostics.keypointsReceived,2);
assert.equal(pose.diagnostics.validKeypoints,1);
assert.equal(pose.detections.length,1);
assert.equal(pose.detections[0].x,9);
assert.equal(pose.detections[0].y,11);
assert.equal(pose.detections[0].confidence,.8);
const malformed=n({unexpected:true});
assert.equal(malformed.diagnostics.responseFormat,'unexpected');
console.log('Roboflow diagnostic normalizer tests passed.');
