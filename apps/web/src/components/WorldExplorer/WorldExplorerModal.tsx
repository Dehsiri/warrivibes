'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { build3DAvatar, AvatarRig } from '../Avatar3D/AvatarModelBuilder';
import {
  buildWorldScene,
  resolveMovement,
  WorldLocationId,
  WORLD_LOCATIONS,
  WORLD_NPCS,
  WorldHotspot,
  BuiltWorldNpc,
} from './WorldScenes';
import { WorldControls } from './WorldControls';
import { WarriGoogleMap } from '../GoogleMap/WarriGoogleMap';
import { playSound } from '../../utils/sound';
import { AvatarConfig, DEFAULT_MALE_AVATAR } from '../../types/avatar';
import styles from './WorldExplorerModal.module.css';

const WORLD_TO_MAP_ID: Record<WorldLocationId, string> = {
  living_room: 'udu_home',
  church: 'garden_park',
  market: 'warri_market',
  junction: 'effurun',
};

const MAP_TO_WORLD_ID: Record<string, WorldLocationId> = {
  udu_home: 'living_room',
  garden_park: 'church',
  warri_market: 'market',
  effurun: 'junction',
};

// Shortest angle lerp helper
function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  const wrapped = diff < -Math.PI ? diff + Math.PI * 2 : diff;
  return a + wrapped * Math.min(1, t);
}

export function WorldExplorerModal() {
  const { state, setActiveModal, interactWorld } = useGameStore();

  const initialWorldLoc: WorldLocationId =
    MAP_TO_WORLD_ID[state.location] || 'living_room';

  const [activeLocation, setActiveLocation] = useState<WorldLocationId>(initialWorldLoc);
  const [activeHotspot, setActiveHotspot] = useState<WorldHotspot | null>(null);
  const [showGoogleMap, setShowGoogleMap] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [speedModeLabel, setSpeedModeLabel] = useState<'IDLE' | 'WALK' | 'SPRINT' | 'JUMP'>('IDLE');
  const [npcSpeech, setNpcSpeech] = useState<{
    icon: string;
    name: string;
    role: string;
    text: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeNpcRef = useRef<BuiltWorldNpc | null>(null);
  const builtNpcsRef = useRef<BuiltWorldNpc[]>([]);
  const speechTimerRef = useRef<any>(null);

  const moveVectorRef = useRef<{ x: number; z: number; isRunning: boolean }>({
    x: 0,
    z: 0,
    isRunning: true,
  });

  const avatarPosRef = useRef<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    rotY: number;
  }>({
    x: WORLD_LOCATIONS[initialWorldLoc].spawn.x,
    y: 0,
    z: WORLD_LOCATIONS[initialWorldLoc].spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    rotY: Math.PI,
  });

  // 360° Camera Orbit State
  const cameraOrbitRef = useRef<{
    yaw: number;
    pitch: number;
    distance: number;
    isDragging: boolean;
    lastX: number;
    lastY: number;
  }>({
    yaw: 0,
    pitch: 0.58,
    distance: 4.1,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const reactionPoseRef = useRef<'idle' | 'walk' | 'run' | 'jump' | 'groove' | 'wave' | 'proud' | 'hustle'>('idle');
  const reactionTimerRef = useRef<any>(null);

  const currentLocMeta = WORLD_LOCATIONS[activeLocation];
  const currentLocationNpcs = WORLD_NPCS[activeLocation] || [];
  const avatarConfig = (state.flags.avatar as AvatarConfig) || DEFAULT_MALE_AVATAR;

  // Toggle Native Browser Full Screen
  const toggleBrowserFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Handle 3D Jump
  const handleJump = useCallback(() => {
    if (avatarPosRef.current.y <= 0.03) {
      avatarPosRef.current.vy = 5.4;
      playSound.click();
    }
  }, []);

  // Handle Hotspot or Walking NPC Interaction
  const handleInteract = useCallback(() => {
    if (!activeHotspot) return;

    // Check if interacting with a walking 3D NPC
    if (activeNpcRef.current && activeHotspot.id.startsWith('npc_talk_')) {
      const npc = activeNpcRef.current;
      playSound.fanfare();

      const lines = npc.def.dialogueLines;
      const line = lines[npc.dialogueIndex % lines.length];
      npc.dialogueIndex = (npc.dialogueIndex + 1) % lines.length;
      npc.reactionPose = 'groove';
      npc.reactionTimer = 3.0;

      reactionPoseRef.current = 'wave';
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = setTimeout(() => {
        reactionPoseRef.current = 'idle';
      }, 2200);

      setNpcSpeech({
        icon: npc.def.icon,
        name: npc.def.name,
        role: npc.def.role,
        text: line,
      });
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      speechTimerRef.current = setTimeout(() => {
        setNpcSpeech(null);
      }, 5000);

      interactWorld(
        `Talked with ${npc.def.name}`,
        npc.def.statDeltas || { mood: 8, respect: 5 },
        npc.def.moneyDelta,
        `${npc.def.icon} ${npc.def.name}: "${line}"`
      );
      return;
    }

    if (activeHotspot.sound === 'coin') playSound.coin();
    else if (activeHotspot.sound === 'alert') playSound.alert();
    else if (activeHotspot.sound === 'click') playSound.click();
    else if (activeHotspot.sound === 'eat') playSound.eat();
    else playSound.fanfare();

    if (activeHotspot.poseReaction) {
      reactionPoseRef.current = activeHotspot.poseReaction;
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = setTimeout(() => {
        reactionPoseRef.current = 'idle';
      }, 2400);
    }

    interactWorld(
      activeHotspot.label,
      activeHotspot.statDeltas || {},
      activeHotspot.moneyDelta,
      `${activeHotspot.icon} ${activeHotspot.label}: ${activeHotspot.description}`
    );
  }, [activeHotspot, interactWorld]);

  // Handle Location Switch
  const switchLocation = (locId: WorldLocationId) => {
    if (locId === activeLocation) return;
    playSound.click();
    setActiveLocation(locId);
    setActiveHotspot(null);
    setNpcSpeech(null);
    const targetSpawn = WORLD_LOCATIONS[locId].spawn;
    avatarPosRef.current = {
      x: targetSpawn.x,
      y: 0,
      z: targetSpawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: Math.PI,
    };
    cameraOrbitRef.current.yaw = 0;
  };

  // Walk / Teleport next to a specific person in the current scene
  const walkToPerson = (npcId: string) => {
    const targetNpc = builtNpcsRef.current.find((n) => n.def.id === npcId);
    if (!targetNpc) return;
    playSound.click();
    avatarPosRef.current.x = targetNpc.x;
    avatarPosRef.current.z = Math.min(currentLocMeta.boundary.maxZ - 0.4, targetNpc.z + 0.75);
    avatarPosRef.current.rotY = Math.PI;
    targetNpc.reactionPose = 'wave';
    targetNpc.reactionTimer = 2.8;
    const line = targetNpc.def.dialogueLines[0];
    setNpcSpeech({
      icon: targetNpc.def.icon,
      name: targetNpc.def.name,
      role: targetNpc.def.role,
      text: line,
    });
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setNpcSpeech(null);
    }, 4500);
  };

  // Three.js Render & 3D Movement Loop Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || window.innerWidth || 360;
    const height = container.clientHeight || window.innerHeight || 640;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(currentLocMeta.skyColor);
    scene.fog = new THREE.FogExp2(currentLocMeta.skyColor, 0.042);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 90);
    const spawn = currentLocMeta.spawn;
    camera.position.set(spawn.x, 3.2, spawn.z + 4.1);
    camera.lookAt(spawn.x, 0.95, spawn.z);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(
      currentLocMeta.ambientColor,
      currentLocMeta.ambientIntensity
    );
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(
      currentLocMeta.dirLightColor,
      currentLocMeta.dirLightIntensity
    );
    dirLight.position.set(...currentLocMeta.dirLightPos);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 5. Build Location Environment Scene (including walking 3D NPCs)
    const worldScene = buildWorldScene(activeLocation);
    builtNpcsRef.current = worldScene.npcs;
    scene.add(worldScene.group);

    // 6. Build Controllable 3D Avatar (without studio pedestal)
    const rig: AvatarRig = build3DAvatar(avatarConfig, { showPedestal: false });
    rig.root.position.set(spawn.x, 0, spawn.z);
    rig.root.rotation.y = avatarPosRef.current.rotY;
    scene.add(rig.root);

    // 7. Sprint Dust Trail Particle Pool
    const dustCount = 18;
    const dustGroup = new THREE.Group();
    const dustGeom = new THREE.SphereGeometry(0.06, 8, 8);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.65,
    });
    const dustPuffs: {
      mesh: THREE.Mesh;
      life: number;
      maxLife: number;
      vy: number;
    }[] = [];

    for (let i = 0; i < dustCount; i++) {
      const m = new THREE.Mesh(dustGeom, dustMat.clone());
      m.visible = false;
      dustGroup.add(m);
      dustPuffs.push({ mesh: m, life: 0, maxLife: 0.45, vy: 0.6 });
    }
    scene.add(dustGroup);

    let dustSpawnTimer = 0;
    const spawnDustPuff = (x: number, z: number, scaleBoost = 1) => {
      const slot = dustPuffs.find((p) => p.life <= 0);
      if (!slot) return;
      slot.life = slot.maxLife;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        x + (Math.random() - 0.5) * 0.24,
        0.06,
        z + (Math.random() - 0.5) * 0.24
      );
      slot.mesh.scale.setScalar(0.7 * scaleBoost);
    };

    // 8. Animation & 3D Physics Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let prevMode: 'IDLE' | 'WALK' | 'SPRINT' | 'JUMP' = 'IDLE';

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      const moveVec = moveVectorRef.current;
      const inputMag = Math.hypot(moveVec.x, moveVec.z);
      const isMoving = inputMag > 0.05;

      // Speed: 4.5 u/s when Running/Sprinting, 2.3 u/s when Walking
      const targetSpeed = moveVec.isRunning ? 4.5 : 2.3;

      // Rotate input vector relative to 3D Camera Orbit Yaw
      const camYaw = cameraOrbitRef.current.yaw;
      const cosY = Math.cos(camYaw);
      const sinY = Math.sin(camYaw);
      const worldDirX = moveVec.x * cosY + moveVec.z * sinY;
      const worldDirZ = -moveVec.x * sinY + moveVec.z * cosY;

      const targetVx = isMoving ? worldDirX * targetSpeed : 0;
      const targetVz = isMoving ? worldDirZ * targetSpeed : 0;

      // Smooth 3D velocity acceleration & deceleration
      const accel = isMoving ? 14 : 18;
      avatarPosRef.current.vx = THREE.MathUtils.lerp(
        avatarPosRef.current.vx,
        targetVx,
        Math.min(1, accel * delta)
      );
      avatarPosRef.current.vz = THREE.MathUtils.lerp(
        avatarPosRef.current.vz,
        targetVz,
        Math.min(1, accel * delta)
      );

      const currentSpeed = Math.hypot(
        avatarPosRef.current.vx,
        avatarPosRef.current.vz
      );

      if (currentSpeed > 0.04) {
        const deltaX = avatarPosRef.current.vx * delta;
        const deltaZ = avatarPosRef.current.vz * delta;
        const resolved = resolveMovement(
          avatarPosRef.current.x,
          avatarPosRef.current.z,
          deltaX,
          deltaZ,
          0.32,
          worldScene.obstacles,
          worldScene.boundary
        );

        avatarPosRef.current.x = resolved.x;
        avatarPosRef.current.z = resolved.z;

        if (isMoving) {
          const targetAngle = Math.atan2(worldDirX, worldDirZ);
          avatarPosRef.current.rotY = lerpAngle(
            avatarPosRef.current.rotY,
            targetAngle,
            15 * delta
          );
        }
      }

      // Vertical 3D Jump & Gravity Physics
      if (avatarPosRef.current.y > 0 || avatarPosRef.current.vy !== 0) {
        avatarPosRef.current.y += avatarPosRef.current.vy * delta;
        avatarPosRef.current.vy -= 16.5 * delta;
        if (avatarPosRef.current.y <= 0) {
          avatarPosRef.current.y = 0;
          avatarPosRef.current.vy = 0;
          spawnDustPuff(avatarPosRef.current.x, avatarPosRef.current.z, 1.4);
        }
      }

      const isAirborne = avatarPosRef.current.y > 0.03;

      // Spawn sprint dust puffs when running on the ground
      if (isMoving && moveVec.isRunning && !isAirborne) {
        dustSpawnTimer += delta;
        if (dustSpawnTimer >= 0.09) {
          dustSpawnTimer = 0;
          spawnDustPuff(avatarPosRef.current.x, avatarPosRef.current.z, 1.0);
        }
      }

      // Update Dust Particles
      for (const p of dustPuffs) {
        if (p.life > 0) {
          p.life -= delta;
          if (p.life <= 0) {
            p.mesh.visible = false;
          } else {
            const ratio = p.life / p.maxLife;
            p.mesh.position.y += p.vy * delta;
            p.mesh.scale.setScalar((1 - ratio) * 1.4 + 0.4);
            (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.55;
          }
        }
      }

      // Sync 3D Avatar Root Position & Rotation
      rig.root.position.set(
        avatarPosRef.current.x,
        avatarPosRef.current.y,
        avatarPosRef.current.z
      );
      rig.root.rotation.y = avatarPosRef.current.rotY;

      // Select 3D Skeletal Pose: 'jump' | 'run' | 'walk' | reaction | 'idle'
      let currentPose: string = 'idle';
      let nextMode: 'IDLE' | 'WALK' | 'SPRINT' | 'JUMP' = 'IDLE';

      if (isAirborne) {
        currentPose = 'jump';
        nextMode = 'JUMP';
      } else if (isMoving) {
        currentPose = moveVec.isRunning ? 'run' : 'walk';
        nextMode = moveVec.isRunning ? 'SPRINT' : 'WALK';
      } else if (
        reactionPoseRef.current !== 'walk' &&
        reactionPoseRef.current !== 'run' &&
        reactionPoseRef.current !== 'jump'
      ) {
        currentPose = reactionPoseRef.current;
      }

      if (nextMode !== prevMode) {
        prevMode = nextMode;
        setSpeedModeLabel(nextMode);
      }

      rig.update(delta, time, currentPose, state.stats.energy);
      worldScene.update(
        delta,
        time,
        avatarPosRef.current.x,
        avatarPosRef.current.z
      );

      // Smooth 360° Third-Person Orbit Camera Following
      const orbit = cameraOrbitRef.current;
      const horizontalDist = orbit.distance * Math.cos(orbit.pitch);
      const verticalDist = orbit.distance * Math.sin(orbit.pitch);

      const targetCamX =
        avatarPosRef.current.x + Math.sin(orbit.yaw) * horizontalDist;
      const targetCamZ =
        avatarPosRef.current.z + Math.cos(orbit.yaw) * horizontalDist;
      const targetCamY = Math.max(
        1.1,
        avatarPosRef.current.y + 0.9 + verticalDist
      );

      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        targetCamX,
        9 * delta
      );
      camera.position.z = THREE.MathUtils.lerp(
        camera.position.z,
        targetCamZ,
        9 * delta
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        targetCamY,
        9 * delta
      );
      camera.lookAt(
        avatarPosRef.current.x,
        avatarPosRef.current.y + 0.95,
        avatarPosRef.current.z
      );

      // Check Distance to Walking 3D People (NPCs) AND Scene Hotspots
      let closestNpc: BuiltWorldNpc | null = null;
      let minNpcDist = 1.25;

      for (const npc of worldScene.npcs) {
        const dist = Math.hypot(
          avatarPosRef.current.x - npc.x,
          avatarPosRef.current.z - npc.z
        );
        if (dist < minNpcDist) {
          minNpcDist = dist;
          closestNpc = npc;
        }
      }

      if (closestNpc) {
        activeNpcRef.current = closestNpc;
        setActiveHotspot({
          id: `npc_talk_${closestNpc.def.id}`,
          label: `${closestNpc.def.name} (${closestNpc.def.role})`,
          icon: closestNpc.def.icon,
          prompt: `Talk to ${closestNpc.def.name}`,
          description: closestNpc.def.dialogueLines[0],
          x: closestNpc.x,
          z: closestNpc.z,
          statDeltas: closestNpc.def.statDeltas,
          moneyDelta: closestNpc.def.moneyDelta,
        });
      } else {
        activeNpcRef.current = null;
        let closestSpot: WorldHotspot | null = null;
        const minDistance = 1.2;

        for (const spot of worldScene.hotspots) {
          const dist = Math.hypot(
            avatarPosRef.current.x - spot.x,
            avatarPosRef.current.z - spot.z
          );
          if (dist < minDistance) {
            closestSpot = spot;
            break;
          }
        }
        setActiveHotspot(closestSpot);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Observer for Full-Screen Responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        const newH = entry.contentRect.height;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      scene.remove(rig.root);
      scene.remove(worldScene.group);
      scene.remove(dustGroup);
      dustGeom.dispose();
      dustPuffs.forEach((p) => (p.mesh.material as THREE.Material).dispose());
      rig.dispose();
      worldScene.dispose();
      renderer.dispose();
    };
  }, [activeLocation, avatarConfig, currentLocMeta, state.stats.energy]);

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        {/* Top Full-Screen Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <span className={styles.mainTitle}>
              <span>{currentLocMeta.icon}</span>
              <span>{currentLocMeta.name}</span>
            </span>
            <span className={styles.subTitle}>{currentLocMeta.tagline}</span>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.googleMapToggleBtn}
              onClick={toggleBrowserFullscreen}
              id="btn-toggle-fullscreen"
              title="Toggle Full Screen"
            >
              <span>{isFullscreen ? '🗗' : '⛶'}</span>
              <span>{isFullscreen ? 'Exit Full' : 'Full Screen'}</span>
            </button>

            <button
              type="button"
              className={`${styles.googleMapToggleBtn} ${showGoogleMap ? styles.googleMapToggleBtnActive : ''}`}
              onClick={() => {
                playSound.click();
                setShowGoogleMap((prev) => !prev);
              }}
              id="btn-toggle-world-google-map"
              aria-label="Toggle Google Map"
            >
              <span>🗺️</span>
              <span>{showGoogleMap ? '3D View' : 'Google Map'}</span>
            </button>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setActiveModal('none')}
              aria-label="Close 3D World"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Location Selector Tabs */}
        <div className={styles.locationTabs} role="tablist" aria-label="Select 3D Location">
          <button
            type="button"
            role="tab"
            aria-selected={activeLocation === 'living_room'}
            className={`${styles.locTab} ${activeLocation === 'living_room' ? styles.locTabActive : ''}`}
            onClick={() => switchLocation('living_room')}
          >
            <span>🛋️</span>
            <span>Living Room</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeLocation === 'church'}
            className={`${styles.locTab} ${activeLocation === 'church' ? styles.locTabActive : ''}`}
            onClick={() => switchLocation('church')}
          >
            <span>⛪</span>
            <span>Church</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeLocation === 'market'}
            className={`${styles.locTab} ${activeLocation === 'market' ? styles.locTabActive : ''}`}
            onClick={() => switchLocation('market')}
          >
            <span>🛍️</span>
            <span>Market</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeLocation === 'junction'}
            className={`${styles.locTab} ${activeLocation === 'junction' ? styles.locTabActive : ''}`}
            onClick={() => switchLocation('junction')}
          >
            <span>🚖</span>
            <span>Effurun Junction</span>
          </button>
        </div>

        {/* People Walking Here Bar (Tap any person to walk up & greet them) */}
        <div className={styles.peopleRosterBar} aria-label="People in this location">
          <span className={styles.peopleLabel}>
            👥 People Here ({currentLocationNpcs.length}):
          </span>
          {currentLocationNpcs.map((npc) => (
            <button
              key={npc.id}
              type="button"
              className={styles.personChip}
              onClick={() => walkToPerson(npc.id)}
              title={`Walk up to ${npc.name} (${npc.role})`}
            >
              <span>{npc.icon}</span>
              <span>{npc.name}</span>
            </button>
          ))}
        </div>

        {/* Full-Screen 3D Viewport with 360° Touch/Mouse Orbit */}
        <div
          ref={containerRef}
          className={styles.viewportContainer}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
            cameraOrbitRef.current.isDragging = true;
            cameraOrbitRef.current.lastX = e.clientX;
            cameraOrbitRef.current.lastY = e.clientY;
          }}
          onPointerMove={(e) => {
            if (!cameraOrbitRef.current.isDragging) return;
            const dx = e.clientX - cameraOrbitRef.current.lastX;
            const dy = e.clientY - cameraOrbitRef.current.lastY;
            cameraOrbitRef.current.lastX = e.clientX;
            cameraOrbitRef.current.lastY = e.clientY;
            cameraOrbitRef.current.yaw -= dx * 0.007;
            cameraOrbitRef.current.pitch = Math.max(
              0.2,
              Math.min(1.15, cameraOrbitRef.current.pitch + dy * 0.005)
            );
          }}
          onPointerUp={() => {
            cameraOrbitRef.current.isDragging = false;
          }}
          onPointerCancel={() => {
            cameraOrbitRef.current.isDragging = false;
          }}
          onWheel={(e) => {
            cameraOrbitRef.current.distance = Math.max(
              2.4,
              Math.min(6.2, cameraOrbitRef.current.distance + e.deltaY * 0.003)
            );
          }}
        >
          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Top HUD: Character Name, Speed Telemetry & Camera Hint */}
          <div className={styles.overlayStatus}>
            <div className={styles.statPill}>
              <span>{avatarConfig.gender === 'male' ? '👨🏾' : '👩🏾'}</span>
              <span>{avatarConfig.name}</span>
              <span>·</span>
              <span style={{ color: '#fbbf24' }}>⚡ {state.stats.energy}%</span>
              <span>·</span>
              <span
                style={{
                  color:
                    speedModeLabel === 'SPRINT'
                      ? '#34d399'
                      : speedModeLabel === 'JUMP'
                      ? '#38bdf8'
                      : '#cbd5e1',
                }}
              >
                {speedModeLabel === 'SPRINT'
                  ? '🏃 RUNNING'
                  : speedModeLabel === 'JUMP'
                  ? '🦘 JUMPING'
                  : speedModeLabel === 'WALK'
                  ? '🚶 WALKING'
                  : '🧍 IDLE'}
              </span>
            </div>

            <div className={styles.controlsTip}>
              <span>🕹️ Drag screen to rotate 3D camera · Walk near people to chat</span>
            </div>
          </div>

          {/* Live NPC Speech Bubble */}
          {npcSpeech && (
            <div className={styles.npcSpeechBubble} role="status">
              <span className={styles.npcSpeechIcon}>{npcSpeech.icon}</span>
              <div className={styles.npcSpeechContent}>
                <span className={styles.npcSpeechHeader}>
                  {npcSpeech.name} · {npcSpeech.role}
                </span>
                <span className={styles.npcSpeechText}>“{npcSpeech.text}”</span>
              </div>
            </div>
          )}

          {/* Virtual 8-Way D-Pad / Stick, Run Toggle, 3D Jump & Hotspot Trigger */}
          <WorldControls
            activeHotspot={activeHotspot}
            onMoveVectorChange={(vec) => {
              moveVectorRef.current = vec;
            }}
            onJump={handleJump}
            onInteract={handleInteract}
          />

          {/* Interactive Google Map Drawer Overlay inside 3D World */}
          {showGoogleMap && (
            <div className={styles.googleMapDrawer}>
              <div className={styles.googleMapDrawerHeader}>
                <div className={styles.googleMapDrawerTitle}>
                  <span>🗺️</span>
                  <span>Warri & Effurun GPS Map (Tap pin to teleport 3D Avatar)</span>
                </div>
                <button
                  type="button"
                  className={styles.return3DBtn}
                  onClick={() => setShowGoogleMap(false)}
                >
                  🚶 Back to 3D
                </button>
              </div>

              <WarriGoogleMap
                currentLocationId={WORLD_TO_MAP_ID[activeLocation]}
                selectedLocationId={WORLD_TO_MAP_ID[activeLocation]}
                allowSelectCurrent
                height={260}
                onSelectLocation={(mapLocId) => {
                  const target3D = MAP_TO_WORLD_ID[mapLocId];
                  if (target3D) {
                    switchLocation(target3D);
                    setShowGoogleMap(false);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
