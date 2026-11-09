import * as THREE from 'three';
import { Stats } from '@warri-vibe/engine';
import { AvatarConfig } from '../../types/avatar';
import { build3DAvatar, AvatarRig } from '../Avatar3D/AvatarModelBuilder';

export type WorldLocationId = 'living_room' | 'church' | 'market' | 'junction';

export interface WorldNpcDef {
  id: string;
  name: string;
  role: string;
  icon: string;
  affinityId?: string;
  dialogueLines: string[];
  statDeltas?: Partial<Stats>;
  moneyDelta?: number;
  avatarConfig: AvatarConfig;
  startX: number;
  startZ: number;
  startRotY: number;
  defaultPose: 'idle' | 'walk' | 'run' | 'groove' | 'wave' | 'proud' | 'hustle';
  patrolWaypoints?: { x: number; z: number }[];
  patrolSpeed?: number;
}

export interface BuiltWorldNpc {
  def: WorldNpcDef;
  rig: AvatarRig;
  x: number;
  z: number;
  rotY: number;
  waypointIdx: number;
  reactionPose: string | null;
  reactionTimer: number;
  dialogueIndex: number;
}

export interface WorldHotspot {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  description: string;
  x: number;
  z: number;
  radius?: number;
  statDeltas?: Partial<Stats>;
  moneyDelta?: number;
  poseReaction?: 'wave' | 'proud' | 'hustle' | 'groove';
  sound?: 'coin' | 'fanfare' | 'alert' | 'click' | 'eat';
}

export interface WorldObstacle {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldSceneConfig {
  id: WorldLocationId;
  name: string;
  tagline: string;
  icon: string;
  ambientColor: number;
  ambientIntensity: number;
  dirLightColor: number;
  dirLightIntensity: number;
  dirLightPos: [number, number, number];
  skyColor: number;
  groundColor: number;
  boundary: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; z: number };
  hotspots: WorldHotspot[];
  obstacles: WorldObstacle[];
}

export function resolveMovement(
  currentX: number,
  currentZ: number,
  deltaX: number,
  deltaZ: number,
  avatarRadius: number,
  obstacles: WorldObstacle[],
  boundary: { minX: number; maxX: number; minZ: number; maxZ: number }
): { x: number; z: number } {
  const r = avatarRadius;

  function isBlocked(x: number, z: number): boolean {
    for (const obs of obstacles) {
      if (
        x >= obs.minX - r &&
        x <= obs.maxX + r &&
        z >= obs.minZ - r &&
        z <= obs.maxZ + r
      ) {
        return true;
      }
    }
    return false;
  }

  // 1. Try moving along X axis (enables smooth sliding against horizontal obstacles)
  let nextX = currentX + deltaX;
  nextX = Math.max(boundary.minX + r, Math.min(boundary.maxX - r, nextX));
  if (isBlocked(nextX, currentZ)) {
    nextX = currentX;
  }

  // 2. Try moving along Z axis (enables smooth sliding against vertical obstacles)
  let nextZ = currentZ + deltaZ;
  nextZ = Math.max(boundary.minZ + r, Math.min(boundary.maxZ - r, nextZ));
  if (isBlocked(nextX, nextZ)) {
    nextZ = currentZ;
  }

  return { x: nextX, z: nextZ };
}

export const WORLD_LOCATIONS: Record<WorldLocationId, WorldSceneConfig> = {
  living_room: {
    id: 'living_room',
    name: 'Your Living Room, Udu',
    tagline: 'Linoleum floor, cozy parlor sofa, CRT TV, and "I pass my neighbor" Tiger generator',
    icon: '🛋️',
    ambientColor: 0xffedd5,
    ambientIntensity: 1.5,
    dirLightColor: 0xf59e0b,
    dirLightIntensity: 1.8,
    dirLightPos: [3, 5, 2],
    skyColor: 0x1e1b4b,
    groundColor: 0x451a03,
    boundary: { minX: -3.5, maxX: 3.5, minZ: -3.2, maxZ: 3.2 },
    spawn: { x: 0, z: 0.6 },
    obstacles: [
      { id: 'sofa', label: 'Parlor Sofa', minX: -3.2, maxX: -1.2, minZ: -1.9, maxZ: -0.5 },
      { id: 'tv_table', label: 'TV Table & Stand', minX: 1.0, maxX: 2.7, minZ: -3.0, maxZ: -1.8 },
      { id: 'tiger_gen', label: 'Tiger Gen', minX: 2.1, maxX: 3.1, minZ: 1.3, maxZ: 2.3 },
      { id: 'standing_fan', label: 'Standing Fan', minX: -3.0, maxX: -2.2, minZ: 1.4, maxZ: 2.2 },
    ],
    hotspots: [
      {
        id: 'sofa',
        label: 'Parlor Sofa & Cushions',
        icon: '🛋️',
        prompt: 'Rest & Stretch',
        description: 'Rest your body small on the soft parlor cushion (+15 Energy, +8 Mood)',
        x: -1.6,
        z: -0.1,
        statDeltas: { energy: 15, mood: 8 },
        poseReaction: 'proud',
        sound: 'fanfare',
      },
      {
        id: 'tv',
        label: 'Delta CRT Television',
        icon: '📺',
        prompt: 'Tune TV',
        description: 'Watch hilarious Delta comedy skits & Afrobeat music videos (+12 Mood)',
        x: 1.8,
        z: -1.4,
        statDeltas: { mood: 12 },
        poseReaction: 'groove',
        sound: 'click',
      },
      {
        id: 'gen',
        label: 'Tiger Generator ("I Pass My Neighbor")',
        icon: '⚡',
        prompt: 'Inspect Gen',
        description: 'Check spark plug & fuel tank. Light fit go, but generator dey stand by (+5 Respect)',
        x: 1.8,
        z: 1.6,
        statDeltas: { respect: 5 },
        poseReaction: 'hustle',
        sound: 'click',
      },
      {
        id: 'fan',
        label: 'Standing Oscillating Fan',
        icon: '🌀',
        prompt: 'Catch Breeze',
        description: 'Fresh cool breeze blowing softly (+6 Mood, +4 Energy)',
        x: -1.8,
        z: 1.6,
        statDeltas: { mood: 6, energy: 4 },
        poseReaction: 'wave',
        sound: 'click',
      },
    ],
  },

  church: {
    id: 'church',
    name: 'Warri Praise & Thanksgiving Chapel',
    tagline: 'Polished sanctuary tiles, red carpet aisle, glowing golden cross & praise podium',
    icon: '⛪',
    ambientColor: 0xfffbeb,
    ambientIntensity: 1.6,
    dirLightColor: 0xfef08a,
    dirLightIntensity: 2.2,
    dirLightPos: [0, 6, 2],
    skyColor: 0x0f172a,
    groundColor: 0x1e293b,
    boundary: { minX: -3.5, maxX: 3.5, minZ: -3.5, maxZ: 3.2 },
    spawn: { x: 0, z: 1.8 },
    obstacles: [
      { id: 'altar_platform', label: 'Altar Platform', minX: -2.8, maxX: 2.8, minZ: -3.6, maxZ: -1.6 },
      { id: 'pews_left_1', label: 'Pew Row 1 Left', minX: -3.3, maxX: -1.3, minZ: -0.9, maxZ: -0.3 },
      { id: 'pews_left_2', label: 'Pew Row 2 Left', minX: -3.3, maxX: -1.3, minZ: 0.3, maxZ: 0.9 },
      { id: 'pews_left_3', label: 'Pew Row 3 Left', minX: -3.3, maxX: -1.3, minZ: 1.5, maxZ: 2.1 },
      { id: 'pews_right_1', label: 'Pew Row 1 Right', minX: 1.3, maxX: 3.3, minZ: -0.9, maxZ: -0.3 },
      { id: 'pews_right_2', label: 'Pew Row 2 Right', minX: 1.3, maxX: 3.3, minZ: 0.3, maxZ: 0.9 },
      { id: 'pews_right_3', label: 'Pew Row 3 Right', minX: 1.3, maxX: 3.3, minZ: 1.5, maxZ: 2.1 },
    ],
    hotspots: [
      {
        id: 'altar',
        label: 'Sanctuary Altar & Golden Cross',
        icon: '🕊️',
        prompt: 'Altar Thanksgiving Prayer',
        description: 'Kneel and pray for grace, breakthrough & safety in the streets (+15 Mood, -15 Heat)',
        x: 0,
        z: -1.2,
        statDeltas: { mood: 15, heat: -15 },
        poseReaction: 'proud',
        sound: 'fanfare',
      },
      {
        id: 'pulpit',
        label: 'Choir & Praise Microphone',
        icon: '🎤',
        prompt: 'Lead Praise Session',
        description: 'Sing energetic Delta gospel praise songs that shake the roof! (+15 Respect, +12 Mood)',
        x: 0.9,
        z: -1.2,
        statDeltas: { respect: 15, mood: 12 },
        poseReaction: 'groove',
        sound: 'fanfare',
      },
      {
        id: 'pew',
        label: 'Wooden Church Pew',
        icon: '🪑',
        prompt: 'Sit in Pew',
        description: 'Take in the calm atmosphere and fellowship with brothers and sisters (+8 Mood)',
        x: -0.9,
        z: 0.6,
        statDeltas: { mood: 8 },
        poseReaction: 'wave',
        sound: 'click',
      },
      {
        id: 'offering',
        label: 'Chapel Offering Treasury',
        icon: '🪙',
        prompt: 'Drop ₦200 Offering',
        description: 'Drop ₦200 street seed for supernatural favor (-₦200, +20 Respect, +10 Mood)',
        x: -0.9,
        z: -1.2,
        moneyDelta: -200,
        statDeltas: { respect: 20, mood: 10 },
        poseReaction: 'hustle',
        sound: 'coin',
      },
    ],
  },

  market: {
    id: 'market',
    name: 'Warri Main Market Hub',
    tagline: 'Packed market tables, giant colorful umbrellas, fresh pepper baskets & POS center',
    icon: '🛍️',
    ambientColor: 0xfff7ed,
    ambientIntensity: 1.7,
    dirLightColor: 0xfbbf24,
    dirLightIntensity: 2.3,
    dirLightPos: [4, 7, 3],
    skyColor: 0x38bdf8,
    groundColor: 0x78350f,
    boundary: { minX: -3.8, maxX: 3.8, minZ: -3.5, maxZ: 3.5 },
    spawn: { x: 0, z: 1.2 },
    obstacles: [
      { id: 'mama_table', label: 'Mama Ejiro Market Stall', minX: -3.0, maxX: -1.0, minZ: -1.8, maxZ: -0.6 },
      { id: 'pos_kiosk_booth', label: 'POS Cash Kiosk Booth', minX: 1.3, maxX: 3.1, minZ: -2.3, maxZ: -0.7 },
      { id: 'drinks_kiosk', label: 'Drinks & Provision Stand', minX: 1.5, maxX: 3.1, minZ: 0.8, maxZ: 2.0 },
      { id: 'keke_barrier', label: 'Market Keke Gate Barrier', minX: -3.2, maxX: -1.4, minZ: 1.1, maxZ: 2.5 },
    ],
    hotspots: [
      {
        id: 'tomatoes',
        label: 'Mama Ejiro\'s Fresh Market Stall',
        icon: '🍅',
        prompt: 'Bargain Fresh Provisions',
        description: 'Buy fresh ripe tomatoes, rodo peppers, and yam tubers (-₦500, -35 Hunger, +10 Mood)',
        x: -0.9,
        z: -1.1,
        moneyDelta: -500,
        statDeltas: { hunger: -35, mood: 10 },
        poseReaction: 'wave',
        sound: 'coin',
      },
      {
        id: 'pos_kiosk',
        label: 'POS Cash & Transfer Point',
        icon: '💳',
        prompt: 'Transact POS Cash',
        description: 'Check cash liquidity, collect small cash, and greet the kiosk girl (+6 Respect)',
        x: 1.0,
        z: -1.3,
        statDeltas: { respect: 6 },
        poseReaction: 'proud',
        sound: 'click',
      },
      {
        id: 'provisions',
        label: 'Cold Malta & Soft Drinks Stand',
        icon: '🥫',
        prompt: 'Buy Ice-Cold Malta',
        description: 'Chilled Malta Guinness to cool body from the afternoon Warri heat (-₦300, +15 Energy, +8 Mood)',
        x: 1.1,
        z: 1.4,
        moneyDelta: -300,
        statDeltas: { energy: 15, mood: 8 },
        poseReaction: 'hustle',
        sound: 'coin',
      },
      {
        id: 'keke_stand',
        label: 'Market Gate Keke Terminal',
        icon: '🚖',
        prompt: 'Hail Keke Union',
        description: 'Throw two-finger salute to the keke union leaders (+10 Respect)',
        x: -1.1,
        z: 1.6,
        statDeltas: { respect: 10 },
        poseReaction: 'wave',
        sound: 'click',
      },
    ],
  },

  junction: {
    id: 'junction',
    name: 'Effurun Roundabout & Street',
    tagline: 'Asphalt road, iconic yellow Keke NAPEP tricycle, street billboard & smoky Bole stand',
    icon: '🚖',
    ambientColor: 0xfef3c7,
    ambientIntensity: 1.6,
    dirLightColor: 0xf59e0b,
    dirLightIntensity: 2.0,
    dirLightPos: [-3, 6, 4],
    skyColor: 0x0284c7,
    groundColor: 0x1f2937,
    boundary: { minX: -3.8, maxX: 3.8, minZ: -3.5, maxZ: 3.5 },
    spawn: { x: 0, z: 0.8 },
    obstacles: [
      { id: 'keke_tricycle', label: 'Yellow Keke NAPEP', minX: -2.7, maxX: -0.9, minZ: -1.8, maxZ: 0.6 },
      { id: 'bole_cart', label: 'Roasted Bole & Fish Cart', minX: 1.4, maxX: 2.8, minZ: -1.6, maxZ: -0.4 },
      { id: 'billboard_posts', label: 'Billboard Posts', minX: -2.0, maxX: 2.0, minZ: -3.6, maxZ: -2.7 },
      { id: 'gist_crates', label: 'Roundabout Gist Crates', minX: 1.5, maxX: 2.9, minZ: 1.1, maxZ: 2.5 },
    ],
    hotspots: [
      {
        id: 'keke',
        label: 'Yellow Keke NAPEP Tricycle',
        icon: '🚖',
        prompt: 'Board Keke (-₦200)',
        description: 'Hop inside the iconic yellow and black Keke NAPEP for quick transit (-₦200, +12 Respect)',
        x: -0.6,
        z: -0.6,
        moneyDelta: -200,
        statDeltas: { respect: 12 },
        poseReaction: 'hustle',
        sound: 'coin',
      },
      {
        id: 'bole',
        label: 'Mama Joy\'s Roasted Bole & Fish',
        icon: '🐟',
        prompt: 'Chop Warm Bole & Fish',
        description: 'Hot spicy roasted plantain with peppered titus fish fresh off the coals (-₦500, -40 Hunger, +15 Mood)',
        x: 1.0,
        z: -1.0,
        moneyDelta: -500,
        statDeltas: { hunger: -40, mood: 15 },
        poseReaction: 'groove',
        sound: 'eat',
      },
      {
        id: 'billboard',
        label: 'Street Pride Billboard',
        icon: '⚡',
        prompt: 'Read Street Billboard',
        description: '"WARRI NO DEY CARRY LAST!" Pure Delta street motivation (+15 Mood, +10 Respect)',
        x: 0,
        z: -2.3,
        statDeltas: { mood: 15, respect: 10 },
        poseReaction: 'proud',
        sound: 'fanfare',
      },
      {
        id: 'gist',
        label: 'Junction Area Gist Corner',
        icon: '👥',
        prompt: 'Drop Gist with Boys',
        description: 'Throw street slang and exchange current updates with the roundabout squad (+12 Respect, +6 Energy)',
        x: 1.2,
        z: 1.8,
        statDeltas: { respect: 12, energy: 6 },
        poseReaction: 'wave',
        sound: 'click',
      },
    ],
  },
};

export const WORLD_NPCS: Record<WorldLocationId, WorldNpcDef[]> = {
  living_room: [
    {
      id: 'npc_chidi',
      name: 'Chidi',
      role: 'Compound Tech Neighbour',
      icon: '👨🏾‍💻',
      dialogueLines: [
        'Bros! Remote design gig dey pay well when light steady.',
        'If NEPA take light, my power bank still get two bars.',
      ],
      statDeltas: { mood: 8, respect: 5 },
      avatarConfig: {
        gender: 'male',
        name: 'Chidi',
        skinTone: '#5e3829',
        outfitStyle: 'senator',
        outfitColor: '#1e3a8a',
        accentColor: '#fde047',
        hairStyle: 'fade',
        hairColor: '#111827',
        sunglasses: true,
        goldChain: true,
        coralBeads: false,
        wristwatch: true,
        earrings: false,
      },
      startX: -0.7,
      startZ: 0.4,
      startRotY: 0,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -0.7, z: 0.4 },
        { x: 0.9, z: 0.4 },
        { x: 0.9, z: -0.9 },
        { x: -0.7, z: -0.2 },
      ],
      patrolSpeed: 1.05,
    },
    {
      id: 'npc_bisi',
      name: 'Aunty Bisi',
      role: 'Udu Compound Caretaker',
      icon: '👩🏾',
      dialogueLines: [
        'Welcome back! Make sure you lock compound gate by 10pm o.',
        'Landlord say people wey pay rent early go get peace of mind!',
      ],
      statDeltas: { respect: 6, mood: 6 },
      avatarConfig: {
        gender: 'female',
        name: 'Aunty Bisi',
        skinTone: '#3f261d',
        outfitStyle: 'ankara',
        outfitColor: '#c2410c',
        accentColor: '#fef08a',
        hairStyle: 'gele',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: false,
        coralBeads: true,
        wristwatch: true,
        earrings: true,
      },
      startX: -1.3,
      startZ: 2.2,
      startRotY: Math.PI / 2,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -1.3, z: 2.2 },
        { x: 1.3, z: 2.2 },
      ],
      patrolSpeed: 1.0,
    },
  ],

  church: [
    {
      id: 'npc_tega',
      name: 'Brother Tega',
      role: 'Sanctuary Head Usher',
      icon: '🤵🏾',
      dialogueLines: [
        'Happy Sunday! God bless your hustle in Warri this week.',
        'Walk down the red carpet aisle, your testimony dey loud!',
      ],
      statDeltas: { mood: 10, respect: 8 },
      avatarConfig: {
        gender: 'male',
        name: 'Brother Tega',
        skinTone: '#5e3829',
        outfitStyle: 'senator',
        outfitColor: '#0d5c3a',
        accentColor: '#f59e0b',
        hairStyle: 'fade',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: false,
        coralBeads: false,
        wristwatch: true,
        earrings: false,
      },
      startX: 0.45,
      startZ: 2.4,
      startRotY: Math.PI,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: 0.45, z: 2.4 },
        { x: 0.45, z: -0.9 },
        { x: -0.45, z: -0.9 },
        { x: -0.45, z: 2.4 },
      ],
      patrolSpeed: 1.25,
    },
    {
      id: 'npc_kevwe',
      name: 'Sister Kevwe',
      role: 'Praise & Choir Leader',
      icon: '🎤',
      dialogueLines: [
        'When Warri choir raise praise song, nobody fit sit down!',
        'Keep dancing! Joy dey bring open doors!',
      ],
      statDeltas: { mood: 14, respect: 6 },
      avatarConfig: {
        gender: 'female',
        name: 'Sister Kevwe',
        skinTone: '#7d4c35',
        outfitStyle: 'ankara',
        outfitColor: '#831843',
        accentColor: '#fbbf24',
        hairStyle: 'gele',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: false,
        coralBeads: true,
        wristwatch: true,
        earrings: true,
      },
      startX: -1.1,
      startZ: -1.25,
      startRotY: 0,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -1.1, z: -1.25 },
        { x: 1.1, z: -1.25 },
      ],
      patrolSpeed: 1.1,
    },
    {
      id: 'npc_martha',
      name: 'Deaconess Martha',
      role: 'Chapel Mother',
      icon: '👑',
      dialogueLines: [
        'My pikin, grace go follow you from Effurun to Main Market!',
        'No let street wahala spoil your joy.',
      ],
      statDeltas: { mood: 12, heat: -10 },
      avatarConfig: {
        gender: 'female',
        name: 'Deaconess Martha',
        skinTone: '#3f261d',
        outfitStyle: 'owambe',
        outfitColor: '#f8fafc',
        accentColor: '#d97706',
        hairStyle: 'gele',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: true,
        coralBeads: true,
        wristwatch: true,
        earrings: true,
      },
      startX: -2.4,
      startZ: 2.6,
      startRotY: Math.PI / 2,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -2.4, z: 2.6 },
        { x: 2.4, z: 2.6 },
      ],
      patrolSpeed: 1.05,
    },
    {
      id: 'npc_pastor_osas',
      name: 'Pastor Osas',
      role: 'Senior Chapel Minister',
      icon: '🕊️',
      dialogueLines: [
        'Receive double favour for your market table dream!',
        'Everything your hand touch in Delta State shall prosper!',
      ],
      statDeltas: { mood: 15, respect: 10, heat: -12 },
      avatarConfig: {
        gender: 'male',
        name: 'Pastor Osas',
        skinTone: '#2c1b18',
        outfitStyle: 'owambe',
        outfitColor: '#f8fafc',
        accentColor: '#f59e0b',
        hairStyle: 'fila',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: true,
        coralBeads: true,
        wristwatch: true,
        earrings: false,
      },
      startX: 0,
      startZ: -1.35,
      startRotY: 0,
      defaultPose: 'wave',
    },
  ],

  market: [
    {
      id: 'npc_elder_mine',
      name: 'Elder Mine',
      role: 'Market Union Chairman',
      icon: '👑',
      affinityId: 'chief_oghenemine',
      dialogueLines: [
        'I dey inspect all stalls today. Keep your hustle clean and steady!',
        'Once your ₦12,000 deposit ready, your own market table dey wait.',
      ],
      statDeltas: { respect: 14, mood: 6 },
      avatarConfig: {
        gender: 'male',
        name: 'Elder Mine',
        skinTone: '#2c1b18',
        outfitStyle: 'owambe',
        outfitColor: '#0d5c3a',
        accentColor: '#f59e0b',
        hairStyle: 'fila',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: true,
        coralBeads: true,
        wristwatch: true,
        earrings: false,
      },
      startX: -0.45,
      startZ: 2.7,
      startRotY: Math.PI,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -0.45, z: 2.7 },
        { x: -0.45, z: -2.5 },
        { x: 0.45, z: -2.5 },
        { x: 0.45, z: 2.7 },
      ],
      patrolSpeed: 1.3,
    },
    {
      id: 'npc_mama_tonye',
      name: 'Mama Tonye',
      role: 'Provision & Tomato Queen',
      icon: '🍅',
      affinityId: 'mama_tonye',
      dialogueLines: [
        'Customer! Fresh pepper and tomato just land from Ughelli!',
        'Shine your eye well for Warri Main Market o!',
      ],
      statDeltas: { respect: 10, mood: 8 },
      avatarConfig: {
        gender: 'female',
        name: 'Mama Tonye',
        skinTone: '#5e3829',
        outfitStyle: 'ankara',
        outfitColor: '#c2410c',
        accentColor: '#fef08a',
        hairStyle: 'gele',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: false,
        coralBeads: true,
        wristwatch: true,
        earrings: true,
      },
      startX: -0.8,
      startZ: -0.25,
      startRotY: 0,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -0.8, z: -0.25 },
        { x: -2.6, z: -0.25 },
        { x: -0.8, z: 0.55 },
      ],
      patrolSpeed: 1.15,
    },
    {
      id: 'npc_blessing',
      name: 'Blessing Stitches',
      role: 'Aso-Ebi Fashion Designer',
      icon: '👗',
      affinityId: 'blessing_tailor',
      dialogueLines: [
        'I dey price new lace and Ankara fabric for Saturday owambe!',
        'Your drip sharp well well! Warri fashion no get rival.',
      ],
      statDeltas: { mood: 12, respect: 8 },
      avatarConfig: {
        gender: 'female',
        name: 'Blessing Stitches',
        skinTone: '#9e6443',
        outfitStyle: 'ankara',
        outfitColor: '#1e3a8a',
        accentColor: '#fde047',
        hairStyle: 'braids',
        hairColor: '#111827',
        sunglasses: true,
        goldChain: true,
        coralBeads: false,
        wristwatch: true,
        earrings: true,
      },
      startX: 0.85,
      startZ: -0.4,
      startRotY: 0,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: 0.85, z: -0.4 },
        { x: 0.85, z: 2.5 },
        { x: -0.6, z: 2.5 },
        { x: 0.85, z: 0.4 },
      ],
      patrolSpeed: 1.38,
    },
    {
      id: 'npc_caro',
      name: 'Sisi Caro',
      role: 'Market Shopper & Trader',
      icon: '🛍️',
      dialogueLines: [
        'Network dey fast for this POS corner today!',
        'If you buy bulk early morning, profit go plenty.',
      ],
      statDeltas: { mood: 8, respect: 6 },
      avatarConfig: {
        gender: 'female',
        name: 'Sisi Caro',
        skinTone: '#7d4c35',
        outfitStyle: 'ankara',
        outfitColor: '#0d5c3a',
        accentColor: '#f59e0b',
        hairStyle: 'puff',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: false,
        coralBeads: true,
        wristwatch: false,
        earrings: true,
      },
      startX: -2.5,
      startZ: -2.6,
      startRotY: Math.PI / 2,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -2.5, z: -2.6 },
        { x: 0.9, z: -2.6 },
        { x: 0.9, z: -0.5 },
      ],
      patrolSpeed: 1.25,
    },
  ],

  junction: [
    {
      id: 'npc_ejiro',
      name: 'Ejiro',
      role: 'Keke Rider & Street Plug',
      icon: '🚖',
      affinityId: 'ejiro',
      dialogueLines: [
        'Effurun Roundabout dey hot! Enter my Keke make we move sharp!',
        'Anytime traffic lock PTI road, I sabi the fastest shortcut.',
      ],
      statDeltas: { respect: 12, mood: 10 },
      avatarConfig: {
        gender: 'male',
        name: 'Ejiro',
        skinTone: '#5e3829',
        outfitStyle: 'casual',
        outfitColor: '#1f2937',
        accentColor: '#10b981',
        hairStyle: 'fila',
        hairColor: '#111827',
        sunglasses: true,
        goldChain: true,
        coralBeads: false,
        wristwatch: true,
        earrings: false,
      },
      startX: -0.55,
      startZ: 0.9,
      startRotY: Math.PI,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -0.55, z: 0.9 },
        { x: -0.55, z: -1.8 },
        { x: 0.35, z: -1.8 },
        { x: 0.35, z: 0.9 },
      ],
      patrolSpeed: 1.45,
    },
    {
      id: 'npc_kpako',
      name: 'Bros Kpako',
      role: 'Effurun Area Youth Leader',
      icon: '🔥',
      dialogueLines: [
        'Warri no dey carry last! I see your hustle for this junction, respect!',
        'Greet the boys well and nobody go give you wahala.',
      ],
      statDeltas: { respect: 14, heat: -8 },
      avatarConfig: {
        gender: 'male',
        name: 'Bros Kpako',
        skinTone: '#2c1b18',
        outfitStyle: 'senator',
        outfitColor: '#831843',
        accentColor: '#fbbf24',
        hairStyle: 'afro',
        hairColor: '#111827',
        sunglasses: true,
        goldChain: true,
        coralBeads: false,
        wristwatch: true,
        earrings: false,
      },
      startX: -2.4,
      startZ: 2.4,
      startRotY: Math.PI / 2,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -2.4, z: 2.4 },
        { x: 1.1, z: 2.4 },
        { x: 1.1, z: -2.0 },
        { x: -2.4, z: 1.3 },
      ],
      patrolSpeed: 1.5,
    },
    {
      id: 'npc_mama_joy',
      name: 'Mama Joy',
      role: 'Roasted Bole & Fish Queen',
      icon: '🐟',
      dialogueLines: [
        'Hot bole and peppered titus fish just commot from fire o!',
        'Chop belleful make you get strength for afternoon hustle!',
      ],
      statDeltas: { mood: 10, energy: 6 },
      avatarConfig: {
        gender: 'female',
        name: 'Mama Joy',
        skinTone: '#5e3829',
        outfitStyle: 'ankara',
        outfitColor: '#c2410c',
        accentColor: '#fef08a',
        hairStyle: 'bun',
        hairColor: '#111827',
        sunglasses: false,
        goldChain: false,
        coralBeads: true,
        wristwatch: false,
        earrings: true,
      },
      startX: 1.05,
      startZ: -0.2,
      startRotY: -Math.PI / 2,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: 1.05, z: -0.2 },
        { x: 1.05, z: -1.9 },
        { x: 0.45, z: -1.0 },
      ],
      patrolSpeed: 1.1,
    },
    {
      id: 'npc_dj_kevwe',
      name: 'DJ Kevwe',
      role: 'Street Mixtape Promoter',
      icon: '🎧',
      dialogueLines: [
        'New Delta Afrobeat mixtape dey burst speaker across Effurun!',
        'Saturday owambe go loud pass generator!',
      ],
      statDeltas: { mood: 15, respect: 6 },
      avatarConfig: {
        gender: 'male',
        name: 'DJ Kevwe',
        skinTone: '#7d4c35',
        outfitStyle: 'casual',
        outfitColor: '#1e3a8a',
        accentColor: '#fde047',
        hairStyle: 'dreads',
        hairColor: '#111827',
        sunglasses: true,
        goldChain: true,
        coralBeads: false,
        wristwatch: true,
        earrings: true,
      },
      startX: -2.5,
      startZ: -2.2,
      startRotY: 0,
      defaultPose: 'walk',
      patrolWaypoints: [
        { x: -2.5, z: -2.2 },
        { x: 1.1, z: -2.2 },
      ],
      patrolSpeed: 1.35,
    },
  ],
};

export interface BuiltWorldScene {
  group: THREE.Group;
  hotspots: WorldHotspot[];
  obstacles: WorldObstacle[];
  npcs: BuiltWorldNpc[];
  boundary: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; z: number };
  update: (delta: number, time: number, playerX?: number, playerZ?: number) => void;
  dispose: () => void;
}

export function buildWorldScene(locationId: WorldLocationId): BuiltWorldScene {
  const config = WORLD_LOCATIONS[locationId] || WORLD_LOCATIONS.living_room;
  const group = new THREE.Group();

  const materialsToDispose: THREE.Material[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];

  function makeMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial(params);
    materialsToDispose.push(mat);
    return mat;
  }

  function makeGeom<T extends THREE.BufferGeometry>(geom: T): T {
    geometriesToDispose.push(geom);
    return geom;
  }

  // Animation hooks for props (e.g. fan blades, candles, smoke)
  const animators: ((delta: number, time: number) => void)[] = [];

  // ----------------------------------------------------
  // 1. LIVING ROOM SCENE
  // ----------------------------------------------------
  if (locationId === 'living_room') {
    // Floor: Linoleum wood boards
    const floorMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(8, 8)),
      makeMat({ color: 0x543310, roughness: 0.5, metalness: 0.05 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    // African Delta Patterned Rug
    const rugMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(4.2, 3.2)),
      makeMat({ color: 0x9a3412, roughness: 0.9 })
    );
    rugMesh.rotation.x = -Math.PI / 2;
    rugMesh.position.set(0, 0.005, 0.2);
    rugMesh.receiveShadow = true;
    group.add(rugMesh);

    // Rug border stripe
    const rugBorder = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(4.4, 3.4)),
      makeMat({ color: 0xf59e0b, roughness: 0.8 })
    );
    rugBorder.rotation.x = -Math.PI / 2;
    rugBorder.position.set(0, 0.003, 0.2);
    group.add(rugBorder);

    // Walls
    const wallMat = makeMat({ color: 0xfef3c7, roughness: 0.85 });
    const backWall = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(8, 3.5, 0.2)), wallMat);
    backWall.position.set(0, 1.75, -4);
    group.add(backWall);

    const leftWall = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.2, 3.5, 8)), wallMat);
    leftWall.position.set(-4, 1.75, 0);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.2, 3.5, 8)), wallMat);
    rightWall.position.set(4, 1.75, 0);
    group.add(rightWall);

    // Window with Outside Sun / Night View
    const windowFrame = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.25, 1.5, 1.8)),
      makeMat({ color: 0x78350f, roughness: 0.6 })
    );
    windowFrame.position.set(-3.9, 2.0, -1);
    group.add(windowFrame);

    const windowGlass = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(1.6, 1.3)),
      makeMat({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.5, roughness: 0.1 })
    );
    windowGlass.rotation.y = Math.PI / 2;
    windowGlass.position.set(-3.76, 2.0, -1);
    group.add(windowGlass);

    // Comfortable Parlor Sofa
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-2.2, 0, -1.2);
    sofaGroup.rotation.y = Math.PI / 4;

    const sofaBase = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(1.8, 0.45, 0.85)),
      makeMat({ color: 0x065f46, roughness: 0.7 })
    );
    sofaBase.position.y = 0.25;
    sofaBase.castShadow = true;
    sofaGroup.add(sofaBase);

    const sofaBack = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(1.8, 0.65, 0.25)),
      makeMat({ color: 0x047857, roughness: 0.7 })
    );
    sofaBack.position.set(0, 0.65, -0.3);
    sofaGroup.add(sofaBack);

    // Cushions
    const cushionMat = makeMat({ color: 0xf59e0b, roughness: 0.6 });
    const cushion1 = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.35, 0.35, 0.1)), cushionMat);
    cushion1.position.set(-0.5, 0.5, -0.15);
    cushion1.rotation.x = -0.2;
    sofaGroup.add(cushion1);

    const cushion2 = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.35, 0.35, 0.1)), cushionMat);
    cushion2.position.set(0.5, 0.5, -0.15);
    cushion2.rotation.x = -0.2;
    sofaGroup.add(cushion2);
    group.add(sofaGroup);

    // TV Table & Classic CRT Television
    const tvGroup = new THREE.Group();
    tvGroup.position.set(1.8, 0, -2.4);
    tvGroup.rotation.y = -Math.PI / 6;

    const tvTable = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(1.4, 0.6, 0.7)),
      makeMat({ color: 0x451a03, roughness: 0.7 })
    );
    tvTable.position.y = 0.3;
    tvTable.castShadow = true;
    tvGroup.add(tvTable);

    // CRT TV Body
    const crtBody = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.8, 0.65, 0.6)),
      makeMat({ color: 0x1f2937, roughness: 0.4 })
    );
    crtBody.position.y = 0.95;
    crtBody.castShadow = true;
    tvGroup.add(crtBody);

    // Glowing CRT Screen
    const crtScreen = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(0.65, 0.48)),
      makeMat({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.8, roughness: 0.2 })
    );
    crtScreen.position.set(0, 0.95, 0.305);
    tvGroup.add(crtScreen);

    // Rabbit-ear Antenna
    const ant1 = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.008, 0.008, 0.45)),
      makeMat({ color: 0xd1d5db, metalness: 0.8 })
    );
    ant1.position.set(-0.15, 1.45, 0);
    ant1.rotation.z = -0.4;
    tvGroup.add(ant1);

    const ant2 = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.008, 0.008, 0.45)),
      makeMat({ color: 0xd1d5db, metalness: 0.8 })
    );
    ant2.position.set(0.15, 1.45, 0);
    ant2.rotation.z = 0.4;
    tvGroup.add(ant2);
    group.add(tvGroup);

    // "I pass my neighbor" Tiger Generator in Corner
    const genGroup = new THREE.Group();
    genGroup.position.set(2.6, 0, 1.8);
    genGroup.rotation.y = -Math.PI / 4;

    const genBase = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.7, 0.5, 0.5)),
      makeMat({ color: 0xd97706, roughness: 0.4, metalness: 0.5 }) // Tiger yellow/orange
    );
    genBase.position.y = 0.25;
    genGroup.add(genBase);

    const genTank = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 12)),
      makeMat({ color: 0xb45309, metalness: 0.6 })
    );
    genTank.rotation.z = Math.PI / 2;
    genTank.position.y = 0.52;
    genGroup.add(genTank);

    const genPullCord = new THREE.Mesh(
      makeGeom(new THREE.TorusGeometry(0.06, 0.015, 8, 16)),
      makeMat({ color: 0x111827 })
    );
    genPullCord.position.set(0.36, 0.3, 0);
    genGroup.add(genPullCord);
    group.add(genGroup);

    // Standing Fan
    const fanGroup = new THREE.Group();
    fanGroup.position.set(-2.6, 0, 1.8);

    const fanBase = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.25, 0.28, 0.06, 16)),
      makeMat({ color: 0x1e293b })
    );
    fanBase.position.y = 0.03;
    fanGroup.add(fanBase);

    const fanPole = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.025, 0.025, 1.3)),
      makeMat({ color: 0x94a3b8, metalness: 0.8 })
    );
    fanPole.position.y = 0.68;
    fanGroup.add(fanPole);

    const fanCage = new THREE.Mesh(
      makeGeom(new THREE.TorusGeometry(0.25, 0.02, 8, 20)),
      makeMat({ color: 0x1e293b })
    );
    fanCage.position.y = 1.35;
    fanGroup.add(fanCage);

    const fanBlade = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.42, 0.08, 0.02)),
      makeMat({ color: 0x0284c7 })
    );
    fanBlade.position.y = 1.35;
    fanGroup.add(fanBlade);

    animators.push((delta) => {
      fanBlade.rotation.z += delta * 15;
    });
    group.add(fanGroup);
  }

  // ----------------------------------------------------
  // 2. CHURCH SCENE
  // ----------------------------------------------------
  if (locationId === 'church') {
    // Floor: Polished white/gray marble
    const floorMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(8, 8)),
      makeMat({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.1 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    // Red Carpet Aisle
    const aisleMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(1.6, 8)),
      makeMat({ color: 0x991b1b, roughness: 0.8 })
    );
    aisleMesh.rotation.x = -Math.PI / 2;
    aisleMesh.position.set(0, 0.005, 0);
    aisleMesh.receiveShadow = true;
    group.add(aisleMesh);

    // Sanctuary Arch Walls
    const wallMat = makeMat({ color: 0xf1f5f9, roughness: 0.7 });
    const backWall = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(8, 4.5, 0.2)), wallMat);
    backWall.position.set(0, 2.25, -4);
    group.add(backWall);

    const leftWall = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.2, 4.5, 8)), wallMat);
    leftWall.position.set(-4, 2.25, 0);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.2, 4.5, 8)), wallMat);
    rightWall.position.set(4, 2.25, 0);
    group.add(rightWall);

    // Glowing Golden Cross
    const crossMat = makeMat({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.8,
    });
    const crossV = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.22, 1.8, 0.08)), crossMat);
    crossV.position.set(0, 2.7, -3.88);
    group.add(crossV);

    const crossH = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(1.1, 0.22, 0.08)), crossMat);
    crossH.position.set(0, 3.0, -3.88);
    group.add(crossH);

    // Raised Altar Platform
    const altarStage = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(5.2, 0.25, 2.2)),
      makeMat({ color: 0x7f1d1d, roughness: 0.5 })
    );
    altarStage.position.set(0, 0.125, -2.8);
    altarStage.receiveShadow = true;
    group.add(altarStage);

    // Pulpit / Preacher Podium
    const pulpit = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.7, 0.9, 0.5)),
      makeMat({ color: 0xd97706, roughness: 0.3, metalness: 0.2 })
    );
    pulpit.position.set(0, 0.65, -2.6);
    pulpit.castShadow = true;
    group.add(pulpit);

    // Pulpit Microphone
    const micPole = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.015, 0.015, 0.45)),
      makeMat({ color: 0x94a3b8, metalness: 0.9 })
    );
    micPole.position.set(0.12, 1.25, -2.55);
    micPole.rotation.z = -0.2;
    group.add(micPole);

    // Sanctuary Wooden Pews (Left and Right of Aisle)
    const pewMat = makeMat({ color: 0x78350f, roughness: 0.6 });
    const pewPositions = [
      { x: -2.3, z: -0.6 },
      { x: -2.3, z: 0.6 },
      { x: -2.3, z: 1.8 },
      { x: 2.3, z: -0.6 },
      { x: 2.3, z: 0.6 },
      { x: 2.3, z: 1.8 },
    ];

    pewPositions.forEach((pos) => {
      const pewGroup = new THREE.Group();
      pewGroup.position.set(pos.x, 0, pos.z);

      // Bench seat
      const seat = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(1.6, 0.08, 0.45)), pewMat);
      seat.position.y = 0.38;
      seat.castShadow = true;
      pewGroup.add(seat);

      // Bench back
      const back = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(1.6, 0.5, 0.06)), pewMat);
      back.position.set(0, 0.65, -0.2);
      pewGroup.add(back);

      // Legs
      const legL = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.08, 0.38, 0.45)), pewMat);
      legL.position.set(-0.72, 0.19, 0);
      pewGroup.add(legL);

      const legR = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.08, 0.38, 0.45)), pewMat);
      legR.position.set(0.72, 0.19, 0);
      pewGroup.add(legR);

      group.add(pewGroup);
    });

    // Stained Glass Panels on Side Walls
    const glassColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];
    glassColors.forEach((color, idx) => {
      const panel = new THREE.Mesh(
        makeGeom(new THREE.PlaneGeometry(0.8, 1.6)),
        makeMat({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.1 })
      );
      panel.rotation.y = Math.PI / 2;
      panel.position.set(-3.88, 2.4, -2.5 + idx * 1.6);
      group.add(panel);

      const panelR = new THREE.Mesh(
        makeGeom(new THREE.PlaneGeometry(0.8, 1.6)),
        makeMat({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.1 })
      );
      panelR.rotation.y = -Math.PI / 2;
      panelR.position.set(3.88, 2.4, -2.5 + idx * 1.6);
      group.add(panelR);
    });
  }

  // ----------------------------------------------------
  // 3. MARKET SCENE
  // ----------------------------------------------------
  if (locationId === 'market') {
    // Ground: Packed market earth / paving stone
    const floorMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(8, 8)),
      makeMat({ color: 0x78350f, roughness: 0.9 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    // Stone pathway in center
    const pathMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(2.0, 8)),
      makeMat({ color: 0xa8a29e, roughness: 0.75 })
    );
    pathMesh.rotation.x = -Math.PI / 2;
    pathMesh.position.set(0, 0.005, 0);
    pathMesh.receiveShadow = true;
    group.add(pathMesh);

    // Market Stall 1: Mama Ejiro's Tomato & Pepper Stall (Left)
    const stall1 = new THREE.Group();
    stall1.position.set(-2.0, 0, -1.2);

    // Wooden Table
    const tableMat = makeMat({ color: 0x92400e, roughness: 0.8 });
    const tableTop = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(1.6, 0.1, 1.0)), tableMat);
    tableTop.position.y = 0.7;
    tableTop.castShadow = true;
    stall1.add(tableTop);

    // Legs
    const tableLegs = [
      [-0.7, 0.35, -0.4],
      [0.7, 0.35, -0.4],
      [-0.7, 0.35, 0.4],
      [0.7, 0.35, 0.4],
    ];
    tableLegs.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.08, 0.7, 0.08)), tableMat);
      leg.position.set(x, y, z);
      stall1.add(leg);
    });

    // Tomato Baskets & Scotch Bonnets
    const tomatoMat = makeMat({ color: 0xdc2626, roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const basket = new THREE.Mesh(
        makeGeom(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 10)),
        makeMat({ color: 0xd97706, roughness: 0.9 })
      );
      basket.position.set(-0.5 + (i % 3) * 0.35, 0.8, -0.25 + Math.floor(i / 3) * 0.4);
      stall1.add(basket);

      const tomatoes = new THREE.Mesh(makeGeom(new THREE.SphereGeometry(0.12, 8, 8)), tomatoMat);
      tomatoes.position.copy(basket.position);
      tomatoes.position.y += 0.06;
      stall1.add(tomatoes);
    }

    // Giant Red & Yellow Market Umbrella
    const umbrellaPole = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.04, 0.04, 2.4)),
      makeMat({ color: 0x475569 })
    );
    umbrellaPole.position.set(0, 1.2, 0);
    stall1.add(umbrellaPole);

    const umbrellaCanopy = new THREE.Mesh(
      makeGeom(new THREE.ConeGeometry(1.4, 0.5, 12, 1, true)),
      makeMat({ color: 0xdc2626, side: THREE.DoubleSide })
    );
    umbrellaCanopy.position.set(0, 2.3, 0);
    stall1.add(umbrellaCanopy);
    group.add(stall1);

    // Market Stall 2: POS Cash & Drinks Kiosk (Right)
    const stall2 = new THREE.Group();
    stall2.position.set(2.2, 0, -1.5);

    // Kiosk Booth
    const kioskMat = makeMat({ color: 0x0284c7, roughness: 0.6 });
    const kioskBody = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(1.5, 2.2, 1.2)), kioskMat);
    kioskBody.position.y = 1.1;
    kioskBody.castShadow = true;
    stall2.add(kioskBody);

    // POS Cash Signboard
    const signMat = makeMat({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    const signMesh = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(1.3, 0.35, 0.05)), signMat);
    signMesh.position.set(0, 1.9, 0.62);
    stall2.add(signMesh);

    // Counter Shelf
    const counterMesh = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(1.4, 0.1, 0.4)),
      makeMat({ color: 0xffffff })
    );
    counterMesh.position.set(0, 1.0, 0.65);
    stall2.add(counterMesh);

    // POS Machine
    const posDevice = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.18, 0.08, 0.28)),
      makeMat({ color: 0x111827, roughness: 0.2 })
    );
    posDevice.position.set(0.2, 1.1, 0.65);
    stall2.add(posDevice);
    group.add(stall2);

    // Colorful Hanging Flags overhead
    const flagMat1 = makeMat({ color: 0x10b981, side: THREE.DoubleSide });
    const flagMat2 = makeMat({ color: 0xfbbf24, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const flag = new THREE.Mesh(
        makeGeom(new THREE.PlaneGeometry(0.35, 0.45)),
        i % 2 === 0 ? flagMat1 : flagMat2
      );
      flag.position.set(-2.5 + i * 0.8, 2.6 + Math.sin(i * 0.7) * 0.15, -0.2);
      group.add(flag);
    }
  }

  // ----------------------------------------------------
  // 4. JUNCTION & STREET SCENE
  // ----------------------------------------------------
  if (locationId === 'junction') {
    // Road: Dark asphalt
    const roadMesh = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(8, 8)),
      makeMat({ color: 0x18181b, roughness: 0.85 })
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // White Center Line Dashes
    const dashMat = makeMat({ color: 0xffffff, roughness: 0.4 });
    for (let i = -3; i <= 3; i += 1.5) {
      const dash = new THREE.Mesh(makeGeom(new THREE.PlaneGeometry(0.18, 0.8)), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.005, i);
      dash.receiveShadow = true;
      group.add(dash);
    }

    // Concrete Sidewalk Curb on Right
    const curb = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(2.4, 0.2, 8)),
      makeMat({ color: 0x71717a, roughness: 0.8 })
    );
    curb.position.set(2.8, 0.1, 0);
    curb.receiveShadow = true;
    group.add(curb);

    // Detailed 3D Yellow Keke NAPEP Tricycle (Left Curb)
    const kekeGroup = new THREE.Group();
    kekeGroup.position.set(-1.8, 0, -0.6);
    kekeGroup.rotation.y = Math.PI / 5;

    // Keke Main Yellow Cabin
    const kekeCabin = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(1.2, 0.9, 1.8)),
      makeMat({ color: 0xfacc15, roughness: 0.35, metalness: 0.1 })
    );
    kekeCabin.position.y = 0.65;
    kekeCabin.castShadow = true;
    kekeGroup.add(kekeCabin);

    // Black Canvas Roof
    const kekeRoof = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(1.24, 0.12, 1.84)),
      makeMat({ color: 0x18181b, roughness: 0.8 })
    );
    kekeRoof.position.y = 1.15;
    kekeGroup.add(kekeRoof);

    // Windshield Frame
    const windshield = new THREE.Mesh(
      makeGeom(new THREE.PlaneGeometry(0.9, 0.5)),
      makeMat({ color: 0x38bdf8, roughness: 0.1, opacity: 0.7, transparent: true })
    );
    windshield.position.set(0, 0.8, -0.91);
    kekeGroup.add(windshield);

    // Wheels (Front and 2 Back)
    const wheelMat = makeMat({ color: 0x09090b, roughness: 0.9 });
    const wheelGeom = makeGeom(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16));

    const frontWheel = new THREE.Mesh(wheelGeom, wheelMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, 0.2, -0.85);
    kekeGroup.add(frontWheel);

    const backWheelL = new THREE.Mesh(wheelGeom, wheelMat);
    backWheelL.rotation.z = Math.PI / 2;
    backWheelL.position.set(-0.62, 0.2, 0.6);
    kekeGroup.add(backWheelL);

    const backWheelR = new THREE.Mesh(wheelGeom, wheelMat);
    backWheelR.rotation.z = Math.PI / 2;
    backWheelR.position.set(0.62, 0.2, 0.6);
    kekeGroup.add(backWheelR);
    group.add(kekeGroup);

    // Bole & Fish Charcoal Grill Stand (Right Sidewalk)
    const boleGroup = new THREE.Group();
    boleGroup.position.set(2.1, 0, -1.0);

    const grillBase = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(0.9, 0.7, 0.6)),
      makeMat({ color: 0x3f3f46, roughness: 0.8, metalness: 0.3 })
    );
    grillBase.position.y = 0.35;
    boleGroup.add(grillBase);

    // Glowing Charcoal
    const coalMat = makeMat({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9,
      roughness: 0.9,
    });
    const coals = new THREE.Mesh(makeGeom(new THREE.BoxGeometry(0.8, 0.05, 0.5)), coalMat);
    coals.position.y = 0.72;
    boleGroup.add(coals);

    // Roasted Plantains & Fish
    const plantainMat = makeMat({ color: 0xd97706, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const plantain = new THREE.Mesh(
        makeGeom(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8)),
        plantainMat
      );
      plantain.rotation.z = Math.PI / 2;
      plantain.position.set(-0.25 + i * 0.25, 0.78, 0);
      boleGroup.add(plantain);
    }
    group.add(boleGroup);

    // Billboard: "⚡ WARRI NO DEY CARRY LAST"
    const billboard = new THREE.Group();
    billboard.position.set(0, 0, -3.2);

    const post1 = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.06, 0.06, 3.2)),
      makeMat({ color: 0x52525b, metalness: 0.7 })
    );
    post1.position.set(-1.6, 1.6, 0);
    billboard.add(post1);

    const post2 = new THREE.Mesh(
      makeGeom(new THREE.CylinderGeometry(0.06, 0.06, 3.2)),
      makeMat({ color: 0x52525b, metalness: 0.7 })
    );
    post2.position.set(1.6, 1.6, 0);
    billboard.add(post2);

    const boardMesh = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(3.6, 1.4, 0.1)),
      makeMat({
        color: 0x0f172a,
        emissive: 0x0d5c3a,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      })
    );
    boardMesh.position.set(0, 2.3, 0);
    billboard.add(boardMesh);

    // Yellow Accent Border on Billboard
    const boardBorder = new THREE.Mesh(
      makeGeom(new THREE.BoxGeometry(3.7, 1.5, 0.08)),
      makeMat({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 })
    );
    boardBorder.position.set(0, 2.3, -0.02);
    billboard.add(boardBorder);
    group.add(billboard);
  }

  // ----------------------------------------------------
  // Hotspot Ground Rings & Visual Markers
  // ----------------------------------------------------
  const ringGroup = new THREE.Group();
  group.add(ringGroup);

  config.hotspots.forEach((spot) => {
    // Ground glowing pulsing ring
    const ringMat = makeMat({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
    });
    const ringMesh = new THREE.Mesh(
      makeGeom(new THREE.RingGeometry(0.35, 0.45, 24)),
      ringMat
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(spot.x, 0.015, spot.z);
    ringGroup.add(ringMesh);

    // Floating pulsing diamond marker
    const diamondMat = makeMat({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.7,
    });
    const diamond = new THREE.Mesh(makeGeom(new THREE.OctahedronGeometry(0.12)), diamondMat);
    diamond.position.set(spot.x, 1.1, spot.z);
    group.add(diamond);

    animators.push((_delta, time) => {
      diamond.rotation.y = time * 2;
      diamond.position.y = 1.1 + Math.sin(time * 3 + spot.x) * 0.08;
      ringMat.opacity = 0.5 + Math.sin(time * 4 + spot.z) * 0.3;
    });
  });

  // ----------------------------------------------------
  // Spawn Walking & Interactive 3D People (NPCs)
  // ----------------------------------------------------
  const npcDefs = WORLD_NPCS[locationId] || [];
  const builtNpcs: BuiltWorldNpc[] = [];
  const npcRings: THREE.Mesh[] = [];

  function lerpNpcAngle(a: number, b: number, t: number): number {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    const wrapped = diff < -Math.PI ? diff + Math.PI * 2 : diff;
    return a + wrapped * Math.min(1, t);
  }

  npcDefs.forEach((npcDef) => {
    const npcRig = build3DAvatar(npcDef.avatarConfig, { showPedestal: false });
    npcRig.root.position.set(npcDef.startX, 0, npcDef.startZ);
    npcRig.root.rotation.y = npcDef.startRotY;
    group.add(npcRig.root);

    // Emerald ground ring beneath each walking person
    const npcRingMat = makeMat({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
    });
    const npcRingMesh = new THREE.Mesh(
      makeGeom(new THREE.RingGeometry(0.32, 0.41, 24)),
      npcRingMat
    );
    npcRingMesh.rotation.x = -Math.PI / 2;
    npcRingMesh.position.set(npcDef.startX, 0.014, npcDef.startZ);
    group.add(npcRingMesh);
    npcRings.push(npcRingMesh);

    builtNpcs.push({
      def: npcDef,
      rig: npcRig,
      x: npcDef.startX,
      z: npcDef.startZ,
      rotY: npcDef.startRotY,
      waypointIdx: 1,
      reactionPose: null,
      reactionTimer: 0,
      dialogueIndex: 0,
    });
  });

  const update = (delta: number, time: number, playerX?: number, playerZ?: number) => {
    animators.forEach((fn) => fn(delta, time));

    builtNpcs.forEach((npc, idx) => {
      const distToPlayer =
        playerX !== undefined && playerZ !== undefined
          ? Math.hypot(playerX - npc.x, playerZ - npc.z)
          : 999;

      let activePose: string = npc.def.defaultPose;

      if (npc.reactionTimer > 0) {
        npc.reactionTimer -= delta;
        activePose = npc.reactionPose || 'groove';
        if (playerX !== undefined && playerZ !== undefined) {
          const angleToPlayer = Math.atan2(playerX - npc.x, playerZ - npc.z);
          npc.rotY = lerpNpcAngle(npc.rotY, angleToPlayer, 10 * delta);
        }
      } else if (distToPlayer < 1.35 && playerX !== undefined && playerZ !== undefined) {
        // Pause walking & greet player when player walks up to them
        const angleToPlayer = Math.atan2(playerX - npc.x, playerZ - npc.z);
        npc.rotY = lerpNpcAngle(npc.rotY, angleToPlayer, 8 * delta);
        activePose = npc.def.defaultPose === 'walk' ? 'wave' : npc.def.defaultPose;
      } else if (npc.def.patrolWaypoints && npc.def.patrolWaypoints.length > 1) {
        // Walk smoothly along patrol waypoints
        const waypoints = npc.def.patrolWaypoints;
        const target = waypoints[npc.waypointIdx % waypoints.length];
        const dx = target.x - npc.x;
        const dz = target.z - npc.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.12) {
          npc.waypointIdx = (npc.waypointIdx + 1) % waypoints.length;
        } else {
          const speed = npc.def.patrolSpeed || 1.25;
          const step = Math.min(dist, speed * delta);
          npc.x += (dx / dist) * step;
          npc.z += (dz / dist) * step;
          const moveAngle = Math.atan2(dx, dz);
          npc.rotY = lerpNpcAngle(npc.rotY, moveAngle, 9 * delta);
        }
        activePose = 'walk';
      } else {
        npc.rotY = lerpNpcAngle(npc.rotY, npc.def.startRotY, 4 * delta);
      }

      npc.rig.root.position.set(npc.x, 0, npc.z);
      npc.rig.root.rotation.y = npc.rotY;
      npc.rig.update(delta, time + idx * 1.37, activePose, 88);

      const ringMesh = npcRings[idx];
      if (ringMesh) {
        ringMesh.position.set(npc.x, 0.014, npc.z);
      }
    });
  };

  const dispose = () => {
    builtNpcs.forEach((n) => n.rig.dispose());
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
  };

  return {
    group,
    hotspots: config.hotspots,
    obstacles: config.obstacles,
    npcs: builtNpcs,
    boundary: config.boundary,
    spawn: config.spawn,
    update,
    dispose,
  };
}
