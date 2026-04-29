import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const srcGlb = process.argv[2] || '/mnt/data/124.glb';
const baselineGlb = process.argv[3] || '/mnt/data/2ways.glb';
const outDir = process.argv[4] || '/mnt/data/avatar_rig_kit/animation-packs/124';
const kitRoot = process.argv[5] || '/mnt/data/avatar_rig_kit';

function parseGLB(filePath) {
  const data = fs.readFileSync(filePath);
  const magic = data.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error(`${filePath} is not a GLB`);
  const version = data.readUInt32LE(4);
  const declaredLength = data.readUInt32LE(8);
  let pos = 12, json = null, bin = null;
  while (pos < data.length) {
    const chunkLength = data.readUInt32LE(pos);
    const chunkType = data.readUInt32LE(pos + 4);
    pos += 8;
    const chunk = data.subarray(pos, pos + chunkLength);
    pos += chunkLength;
    if (chunkType === 0x4E4F534A) json = JSON.parse(Buffer.from(chunk).toString('utf8').trim());
    if (chunkType === 0x004E4942) bin = chunk;
  }
  if (!json) throw new Error(`${filePath} does not contain a JSON chunk`);
  return { filePath, data, version, declaredLength, json, bin };
}

const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const COMPONENT_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
function readComponent(buf, offset, componentType) {
  switch (componentType) {
    case 5120: return buf.readInt8(offset);
    case 5121: return buf.readUInt8(offset);
    case 5122: return buf.readInt16LE(offset);
    case 5123: return buf.readUInt16LE(offset);
    case 5125: return buf.readUInt32LE(offset);
    case 5126: return buf.readFloatLE(offset);
    default: throw new Error(`Unsupported componentType ${componentType}`);
  }
}
function readAccessor(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const comps = TYPE_COMPONENTS[accessor.type];
  const compSize = COMPONENT_SIZE[accessor.componentType];
  if (!comps || !compSize) throw new Error(`Unsupported accessor ${accessorIndex}`);
  const bv = gltf.bufferViews[accessor.bufferView];
  const base = (bv.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = bv.byteStride || (compSize * comps);
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    const row = [];
    const off = base + i * stride;
    for (let c = 0; c < comps; c++) row.push(readComponent(bin, off + c * compSize, accessor.componentType));
    out.push(comps === 1 ? row[0] : row);
  }
  return out;
}
function accessorStats(gltf, accessorIndex) {
  const a = gltf.accessors[accessorIndex];
  return { count: a.count, min: a.min || null, max: a.max || null, type: a.type, componentType: a.componentType };
}
function vecMinMax(values) {
  if (!values.length || !Array.isArray(values[0])) return null;
  const n = values[0].length;
  const min = Array(n).fill(Infinity), max = Array(n).fill(-Infinity);
  for (const v of values) for (let i = 0; i < n; i++) { if (v[i] < min[i]) min[i] = v[i]; if (v[i] > max[i]) max[i] = v[i]; }
  return { min, max };
}
function round(n, p = 6) { return Number.isFinite(n) ? Number(n.toFixed(p)) : n; }
function roundArr(arr, p = 6) { return arr ? arr.map(v => round(v, p)) : arr; }
function vecDelta(a, b) { return a && b ? b.map((v, i) => v - a[i]) : null; }
function vecLen(v) { return v ? Math.sqrt(v.reduce((s, x) => s + x*x, 0)) : 0; }
function quatNormalize(q) {
  const len = Math.sqrt(q.reduce((s, x) => s + x*x, 0));
  return len > 0 ? q.map(x => x/len) : [0,0,0,1];
}
function quatAngleDeg(a, b) {
  const qa = quatNormalize(a), qb = quatNormalize(b);
  const dot = Math.abs(qa[0]*qb[0] + qa[1]*qb[1] + qa[2]*qb[2] + qa[3]*qb[3]);
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
}
function maxQuatAngleFromFirst(values) {
  if (!values.length) return 0;
  const first = values[0];
  let max = 0;
  for (const q of values) max = Math.max(max, quatAngleDeg(first, q));
  return max;
}
function endQuatAngle(values) {
  if (values.length < 2) return 0;
  return quatAngleDeg(values[0], values[values.length - 1]);
}
function slugify(name) {
  return String(name || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unnamed';
}
const BONE_GROUPS = {
  root: ['root'],
  pelvis: ['pelvis'],
  spine: ['spine_01', 'spine_02', 'spine_03'],
  neckHead: ['neck_01', 'head'],
  leftArm: ['clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l'],
  rightArm: ['clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r'],
  leftFingers: ['thumb_01_l','thumb_02_l','thumb_03_l','thumb_04_leaf_l','index_01_l','index_02_l','index_03_l','index_04_leaf_l','middle_01_l','middle_02_l','middle_03_l','middle_04_leaf_l','ring_01_l','ring_02_l','ring_03_l','ring_04_leaf_l','pinky_01_l','pinky_02_l','pinky_03_l','pinky_04_leaf_l'],
  rightFingers: ['thumb_01_r','thumb_02_r','thumb_03_r','thumb_04_leaf_r','index_01_r','index_02_r','index_03_r','index_04_leaf_r','middle_01_r','middle_02_r','middle_03_r','middle_04_leaf_r','ring_01_r','ring_02_r','ring_03_r','ring_04_leaf_r','pinky_01_r','pinky_02_r','pinky_03_r','pinky_04_leaf_r'],
  leftLeg: ['thigh_l', 'calf_l', 'foot_l', 'ball_l', 'ball_leaf_l'],
  rightLeg: ['thigh_r', 'calf_r', 'foot_r', 'ball_r', 'ball_leaf_r'],
};
BONE_GROUPS.arms = [...BONE_GROUPS.leftArm, ...BONE_GROUPS.rightArm];
BONE_GROUPS.fingers = [...BONE_GROUPS.leftFingers, ...BONE_GROUPS.rightFingers];
BONE_GROUPS.hands = ['hand_l', 'hand_r', ...BONE_GROUPS.fingers];
BONE_GROUPS.legs = [...BONE_GROUPS.leftLeg, ...BONE_GROUPS.rightLeg];
BONE_GROUPS.upperBody = [...BONE_GROUPS.spine, ...BONE_GROUPS.neckHead, ...BONE_GROUPS.arms, ...BONE_GROUPS.fingers];
BONE_GROUPS.locomotionCore = ['root','pelvis', ...BONE_GROUPS.spine, ...BONE_GROUPS.legs];

const GROUP_ORDER = ['root','pelvis','spine','neckHead','leftArm','rightArm','leftFingers','rightFingers','leftLeg','rightLeg'];
const GROUP_LABEL = {root:'Root', pelvis:'Pelvis', spine:'Spine', neckHead:'Head', leftArm:'LArm', rightArm:'RArm', leftFingers:'LFing', rightFingers:'RFing', leftLeg:'LLeg', rightLeg:'RLeg'};
function groupActivityFromBoneStats(boneRotationStats, translationTargets) {
  const out = {};
  for (const group of GROUP_ORDER) {
    const bones = BONE_GROUPS[group];
    const vals = bones.map(b => boneRotationStats[b]?.maxRotationDeg ?? 0);
    const maxRotationDeg = vals.length ? Math.max(...vals) : 0;
    const avgMaxRotationDeg = vals.length ? vals.reduce((s,x)=>s+x,0)/vals.length : 0;
    const translation = group === 'root' ? translationTargets.find(t => t.target === 'root') : group === 'pelvis' ? translationTargets.find(t => t.target === 'pelvis') : null;
    out[group] = {
      maxRotationDeg: round(maxRotationDeg, 2),
      avgMaxRotationDeg: round(avgMaxRotationDeg, 2),
      translated: !!translation,
      translationDeltaLength: translation ? round(translation.deltaLength, 6) : 0,
      active: maxRotationDeg >= 8 || (translation?.deltaLength || 0) >= 0.01,
    };
  }
  return out;
}
function compactGroups(groupActivity) {
  return GROUP_ORDER.filter(g => groupActivity[g]?.active).map(g => GROUP_LABEL[g]).join(' ');
}
function inferCategory(name) {
  const n = name.toLowerCase();
  const has = (...xs) => xs.some(x => n.includes(x));
  if (n === 'rest pose' || n === 'tpose' || n === 't_pose') return {category:'reference_pose', subcategory:n.includes('tpose')?'t_pose':'rest_pose'};
  if (has('pistol')) return {category:'combat_weapon', subcategory:'pistol'};
  if (has('sword')) return {category:'combat_weapon', subcategory:'sword'};
  if (has('shield')) return {category:'combat_weapon', subcategory:'shield'};
  if (has('hit_', 'death')) return {category:'damage_death', subcategory:has('death')?'death':'hit_reaction'};
  if (has('fighting', 'punch', 'jab', 'melee', 'defend', 'zombie_scratch', 'scratch')) return {category:'combat_unarmed', subcategory:has('defend')?'defense':has('zombie')?'zombie_attack':has('jab')?'jab':has('punch')?'punch':has('fighting')?'fighting_idle':has('melee')?'melee':'attack'};
  if (has('spell', 'power up', 'two-hand blast', 'levitate')) return {category:'magic_power', subcategory:has('spell')?'spell':has('levitate')?'levitate':has('blast')?'blast':'power_up'};
  if (has('dance')) return {category:'dance', subcategory:'dance'};
  if (has('jumping jacks', 'pushup')) return {category:'fitness', subcategory:has('pushup')?'pushup':'jumping_jacks'};
  if (has('walk', 'jog', 'sprint', 'run anime', 'crawl', 'crouch_fwd', 'swim', 'flying forward', 'zombie_walk')) {
    let sub = 'movement';
    if (has('walk')) sub = 'walk'; else if (has('jog')) sub = 'jog'; else if (has('sprint')) sub = 'sprint'; else if (has('run')) sub = 'run'; else if (has('crawl')) sub = 'crawl'; else if (has('crouch')) sub = 'crouch_move'; else if (has('swim')) sub = 'swim'; else if (has('flying')) sub = 'fly';
    return {category:'locomotion', subcategory:sub};
  }
  if (has('jump', 'slide', 'roll', 'climb', 'backflip')) {
    let sub = 'transition';
    if (has('jump')) sub = 'jump'; else if (has('slide')) sub = 'slide'; else if (has('roll')) sub = 'roll'; else if (has('climb')) sub = 'climb'; else if (has('backflip')) sub = 'acrobatics';
    return {category:'locomotion_transition', subcategory:sub};
  }
  if (has('consume', 'farm_', 'pickup', 'pick_up', 'pick', 'chest_open', 'interact', 'throw', 'treechopping', 'fixing', 'push_loop')) {
    let sub = 'world';
    if (has('farm')) sub = 'farming'; else if (has('consume')) sub = 'consume'; else if (has('pick')) sub = 'pickup'; else if (has('throw')) sub = 'throw'; else if (has('tree')) sub = 'tooling'; else if (has('fixing')) sub = 'fixing'; else if (has('chest')) sub = 'container'; else if (has('push')) sub = 'push';
    return {category:'interaction_world', subcategory:sub};
  }
  if (has('sitting', 'sleeping', 'kneeling', 'meditate', 'tired hunched', 'shivering', 'dizzy', 'crouch_idle')) {
    let sub = 'posture';
    if (has('sitting')) sub = 'sitting'; else if (has('sleep')) sub = 'sleeping'; else if (has('kneel')) sub = 'kneeling'; else if (has('meditate')) sub = 'meditation'; else if (has('crouch')) sub = 'crouch_idle';
    return {category:'posture_state', subcategory:sub};
  }
  if (has('idle')) return {category:'idle_state', subcategory:has('zombie')?'zombie':has('rail')?'rail':has('phone')?'phone':has('lantern')?'lantern':has('torch')?'torch':'idle'};
  if (has('driving')) return {category:'vehicle_prop_state', subcategory:'driving'};
  if (has('angry', 'bow', 'confused', 'greeting', 'head nod', 'reject', 'victory', 'yes', 'chest_open')) return {category:'social_emote', subcategory:has('victory')?'victory':has('head nod') || n==='yes'?'affirmation':has('angry')?'anger':has('bow')?'bow':has('confused')?'confused':has('reject')?'reject':'greeting'};
  return {category:'misc', subcategory:'misc'};
}
function inferPlaybackKind(name, category, duration, endpointAvgDeg) {
  const n = name.toLowerCase();
  if (category === 'reference_pose') return 'pose';
  if (/(^|[_\s-])loop($|[_\s-])/i.test(name) || n.includes('_loop') || n.includes(' loop') || n.endsWith('idle') || n === 'sleeping' || n === 'meditate') return 'loop';
  if (/(enter|exit|start|land|rec|laytoidle|knockback)/i.test(name)) return 'transition';
  if (category === 'locomotion' && endpointAvgDeg < 12) return 'loop_candidate';
  return 'one_shot';
}
function inferLoadPack(category, subcategory) {
  if (category === 'reference_pose') return 'reference';
  if (category === 'locomotion') return 'core-locomotion';
  if (category === 'locomotion_transition') return 'locomotion-transitions';
  if (category === 'idle_state') return 'idles';
  if (category === 'posture_state') return 'posture-states';
  if (category === 'social_emote') return 'social-emotes';
  if (category === 'interaction_world') return 'world-interactions';
  if (category === 'vehicle_prop_state') return 'vehicle-prop-states';
  if (category.startsWith('combat') || category === 'damage_death') return 'combat';
  if (category === 'magic_power' || category === 'dance' || category === 'fitness') return 'magic-dance-fitness';
  return 'extras';
}
function inferDefaultMask(name, category, subcategory, groupActivity, rootMotion) {
  const n = name.toLowerCase();
  if (category === 'reference_pose') return 'all';
  if (category === 'locomotion') return 'locomotionCore';
  if (category === 'idle_state' && (n.includes('talking') || n.includes('phone'))) return 'upperBody';
  if (category === 'social_emote' && (n.includes('head nod') || n === 'yes')) return 'neckHead';
  if (category === 'combat_weapon' && subcategory === 'pistol') return 'upperBody';
  if (category === 'interaction_world' && ['consume','container','throw','pickup','farming','tooling','world'].includes(subcategory)) return 'upperBody';
  if (category === 'magic_power' && ['spell','blast','power_up'].includes(subcategory)) return 'upperBody';
  if (category === 'combat_unarmed' && ['punch','melee'].includes(subcategory)) return 'upperBody';
  if (category === 'locomotion_transition' || rootMotion) return 'all';
  const legMax = Math.max(groupActivity.leftLeg.maxRotationDeg, groupActivity.rightLeg.maxRotationDeg);
  const armMax = Math.max(groupActivity.leftArm.maxRotationDeg, groupActivity.rightArm.maxRotationDeg);
  if (legMax < 10 && armMax > 15) return 'upperBody';
  return 'all';
}
function trackUsesFingers(groupActivity) {
  return groupActivity.leftFingers.active || groupActivity.rightFingers.active;
}
function inferTags(name, category, subcategory, playbackKind, rootMotion, groupActivity) {
  const tags = new Set([category, subcategory, playbackKind]);
  const n = name.toLowerCase();
  for (const token of ['loop','idle','start','land','enter','exit','attack','reload','shoot','aim','walk','run','jump','sword','pistol','shield','spell','dance','farm','throw','sitting','sleeping']) {
    if (n.includes(token)) tags.add(token);
  }
  if (/(^|[_\s-])rm($|[_\s-])/.test(name.toLowerCase())) tags.add('root_motion_named');
  if (rootMotion) tags.add('root_motion');
  if (trackUsesFingers(groupActivity)) tags.add('fingers_active');
  if (groupActivity.leftFingers.active && !groupActivity.rightFingers.active) tags.add('left_hand_detail');
  if (groupActivity.rightFingers.active && !groupActivity.leftFingers.active) tags.add('right_hand_detail');
  return [...tags].filter(Boolean).sort();
}
function buildRigInfo(parsed) {
  const json = parsed.json;
  const skins = json.skins || [];
  const skin = skins[0] || { joints: [] };
  const joints = (skin.joints || []).map((nodeIndex, skinJointIndex) => ({ skinJointIndex, nodeIndex, name: json.nodes[nodeIndex]?.name || `node_${nodeIndex}` }));
  const jointNames = joints.map(j => j.name);
  const parentByIndex = new Map();
  (json.nodes || []).forEach((node, idx) => (node.children || []).forEach(ch => parentByIndex.set(ch, idx)));
  const hierarchy = joints.map(j => ({
    name: j.name,
    parent: parentByIndex.has(j.nodeIndex) ? json.nodes[parentByIndex.get(j.nodeIndex)]?.name || null : null,
    children: (json.nodes[j.nodeIndex]?.children || []).map(ch => json.nodes[ch]?.name || `node_${ch}`).filter(Boolean),
  }));
  const fpSource = hierarchy.map(j => `${j.name}<${j.parent || ''}>[${j.children.join(',')}]`).join('|');
  return { jointCount: joints.length, joints, jointNames, hierarchy, fingerprint: crypto.createHash('sha256').update(fpSource).digest('hex').slice(0, 16) };
}
function analyzeAnimations(parsed) {
  const gltf = parsed.json, bin = parsed.bin;
  const nodeNames = gltf.nodes.map((n, i) => n.name || `node_${i}`);
  const animations = [];
  for (const [index, anim] of (gltf.animations || []).entries()) {
    const pathCounts = {};
    const interpolationCounts = {};
    const translationTracks = [];
    const boneRotationStats = {};
    const allInputCounts = [];
    let maxTime = 0;
    const endpointAngles = [];
    const sampleRates = [];
    for (const ch of anim.channels || []) {
      const sampler = anim.samplers[ch.sampler];
      const targetName = nodeNames[ch.target.node];
      const pathName = ch.target.path;
      const interp = sampler.interpolation || 'LINEAR';
      pathCounts[pathName] = (pathCounts[pathName] || 0) + 1;
      interpolationCounts[interp] = (interpolationCounts[interp] || 0) + 1;
      const inputStats = accessorStats(gltf, sampler.input);
      const duration = inputStats.max ? inputStats.max[0] : (readAccessor(gltf, bin, sampler.input).at(-1) || 0);
      maxTime = Math.max(maxTime, duration);
      allInputCounts.push(inputStats.count);
      if (duration > 0 && inputStats.count > 1) sampleRates.push((inputStats.count - 1) / duration);
      if (pathName === 'translation') {
        const values = readAccessor(gltf, bin, sampler.output);
        const stats = vecMinMax(values);
        const first = values[0], last = values[values.length - 1];
        const delta = vecDelta(first, last);
        translationTracks.push({
          target: targetName,
          interpolation: interp,
          keyframes: inputStats.count,
          first: roundArr(first),
          last: roundArr(last),
          delta: roundArr(delta),
          deltaLength: round(vecLen(delta), 6),
          min: roundArr(stats?.min),
          max: roundArr(stats?.max),
          range: roundArr(stats ? stats.max.map((v, i) => v - stats.min[i]) : null),
        });
      } else if (pathName === 'rotation') {
        const values = readAccessor(gltf, bin, sampler.output);
        const maxRot = maxQuatAngleFromFirst(values);
        const endRot = endQuatAngle(values);
        endpointAngles.push(endRot);
        boneRotationStats[targetName] = {
          maxRotationDeg: round(maxRot, 2),
          endpointDeltaDeg: round(endRot, 2),
          keyframes: inputStats.count,
          interpolation: interp,
        };
      }
    }
    const groupActivity = groupActivityFromBoneStats(boneRotationStats, translationTracks);
    const leftFingerMax = groupActivity.leftFingers.maxRotationDeg;
    const rightFingerMax = groupActivity.rightFingers.maxRotationDeg;
    const fingerSide = leftFingerMax >= 8 && rightFingerMax >= 8 ? 'both' : leftFingerMax >= 8 ? 'left' : rightFingerMax >= 8 ? 'right' : 'none';
    const fingerActivity = { side: fingerSide, leftMaxDeg: leftFingerMax, rightMaxDeg: rightFingerMax };
    const endpointAvgDeg = endpointAngles.length ? endpointAngles.reduce((s,x)=>s+x,0)/endpointAngles.length : 0;
    const endpointMaxDeg = endpointAngles.length ? Math.max(...endpointAngles) : 0;
    const {category, subcategory} = inferCategory(anim.name || `Animation_${index}`);
    const playbackKind = inferPlaybackKind(anim.name || '', category, maxTime, endpointAvgDeg);
    const rootTrack = translationTracks.find(t => t.target === 'root');
    const rootMotion = !!rootTrack && rootTrack.deltaLength > 0.001;
    const loadPack = inferLoadPack(category, subcategory);
    const defaultMask = inferDefaultMask(anim.name || '', category, subcategory, groupActivity, rootMotion);
    const id = slugify(anim.name || `animation_${index}`);
    const keyframeCounts = [...new Set(allInputCounts)].sort((a,b)=>a-b);
    const avgSampleRate = sampleRates.length ? sampleRates.reduce((s,x)=>s+x,0)/sampleRates.length : 0;
    animations.push({
      index,
      id,
      clipName: anim.name || `Animation_${index}`,
      category,
      subcategory,
      playbackKind,
      loadPack,
      defaultMask,
      durationSeconds: round(maxTime, 6),
      estimatedFps: round(avgSampleRate, 3),
      keyframeCounts,
      maxKeyframes: Math.max(...allInputCounts),
      channelCount: (anim.channels || []).length,
      samplerCount: (anim.samplers || []).length,
      targetPathCounts: Object.fromEntries(Object.entries(pathCounts).sort()),
      interpolationCounts: Object.fromEntries(Object.entries(interpolationCounts).sort()),
      translationTargets: translationTracks.map(t => t.target),
      translationTracks,
      hasRootMotionTrack: !!rootTrack,
      rootMotion,
      rootMotionDelta: rootTrack ? rootTrack.delta : null,
      rootMotionDistance: rootTrack ? rootTrack.deltaLength : 0,
      endpointPoseDelta: { avgRotationDeg: round(endpointAvgDeg, 2), maxRotationDeg: round(endpointMaxDeg, 2) },
      loopCandidateByPose: playbackKind === 'loop' || (endpointAvgDeg < 7 && endpointMaxDeg < 25),
      groupActivity,
      fingerActivity,
      activeGroups: compactGroups(groupActivity),
      tags: inferTags(anim.name || '', category, subcategory, playbackKind, rootMotion, groupActivity),
    });
  }
  return animations;
}

function compareRigs(source, baseline) {
  const a = buildRigInfo(source), b = buildRigInfo(baseline);
  const namesEqual = JSON.stringify(a.jointNames) === JSON.stringify(b.jointNames);
  const hierarchyEqual = JSON.stringify(a.hierarchy.map(x => [x.name,x.parent,x.children])) === JSON.stringify(b.hierarchy.map(x => [x.name,x.parent,x.children]));
  return {
    sourceFingerprint: a.fingerprint,
    baselineFingerprint: b.fingerprint,
    jointNamesEqual: namesEqual,
    hierarchyEqual,
    sourceJointCount: a.jointCount,
    baselineJointCount: b.jointCount,
    missingFromSource: b.jointNames.filter(n => !a.jointNames.includes(n)),
    extraInSource: a.jointNames.filter(n => !b.jointNames.includes(n)),
  };
}
function countBy(arr, key) {
  const out = {};
  for (const item of arr) {
    const k = typeof key === 'function' ? key(item) : item[key];
    out[k] = (out[k] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
function csvEscape(v) {
  if (Array.isArray(v)) v = v.join('|');
  if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
  v = String(v ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function mdEscape(v) { return String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }
function categoryTitle(cat) {
  return cat.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
const CATEGORY_DESCRIPTIONS = {
  reference_pose: 'Bind/reference poses used for rig QA, retargeting checks, and editor resets.',
  locomotion: 'Playable movement loops and movement states. Most are good candidates for lower-body/locomotionCore masking.',
  locomotion_transition: 'Jumps, rolls, climb, slide, acrobatic entries/exits, and root-motion traversal beats.',
  idle_state: 'Standing idles and prop/context idles for ambient avatar state.',
  posture_state: 'Seated, crouched, kneeling, sleeping, meditative, or tired body states.',
  social_emote: 'Player-facing emotes, affirmations, greetings, and reactions.',
  dance: 'Dance loops/one-shots.',
  fitness: 'Exercise/fitness loops or actions.',
  interaction_world: 'World/object interactions such as pickup, consume, farm, chop, throw, push, fix, and chest use.',
  combat_unarmed: 'Unarmed fighting, punches, jabs, and melee-style actions.',
  combat_weapon: 'Weapon-specific stance, aim, reload, attack, block, dash, and combo clips.',
  damage_death: 'Hit reactions, knockback, and death.',
  magic_power: 'Spell, levitation, power-up, and blast actions.',
  vehicle_prop_state: 'Vehicle/prop stance loops.',
  misc: 'Unclassified clips; review manually if anything lands here.',
};
const PACK_DESCRIPTIONS = {
  'reference': 'Small editor/runtime QA pack.',
  'core-locomotion': 'Early-load pack for spawn and normal traversal.',
  'locomotion-transitions': 'Load when traversal states are enabled.',
  'idles': 'Idle variety pack, good candidate for lazy loading after spawn.',
  'posture-states': 'Sit/sleep/kneel/meditate/crouch states.',
  'social-emotes': 'Player expression and social interactions.',
  'world-interactions': 'Object/world interaction library.',
  'combat': 'Combat, weapon, hit-reaction, and death library.',
  'magic-dance-fitness': 'High-expression extras: magic, dance, fitness.',
  'vehicle-prop-states': 'Vehicle/prop stance and carry/drive states.',
  'extras': 'Fallback pack for clips not otherwise categorized.',
};
function makeSummaryMarkdown(manifest) {
  const anims = manifest.animations;
  const categoryCounts = countBy(anims, 'category');
  const packCounts = countBy(anims, 'loadPack');
  const playbackCounts = countBy(anims, 'playbackKind');
  const rootMotion = anims.filter(a => a.rootMotion || a.hasRootMotionTrack);
  let md = '';
  md += `# 124 Animation GLB Pack\n\n`;
  md += `Source: \`${manifest.source.fileName}\`\n\n`;
  md += `This README is the external map for the animation pack so the GLB does not need to be parsed every time just to know what it contains. It is generated from the GLB channels, targets, timings, and bone activity heuristics.\n\n`;
  md += `## At-a-glance\n\n`;
  md += `| Metric | Value |\n|---|---:|\n`;
  md += `| Clips | ${manifest.summary.animationCount} |\n`;
  md += `| Rig joints | ${manifest.rig.jointCount} |\n`;
  md += `| Rig matches 2ways baseline | ${manifest.compatibility.jointNamesEqual && manifest.compatibility.hierarchyEqual ? 'yes' : 'no'} |\n`;
  md += `| Clips with root translation/root-motion track | ${rootMotion.length} |\n`;
  md += `| Total animation duration | ${manifest.summary.totalDurationSeconds}s |\n`;
  md += `| Longest clip | ${manifest.summary.longestClip.clipName} (${manifest.summary.longestClip.durationSeconds}s) |\n`;
  md += `| Duplicate clip names | ${manifest.summary.duplicateClipNames.length ? manifest.summary.duplicateClipNames.join(', ') : 'none'} |\n`;
  md += `\n`;
  md += `## Recommended runtime layout\n\n`;
  md += `Keep one authoring/source-of-truth GLB containing all ${manifest.summary.animationCount} clips, but publish smaller runtime packs so avatar spawn does not force every user to download every emote/combat/action. The catalog files in this folder keep the API simple even if the binary payloads are split later.\n\n`;
  md += `| Runtime pack | Clips | Purpose |\n|---|---:|---|\n`;
  for (const [pack, count] of Object.entries(packCounts)) md += `| ${pack} | ${count} | ${PACK_DESCRIPTIONS[pack] || ''} |\n`;
  md += `\n`;
  md += `## Category counts\n\n`;
  md += `| Category | Clips | Notes |\n|---|---:|---|\n`;
  for (const [cat, count] of Object.entries(categoryCounts)) md += `| ${cat} | ${count} | ${CATEGORY_DESCRIPTIONS[cat] || ''} |\n`;
  md += `\n`;
  md += `## Playback kinds\n\n`;
  md += `| Playback kind | Clips | Meaning |\n|---|---:|---|\n`;
  const kindDesc = {loop:'Name/usage indicates a looping state.', loop_candidate:'No explicit Loop suffix, but endpoint pose appears loop-compatible.', one_shot:'One-shot action/emote.', transition:'State transition such as start, land, enter, exit, or recovery.', pose:'Reference/rest pose.'};
  for (const [kind, count] of Object.entries(playbackCounts)) md += `| ${kind} | ${count} | ${kindDesc[kind] || ''} |\n`;
  md += `\n`;
  md += `## Root motion clips\n\n`;
  md += `Root-motion clips have an extra \`root.translation\` track in addition to the normal \`pelvis.translation\` track. Raw deltas are in the GLB's local coordinate basis.\n\n`;
  md += `| Clip | Duration | Playback | Root Δ XYZ | Root distance | Suggested mask |\n|---|---:|---|---:|---:|---|\n`;
  for (const a of rootMotion) md += `| ${mdEscape(a.clipName)} | ${a.durationSeconds}s | ${a.playbackKind} | ${a.rootMotionDelta ? a.rootMotionDelta.map(x=>Number(x).toFixed(3)).join(', ') : 'track/no delta'} | ${a.rootMotionDistance.toFixed(3)} | ${a.defaultMask} |\n`;
  if (!rootMotion.length) md += `| none | | | | | |\n`;
  md += `\n`;
  md += `## How to read the dense index\n\n`;
  md += `**Groups** shows the bone groups that move beyond a small threshold: Root, Pelvis, Spine, Head, LArm/RArm, LFing/RFing, LLeg/RLeg. Because the exporter writes most rotations for every clip, group activity is more useful than raw track presence. **Mask** is a runtime suggestion, not a destructive edit.\n\n`;
  const fingerClips = anims.filter(a => a.fingerActivity.side !== 'none').sort((a,b) => Math.max(b.fingerActivity.leftMaxDeg, b.fingerActivity.rightMaxDeg) - Math.max(a.fingerActivity.leftMaxDeg, a.fingerActivity.rightMaxDeg));
  md += `## Finger-detail clips\n\n`;
  md += `These clips have detectable finger rotation beyond the activity threshold. This is useful for interaction polish, grip/pose overrides, and deciding where hand/finger masks matter.\n\n`;
  md += `| Clip | Category | Finger side | L max deg | R max deg | Suggested mask | Tags |\n|---|---|---|---:|---:|---|---|\n`;
  for (const a of fingerClips) md += `| ${mdEscape(a.clipName)} | ${a.category}/${a.subcategory} | ${a.fingerActivity.side} | ${a.fingerActivity.leftMaxDeg} | ${a.fingerActivity.rightMaxDeg} | ${a.defaultMask} | ${mdEscape(a.tags.slice(0, 8).join(', '))} |\n`;
  if (!fingerClips.length) md += `| none | | | | | | |\n`;
  md += `\n`;
  md += `## Dense animation index\n\n`;
  const cats = [...new Set(anims.map(a => a.category))].sort();
  for (const cat of cats) {
    const rows = anims.filter(a => a.category === cat).sort((a,b)=> a.clipName.localeCompare(b.clipName));
    md += `### ${categoryTitle(cat)} (${rows.length})\n\n`;
    md += `${CATEGORY_DESCRIPTIONS[cat] || ''}\n\n`;
    md += `| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |\n|---:|---|---|---|---:|---|---|---|:---:|---|---|\n`;
    for (const a of rows) {
      md += `| ${a.index} | ${mdEscape(a.clipName)} | \`${a.id}\` | ${a.subcategory} | ${a.durationSeconds} | ${a.playbackKind} | ${a.loadPack} | ${a.defaultMask} | ${a.rootMotion ? 'yes' : a.hasRootMotionTrack ? 'track' : ''} | ${mdEscape(a.activeGroups)} | ${mdEscape(a.tags.slice(0, 8).join(', '))} |\n`;
    }
    md += `\n`;
  }
  md += `## Track conventions observed\n\n`;
  md += `- Standard clips: 67 channels: 66 bone rotation tracks plus \`pelvis.translation\`.\n`;
  md += `- Root-motion clips: 68 channels: the standard 67 channels plus \`root.translation\`.\n`;
  md += `- No scale animation tracks were found in this pack.\n`;
  md += `- All clips target the same 66-joint skeleton as the baseline \`2ways.glb\`.\n\n`;
  md += `## Catalog files\n\n`;
  md += `- \`animation-pack.manifest.json\`: full machine-readable metadata, including root/pelvis deltas and bone-group activity.\n`;
  md += `- \`animation-index.csv\`: compact spreadsheet-friendly index.\n`;
  md += `- \`category-index.json\`: clips grouped by category, runtime pack, and playback kind.\n`;
  md += `- \`../../src/avatarAnimationCatalog124.ts\`: TypeScript catalog for app/runtime imports.\n`;
  return md;
}
function makeCompactMarkdown(manifest) {
  let md = `# Compact Animation Index\n\n`;
  md += `| # | Clip | Category | Sec | Kind | Pack | Mask | Root Motion | Groups |\n|---:|---|---|---:|---|---|---|:---:|---|\n`;
  for (const a of manifest.animations) md += `| ${a.index} | ${mdEscape(a.clipName)} | ${a.category}/${a.subcategory} | ${a.durationSeconds} | ${a.playbackKind} | ${a.loadPack} | ${a.defaultMask} | ${a.rootMotion ? 'yes' : ''} | ${mdEscape(a.activeGroups)} |\n`;
  return md;
}
function makeTS(manifest) {
  const compact = manifest.animations.map(a => ({
    index: a.index,
    id: a.id,
    clipName: a.clipName,
    category: a.category,
    subcategory: a.subcategory,
    playbackKind: a.playbackKind,
    loadPack: a.loadPack,
    defaultMask: a.defaultMask,
    durationSeconds: a.durationSeconds,
    rootMotion: a.rootMotion,
    hasRootMotionTrack: a.hasRootMotionTrack,
    rootMotionDistance: a.rootMotionDistance,
    translationTargets: a.translationTargets,
    activeGroups: a.activeGroups,
    fingerActivity: a.fingerActivity,
    tags: a.tags,
  }));
  return `// Auto-generated from ${manifest.source.fileName}.\n// Dense TypeScript animation catalog for runtime/editor use.\n\nexport const AVATAR_124_ANIMATION_CATALOG = ${JSON.stringify(compact, null, 2)} as const;\n\nexport type Avatar124Animation = typeof AVATAR_124_ANIMATION_CATALOG[number];\nexport type Avatar124AnimationId = Avatar124Animation["id"];\nexport type AvatarAnimationCategory = Avatar124Animation["category"];\nexport type AvatarAnimationPack = Avatar124Animation["loadPack"];\n\nexport const AVATAR_124_ANIMATION_BY_ID = Object.fromEntries(\n  AVATAR_124_ANIMATION_CATALOG.map((clip) => [clip.id, clip])\n) as Record<Avatar124AnimationId, Avatar124Animation>;\n\nexport const AVATAR_124_CLIP_NAME_BY_ID = Object.fromEntries(\n  AVATAR_124_ANIMATION_CATALOG.map((clip) => [clip.id, clip.clipName])\n) as Record<Avatar124AnimationId, string>;\n\nexport function getAvatar124ClipName(id: Avatar124AnimationId): string {\n  return AVATAR_124_ANIMATION_BY_ID[id].clipName;\n}\n\nexport function getAvatar124AnimationsByCategory(category: AvatarAnimationCategory): Avatar124Animation[] {\n  return AVATAR_124_ANIMATION_CATALOG.filter((clip) => clip.category === category) as Avatar124Animation[];\n}\n\nexport function getAvatar124AnimationsByPack(loadPack: AvatarAnimationPack): Avatar124Animation[] {\n  return AVATAR_124_ANIMATION_CATALOG.filter((clip) => clip.loadPack === loadPack) as Avatar124Animation[];\n}\n`;
}
function writeFiles(manifest, outDir, kitRoot) {
  fs.mkdirSync(outDir, { recursive: true });
  const srcDir = path.join(kitRoot, 'src');
  const scriptsDir = path.join(kitRoot, 'scripts');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'animation-pack.manifest.json'), JSON.stringify(manifest, null, 2));
  const csvCols = ['index','id','clipName','category','subcategory','playbackKind','loadPack','defaultMask','durationSeconds','estimatedFps','maxKeyframes','channelCount','rootMotion','hasRootMotionTrack','rootMotionDistance','rootMotionDelta','translationTargets','activeGroups','fingerActivity','tags'];
  const csv = [csvCols.join(',')].concat(manifest.animations.map(a => csvCols.map(c => csvEscape(a[c])).join(','))).join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'animation-index.csv'), csv);
  const categoryIndex = {
    generatedAt: manifest.generatedAt,
    byCategory: {},
    byLoadPack: {},
    byPlaybackKind: {},
  };
  for (const a of manifest.animations) {
    for (const [key, prop] of [['byCategory','category'], ['byLoadPack','loadPack'], ['byPlaybackKind','playbackKind']]) {
      categoryIndex[key][a[prop]] ||= [];
      categoryIndex[key][a[prop]].push({ id: a.id, clipName: a.clipName, durationSeconds: a.durationSeconds, rootMotion: a.rootMotion, defaultMask: a.defaultMask });
    }
  }
  fs.writeFileSync(path.join(outDir, 'category-index.json'), JSON.stringify(categoryIndex, null, 2));
  fs.writeFileSync(path.join(outDir, 'README.md'), makeSummaryMarkdown(manifest));
  fs.writeFileSync(path.join(outDir, 'animation-index.compact.md'), makeCompactMarkdown(manifest));
  fs.writeFileSync(path.join(srcDir, 'avatarAnimationCatalog124.ts'), makeTS(manifest));
  // Copy this generator into scripts so the catalog can be regenerated later.
  const thisFile = new URL(import.meta.url).pathname;
  fs.copyFileSync(thisFile, path.join(scriptsDir, 'build-animation-pack-catalog.mjs'));
  const rootReadme = `# Avatar Rig Kit\n\nThis kit contains the skeleton map, bone groups, mask helpers, and animation catalogs for the uploaded humanoid GLBs.\n\n## Current files\n\n- \`src/avatarRig.ts\` — canonical 66-bone names, parents, aliases, and bone groups.\n- \`src/threeAnimationMasks.ts\` — helper for creating masked Three.js clips by bone group.\n- \`src/avatarAnimationCatalog124.ts\` — compact TypeScript catalog for the 124-animation GLB.\n- \`animation-packs/124/README.md\` — dense human-readable map of every animation in \`124.glb\`.\n- \`animation-packs/124/animation-pack.manifest.json\` — full parsed metadata.\n- \`animation-packs/124/animation-index.csv\` — compact CSV index.\n\n## Regenerate the 124 pack catalog\n\n\`\`\`bash\nnode scripts/build-animation-pack-catalog.mjs /path/to/124.glb /path/to/2ways.glb ./animation-packs/124 .\n\`\`\`\n\nThe 124-animation pack currently matches the baseline skeleton by joint names and hierarchy.\n`;
  fs.writeFileSync(path.join(kitRoot, 'README.md'), rootReadme);
}

const parsed = parseGLB(srcGlb);
const baseline = fs.existsSync(baselineGlb) ? parseGLB(baselineGlb) : parsed;
const rig = buildRigInfo(parsed);
const animations = analyzeAnimations(parsed);
const durations = animations.map(a => a.durationSeconds);
const duplicateNames = Object.entries(countBy(animations, 'clipName')).filter(([,c]) => c > 1).map(([n]) => n);
const manifest = {
  generatedAt: new Date().toISOString(),
  source: {
    fileName: path.basename(srcGlb),
    fileSizeBytes: fs.statSync(srcGlb).size,
    asset: parsed.json.asset || null,
    nodeCount: parsed.json.nodes?.length || 0,
    meshCount: parsed.json.meshes?.length || 0,
    skinCount: parsed.json.skins?.length || 0,
  },
  compatibility: compareRigs(parsed, baseline),
  rig: {
    jointCount: rig.jointCount,
    rootJoint: rig.jointNames[0] || null,
    fingerprint: rig.fingerprint,
    jointNames: rig.jointNames,
  },
  summary: {
    animationCount: animations.length,
    totalDurationSeconds: round(durations.reduce((s,x)=>s+x,0), 3),
    shortestClip: animations.reduce((a,b)=>a.durationSeconds <= b.durationSeconds ? a : b),
    longestClip: animations.reduce((a,b)=>a.durationSeconds >= b.durationSeconds ? a : b),
    countsByCategory: countBy(animations, 'category'),
    countsByLoadPack: countBy(animations, 'loadPack'),
    countsByPlaybackKind: countBy(animations, 'playbackKind'),
    rootMotionClipIds: animations.filter(a => a.rootMotion || a.hasRootMotionTrack).map(a => a.id),
    duplicateClipNames: duplicateNames,
    targetPathCountsAcrossPack: animations.reduce((acc,a)=>{ for (const [k,v] of Object.entries(a.targetPathCounts)) acc[k]=(acc[k]||0)+v; return acc;}, {}),
  },
  boneGroups: BONE_GROUPS,
  animations,
};
writeFiles(manifest, outDir, kitRoot);
console.log(JSON.stringify({outDir, animationCount: animations.length, categories: manifest.summary.countsByCategory, rootMotion: manifest.summary.rootMotionClipIds, compatibility: manifest.compatibility}, null, 2));
