const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'lib.js'), 'utf8'), context);
const KV = context.KV;

const manifest = 'https://cdnapisec.kaltura.com/p/1234567/sp/123456700/playManifest/entryId/1_abcdefgh/format/applehttp/protocol/https/a.m3u8/ks/abcDEF1234567890abcDEF1234567890==';
const parsed = KV.parseKalturaUrl(manifest);
assert.equal(parsed.entryId, '1_abcdefgh');
assert.equal(parsed.partnerId, '1234567');
assert.equal(parsed.ks, 'abcDEF1234567890abcDEF1234567890==');

assert.equal(
  KV.parseKalturaUrl('https://mediaspace.unipd.it/media/Lezione%20di%20prova/1_abcdefgh').entryId,
  '1_abcdefgh'
);
assert.equal(KV.parseKalturaUrl('https://x.test/player?flashvars%5Bks%5D=xyz').ks, 'xyz');
assert.equal(KV.parseKalturaUrl('https://x.test/player?partner_id=1234567&entry_id=1_abcdefgh').partnerId, '1234567');
assert.equal(KV.parseKalturaUrl('https://x.test/player?partnerId=1234567').partnerId, '1234567');
assert.equal(KV.parseKalturaUrl('https://x.test/player?wid=_1234567').partnerId, '1234567');
const foundKs = KV.findKs('{"ks":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}');
assert.equal(foundKs.length, 1);
assert.equal(foundKs[0], 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

const built = KV.buildManifestUrl('1_abcdefgh', '1234567', 'a+b/c==', '1_flavorab');
assert.match(
  built,
  /\/p\/1234567\/sp\/123456700\/playManifest\/entryId\/1_abcdefgh\/flavorId\/1_flavorab\/format\/url\/protocol\/https\/a\.mp4\/ks\/a%2Bb%2Fc%3D%3D$/
);

const best = KV.pickBestFlavor([
  { id: 'a', status: 2, fileExt: 'mp4', width: 640, height: 360, bitrate: 161 },
  { id: 'b', status: 2, fileExt: 'mp4', width: 1920, height: 1080, bitrate: 490 },
  { id: 'c', status: 0, fileExt: 'mp4', width: 3840, height: 2160, bitrate: 900 },
  { id: 'd', status: 2, fileExt: 'mp4', width: 0, height: 0, bitrate: 60 },
]);
assert.equal(best.id, 'b');
assert.equal(KV.pickBestFlavor([]), null);

assert.equal(KV.sanitizeFilename('Lezione 3 (01/10/21) | STEM'), 'Lezione 3 (01_10_21).mp4');
assert.match(KV.sanitizeFilename('a/b:c*?"<>|.mp4'), /^a_b_c_+\.mp4$/);

console.log('lib.js: all checks passed');
