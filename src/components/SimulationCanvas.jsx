import React, { useRef, useEffect, useState } from 'react';
import { Human } from '../simulation/Human';
import { Base } from '../simulation/Base';

// Вспомогательные функции для воды 
const pointInEllipse = (px, py, cx, cy, a, b, angle) => {
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r1 = (dx * cos + dy * sin) / a;
  const r2 = (-dx * sin + dy * cos) / b;
  return r1 * r1 + r2 * r2 <= 1.2;
};

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
};

const pointNearRiver = (px, py, points, thickness) => {
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(px, py, points[i].x, points[i].y, points[i+1].x, points[i+1].y);
    if (d <= thickness / 2 + 4) return true;
  }
  return false;
};

const segIntersect = (p1, p2, p3, p4) => {
  const x1=p1.x, y1=p1.y, x2=p2.x, y2=p2.y;
  const x3=p3.x, y3=p3.y, x4=p4.x, y4=p4.y;
  const denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
  if (denom === 0) return null;
  const t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / denom;
  const u = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3)) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: x1 + t*(x2-x1), y: y1 + t*(y2-y1) };
  }
  return null;
};

const checkWaterBody = (x, y, lakes, rivers, bridges) => {
  for (let l of lakes) {
    if (pointInEllipse(x, y, l.x, l.y, l.a, l.b, l.angle)) return true;
  }
  let inRiver = false;
  for (let riv of rivers) {
    if (pointNearRiver(x, y, riv.points, riv.thickness)) {
      inRiver = true;
      break;
    }
  }
  if (inRiver) {
    for (let b of bridges) {
      const dx = x - b.x;
      const dy = y - b.y;
      const cos = Math.cos(-b.angle);
      const sin = Math.sin(-b.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      
      if (Math.abs(lx) <= 42 && Math.abs(ly) <= 42) return false; 
    }
    return true;
  }
  return false;
};
const pointInBridge = (px, py, bridges) => {
  for (let b of bridges) {
    const dx = px - b.x;
    const dy = py - b.y;
    const cos = Math.cos(-b.angle);
    const sin = Math.sin(-b.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= 42 && Math.abs(ly) <= 42) return true;
  }
  return false;
};
export default function SimulationCanvas({ initialPopulation }) {
  const canvasRef = useRef(null);
  const humansRef = useRef([]);
  const basesRef = useRef([]);
  const resourcesRef = useRef([]); 
  const nextIdRef = useRef(initialPopulation);
  const FIELD_SIZE = 1000;
  const [errorMessage, setErrorMessage] = useState(null);

  const waterRef = useRef({ lakes: [], rivers: [], bridges: [] });

  // Water banks generation toggle
  const [waterBanksChecked, setWaterBanksChecked] = useState(true);
  const generateWaterRef = useRef(true);

  // Zoom and Pan Refs
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Simulation settings states
  const [popInput, setPopInput] = useState(initialPopulation);
  const [simPopulation, setSimPopulation] = useState(initialPopulation);
  const [restartToken, setRestartToken] = useState(0); 

  const [uiState, setUiState] = useState({
    population: initialPopulation,
    colonies: [],
    humans: [] 
  });

  // Renaming bases and humans
  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    type: null, 
    id: null,
    oldName: '',
    newName: ''
  });
  
  const renameBase = (id, oldName) => {
    setRenameModal({
      isOpen: true,
      type: 'base',
      id,
      oldName,
      newName: oldName
    });
  };

  const renameHuman = (id, oldName) => {
    setRenameModal({
      isOpen: true,
      type: 'human',
      id,
      oldName,
      newName: oldName
    });
  };

  const handleSaveName = () => {
    const { type, id, newName } = renameModal;
    
    if (newName && newName.trim()) {
      if (type === 'base') {
        const base = basesRef.current.find(b => b.id === id);
        if (base) base.name = newName.trim();
      } else if (type === 'human') {
        const human = humansRef.current.find(h => h.id === id);
        if (human) human.name = newName.trim();
      }
    }
    setRenameModal({ isOpen: false, type: null, id: null, oldName: '', newName: '' });
  };

  const handleResetCamera = () => {
    zoomRef.current = 1.0;
    panRef.current = { x: 0, y: 0 };
  };
  
    const handleRestartSimulation = () => {
    if (popInput < 1 || popInput > 500 || isNaN(popInput)) {
      setErrorMessage("Initial population must be between 1 and 500.");
      return;
    }
    generateWaterRef.current = waterBanksChecked;
    setSimPopulation(popInput);
    setRestartToken(t => t + 1);
    handleResetCamera();
  };

function findNearestBridgeTowards(hx, hy, tx, ty, bridges) {
  if (!bridges || !Array.isArray(bridges) || bridges.length === 0 
  || typeof hx !== 'number' || typeof hy !== 'number')  return null;

  let best = null;
  let bestScore = Infinity;

  for (const b of bridges) {
    if (!b || typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.angle !== 'number') continue;

    // Shift angle by 90 degrees to get bank-to-bank nodes (sides b to d)
    const crossAngle = b.angle + Math.PI / 2;
    const cos = Math.cos(crossAngle);
    const sin = Math.sin(crossAngle);
    const halfLen = 30; 
    const treeSize = 2; 

    const end1 = { x: b.x + cos * (halfLen + crossSize), y: b.y + sin * (halfLen + crossSize) };
    const end2 = { x: b.x - cos * (halfLen + crossSize), y: b.y - sin * (halfLen + crossSize) };

    const dH1 = Math.hypot(end1.x - hx, end1.y - hy);
    const dT1 = Math.hypot(end1.x - tx, end1.y - ty);
    const score1 = dH1 + dT1 * 0.5;

    const dH2 = Math.hypot(end2.x - hx, end2.y - hy);
    const dT2 = Math.hypot(end2.x - tx, end2.y - ty);
    const score2 = dH2 + dT2 * 0.5;

    if (score1 < bestScore) {
      bestScore = score1;
      best = { entry: end1, exit: end2 };
    }
    if (score2 < bestScore) {
      bestScore = score2;
      best = { entry: end2, exit: end1 };
    }
  }

  return best;
}

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const isSafeSpawn = (x, y) => {
      return !checkWaterBody(x, y, waterRef.current.lakes, waterRef.current.rivers, []);
    };
    const generateWater = generateWaterRef.current;

    let rivers = [];
    let lakes = [];
    let bridges = [];
    if (generateWater) {
      // Генерация Рек 
      for (let i = 0; i < 2; i++) {
        const edge = Math.floor(Math.random() * 4);
        let x, y, tx, ty;
        if (edge === 0) { x = Math.random() * FIELD_SIZE; y = 0; tx = Math.random() * FIELD_SIZE; ty = FIELD_SIZE; }
        else if (edge === 1) { x = FIELD_SIZE; y = Math.random() * FIELD_SIZE; tx = 0; ty = Math.random() * FIELD_SIZE; }
        else if (edge === 2) { x = Math.random() * FIELD_SIZE; y = FIELD_SIZE; tx = Math.random() * FIELD_SIZE; ty = 0; }
        else { x = 0; y = Math.random() * FIELD_SIZE; tx = FIELD_SIZE; ty = Math.random() * FIELD_SIZE; }
        
        const points = [{x, y}];
        const steps = 5 + Math.floor(Math.random() * 4);
        const stepX = (tx - x) / steps;
        const stepY = (ty - y) / steps;
        for (let s = 1; s < steps; s++) {
          const wobble = 100;
          points.push({
            x: x + stepX * s + (Math.random() - 0.5) * wobble,
            y: y + stepY * s + (Math.random() - 0.5) * wobble
          });
        }
        points.push({x: tx, y: ty});
        const thickness = 15 + Math.random() * 10;
        rivers.push({ points, thickness });
      }

      // Генерация Озер (с проверкой дистанции до рек и других озер)
      for (let i = 0; i < 3; i++) {
        let valid = false, attempts = 0;
        let lx, ly, la, lb, lAngle;
        while (!valid && attempts < 50) {
          la = 35 + Math.random() * 70; 
          lb = 35 + Math.random() * 70;
          lx = 100 + Math.random() * (FIELD_SIZE - 200);
          ly = 100 + Math.random() * (FIELD_SIZE - 200);
          lAngle = Math.random() * Math.PI;
          
          valid = true;
          for(let riv of rivers) {
            if(pointNearRiver(lx, ly, riv.points, riv.thickness + 70)) valid = false; 
          }
          if(valid) {
            for(let l of lakes) {
              const d = Math.hypot(lx - l.x, ly - l.y);
              if (d < la + l.a + 70 || d < lb + l.b + 70) valid = false;
            }
          }
          attempts++;
        }
        if(valid) lakes.push({ x: lx, y: ly, a: la, b: lb, angle: lAngle });
      }

      // Генерация Мостов (с обработкой пересечений)
      for (let i = 0; i < rivers.length; i++) {
        const riv = rivers[i];
        const intersections = [];
        
        for (let j = 0; j < rivers.length; j++) {
          if (i === j) continue;
          const otherRiv = rivers[j];
          for (let k = 0; k < riv.points.length - 1; k++) {
            for (let l = 0; l < otherRiv.points.length - 1; l++) {
              const pt = segIntersect(riv.points[k], riv.points[k+1], otherRiv.points[l], otherRiv.points[l+1]);
              if (pt) intersections.push({ pt, segIdx: k });
            }
          }
        }
        
        if (intersections.length > 0) {
          intersections.forEach(({ pt, segIdx }) => {
            if (segIdx > 0) {
              const p1 = riv.points[segIdx - 1];
              const p2 = riv.points[segIdx];
              const bx = (p1.x + p2.x) / 2;
              const by = (p1.y + p2.y) / 2;
              if (!lakes.some(l => pointInEllipse(bx, by, l.x, l.y, l.a, l.b, l.angle))) {
                bridges.push({ x: bx, y: by, angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) });
              }
            }
            if (segIdx + 2 < riv.points.length) {
              const p1 = riv.points[segIdx + 1];
              const p2 = riv.points[segIdx + 2];
              const bx = (p1.x + p2.x) / 2;
              const by = (p1.y + p2.y) / 2;
              if (!lakes.some(l => pointInEllipse(bx, by, l.x, l.y, l.a, l.b, l.angle))) {
                bridges.push({ x: bx, y: by, angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) });
              }
            }
          });
        } else {
          const midIndex = 1 + Math.floor(Math.random() * (riv.points.length - 2));
          const p1 = riv.points[midIndex];
          const p2 = riv.points[midIndex + 1];
          const bx = (p1.x + p2.x) / 2;
          const by = (p1.y + p2.y) / 2;
          let validBridge = true;
          for(let l of lakes) {
            if (pointInEllipse(bx, by, l.x, l.y, l.a, l.b, l.angle)) validBridge = false;
          }
          for(let otherRiv of rivers) {
            if (otherRiv === riv) continue;
            if (pointNearRiver(bx, by, otherRiv.points, otherRiv.thickness + 5)) validBridge = false;
          }
          if(validBridge) {
            bridges.push({ x: bx, y: by, angle: Math.atan2(p2.y-p1.y, p2.x-p1.x) });
          }
        }
      }
    }
    waterRef.current = { lakes, rivers, bridges };

    // Инициализация Людей (только на безопасных клетках) 
    humansRef.current = Array.from({ length: simPopulation }, (_, i) => {
      let h = new Human(i, FIELD_SIZE);
      let attempts = 0;
      while (!isSafeSpawn(h.x, h.y) && attempts < 20) {
        h.x = Math.random() * (FIELD_SIZE - 20) + 10;
        h.y = Math.random() * (FIELD_SIZE - 20) + 10;
        attempts++;
      }
      return h;
    });

    basesRef.current = [];
    nextIdRef.current = simPopulation;

    const resources = [];
    const spawnResource = (type, amount) => {
      let x, y, valid, attempts = 0;
      const radius = type === 'stick' ? 2 : (type === 'tree' ? 6 : 10);
      
      do {
        x = Math.random() * (FIELD_SIZE - 20) + 10;
        y = Math.random() * (FIELD_SIZE - 20) + 10;
        valid = true;
        if (pointInBridge(x, y, bridges)) {
          valid = false;
          continue;
        }
        for (let r of resources) {
          const rRad = r.type === 'stick' ? 2 : (r.type === 'tree' ? 6 : 10);
          const dist = Math.sqrt(Math.pow(x - r.x, 2) + Math.pow(y - r.y, 2));
          if (dist < radius + rRad + 4) { valid = false; break; }
        }
        attempts++;
      } while (!valid && attempts < 50);

      resources.push({ id: Math.random(), type, amount, x, y, minerId: null, isSelected: false });
    };

    for (let i = 0; i < simPopulation; i++) {
      for (let s = 0; s < 5; s++) spawnResource('stick', 1);
      for (let t = 0; t < 3; t++) spawnResource('tree', 5);
      spawnResource('stone_vein', 20);
      if (i % 2 === 0) spawnResource('copper_vein', 50);  
    }

    // Очистка ресурсов от воды и мостов
    for (let i = resources.length - 1; i >= 0; i--) {
      const r = resources[i];
      if (checkWaterBody(r.x, r.y, lakes, rivers, bridges) || pointInBridge(r.x, r.y, bridges)) {
        resources.splice(i, 1);
      }
    }
    resourcesRef.current = resources;
    
    let animationId;
    let tickCount = 0; 

    const drawResourceTooltip = (ctx, res, fieldSize) => {
      const boxWidth = 220;
      const boxHeight = 85;
      
      const zoom = zoomRef.current;
      const pan = panRef.current;
      const screenX = res.x * zoom + pan.x;
      const screenY = res.y * zoom + pan.y;

      let boxX = screenX - boxWidth / 2;
      let boxY = screenY - boxHeight - 15;
      
      if (boxX < 10) boxX = 10;
      if (boxX + boxWidth > canvas.width - 10) boxX = canvas.width - boxWidth - 10;
      if (boxY < 10) boxY = screenY + 15;

      ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      
      const typeName = res.type.replace('_', ' ').toUpperCase();
      ctx.fillText(typeName, boxX + 12, boxY + 25);

      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#eeeeee';
      ctx.fillText(`Resources Left: ${res.amount}`, boxX + 12, boxY + 50);
      
      const status = res.minerId ? 'Being Mined' : 'Idle';
      ctx.fillStyle = res.minerId ? '#FFD700' : '#A0C4FF';
      ctx.fillText(`Status: ${status}`, boxX + 12, boxY + 75);
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, 0, FIELD_SIZE, FIELD_SIZE);

      // Отрисовка Озер 
      lakes.forEach(l => {
        ctx.beginPath();
        ctx.fillStyle = '#2196F3';
        ctx.ellipse(l.x, l.y, l.a, l.b, l.angle, 0, Math.PI * 2);
        ctx.fill();
      });

      // Отрисовка Рек 
      rivers.forEach(riv => {
        ctx.beginPath();
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = riv.thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(riv.points[0].x, riv.points[0].y);
        for (let i = 1; i < riv.points.length; i++) {
          ctx.lineTo(riv.points[i].x, riv.points[i].y);
        }
        ctx.stroke();
      });

      const currentHumans = humansRef.current;
      const currentBases = basesRef.current;
      
      resourcesRef.current = resourcesRef.current.filter(r => r.amount > 0);
      const currentResources = resourcesRef.current;

      currentBases.forEach(base => {
        const villageMembers = currentHumans.filter(h => h.communityId === base.id);
        
        const toolBonuses = { wood: 0, stone: 0, copper: 0 };
        villageMembers.forEach(({ tool }) => {
          if (tool in toolBonuses) {
            toolBonuses[tool]++;
          }
        });
        toolBonuses.wood = Math.min(toolBonuses.wood, 5);
        toolBonuses.stone = Math.min(toolBonuses.stone, 10);

        base.populationLimit = 4 + toolBonuses.wood + toolBonuses.stone + toolBonuses.copper;
        base.population = villageMembers.length;

        if (!base.replantWindowTimer || base.replantWindowTimer <= 0) {
          base.replantWindowTimer = 10800; 
          base.replantedThisPeriod = 0;
        } else {
          base.replantWindowTimer--;
        }
      });

      const unalignedHumans = currentHumans.filter(h => h.communityId === null && !h.isSelected);

      for (let i = 0; i < unalignedHumans.length; i++) {
        const primary = unalignedHumans[i];
        if (primary.communityId !== null) continue;
        const MIN_DIST = 70;

        const tooClose = currentBases.some(b => Math.hypot(b.x - primary.x, b.y - primary.y) < MIN_DIST);
        if (tooClose) continue;

        let nearbyHumans = [primary];
        for (let j = 0; j < unalignedHumans.length; j++) {
          if (i === j) continue;
          const other = unalignedHumans[j];    
          if (other.communityId !== null) continue;

          const dist = Math.hypot(primary.x - other.x, primary.y - other.y);
          if (dist < 40) nearbyHumans.push(other);
        }

        if (nearbyHumans.length < 4) continue;
        if (nearbyHumans.length > 6) {
          nearbyHumans = nearbyHumans.slice(0, 6);
        }

        const newCommunityId = Date.now() + i;
        let leader = nearbyHumans[0];

        for (let member of nearbyHumans) {
          member.communityId = newCommunityId;
          if (member.leaderScore > leader.leaderScore) leader = member;
        }
        leader.isLeader = true;
        const WATER_BUFFER = 30;
        let nearWater = false;
        const checkAngles = [0, 0.785, 1.571, 2.356, 3.142, 3.927, 4.712, 5.498];
        for (const angle of checkAngles) {
          const cx = leader.x + Math.cos(angle) * WATER_BUFFER;
          const cy = leader.y + Math.sin(angle) * WATER_BUFFER;
          if (checkWaterBody(cx, cy, lakes, rivers, bridges)) {
            nearWater = true;
            break;
          }
        }
        // Also check center
        if (!nearWater && checkWaterBody(leader.x, leader.y, lakes, rivers, bridges)) {
          nearWater = true;
        }

        // If near water, UNDO the community assignment and skip
        if (nearWater) {
          for (let member of nearbyHumans) {
            member.communityId = null;
            member.isLeader = false;
          }
          continue;
        }

        const newBase = new Base(newCommunityId, leader.x, leader.y, nearbyHumans.length);
        newBase.resources = { wood: 0, stone: 0, copper: 0, wood_tools: 0, stone_tools: 0, copper_tools: 0 };
        currentBases.push(newBase);

        const BASE_CLEAR_RADIUS = 35;
        resourcesRef.current = resourcesRef.current.filter(r => {
          const d = Math.hypot(r.x - leader.x, r.y - leader.y);
          return d > BASE_CLEAR_RADIUS;
        });
      }

      currentHumans.forEach(human => {
        if (!human.communityId || human.isLeader) return;
        const myBase = currentBases.find(b => b.id === human.communityId);
        if (!myBase) return;
        const leaderHuman = currentHumans.find(h => h.communityId === human.communityId && h.isLeader);

        if (
          human.gender === 'female' && 
          human.restTimer > 0 && 
          human.reproductionCooldown > 0 && 
          !human.currentTask && 
          myBase.replantedThisPeriod < 5
        ) {
          human.currentTask = 'replanting';
          human.restTimer = 0; 
          human.taskTimer = 180; 
          human.maxTaskTimer = 180;

          let rx, ry, valid, attempts = 0;
          const WATER_BUFFER = 25;
          do {
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 80;
            rx = myBase.x + Math.cos(angle) * dist;
            ry = myBase.y + Math.sin(angle) * dist;

            valid = true;
            if (rx < 10 || rx > FIELD_SIZE - 10 || ry < 10 || ry > FIELD_SIZE - 10) {
              valid = false;
              continue;
            }
            // Check if target is IN water
            if (checkWaterBody(rx, ry, lakes, rivers, [])) {
              valid = false;
              continue;
            }
            const bufferCheckPoints = [
              { x: rx - WATER_BUFFER, y: ry },
              { x: rx + WATER_BUFFER, y: ry },
              { x: rx, y: ry - WATER_BUFFER },
              { x: rx, y: ry + WATER_BUFFER },
              { x: rx - WATER_BUFFER * 0.7, y: ry - WATER_BUFFER * 0.7 },
              { x: rx + WATER_BUFFER * 0.7, y: ry - WATER_BUFFER * 0.7 },
              { x: rx - WATER_BUFFER * 0.7, y: ry + WATER_BUFFER * 0.7 },
              { x: rx + WATER_BUFFER * 0.7, y: ry + WATER_BUFFER * 0.7 }
            ];
            
            for (const point of bufferCheckPoints) {
              if (checkWaterBody(point.x, point.y, lakes, rivers, [])) {
                valid = false;
                break;
              }
            }
            
            if (!valid) continue;
            // Check that path from VILLAGER to target doesn't cross water
            if (valid) {
              const steps = 15;
              for (let s = 1; s < steps; s++) {
                const t = s / steps;
                const checkX = human.x + (rx - human.x) * t;
                const checkY = human.y + (ry - human.y) * t;
                if (checkWaterBody(checkX, checkY, lakes, rivers, bridges)) {
                  valid = false;
                  break;
                }
              }
            }
            
            if (valid) {
              for (let r of currentResources) {
                if (r.type === 'tree') {
                  const d = Math.hypot(rx - r.x, ry - r.y);
                  if (d < 30) { valid = false; break; }
                }
              }
            }
            attempts++;
          } while (!valid && attempts < 50);

          // If no valid spot found, don't assign the task
          if (valid && attempts < 50) {
            human.replantX = rx;
            human.replantY = ry;
            myBase.replantedThisPeriod++;
          } else {
            human.currentTask = null;
            human.restTimer = 300;
          }
          return;
        }
     
        currentHumans.forEach(h => {
          if (!h.isLeader || !h.communityId) return;
          const b = currentBases.find(base => base.id === h.communityId);
          if (!b) return;

          const dx = h.x - b.x;
          const dy = h.y - b.y;
          const dist = Math.hypot(dx, dy);
          const MAX_LEADER_DIST = 70;

          if (dist > MAX_LEADER_DIST) {
            h.x = b.x + (dx / dist) * MAX_LEADER_DIST;
            h.y = b.y + (dy / dist) * MAX_LEADER_DIST;

            const angleToBase = Math.atan2(-dy, -dx);
            const randomOffset = (Math.random() - 0.5) * 1.0; 
            const finalAngle = angleToBase + randomOffset;

            const currentSpeed = Math.hypot(h.vx || 0, h.vy || 0) || 1;
            h.vx = Math.cos(finalAngle) * currentSpeed;
            h.vy = Math.sin(finalAngle) * currentSpeed;
          }
        });
        
        if (human.restTimer > 0) return;

        if (human.currentTask === 'going_to_leader' && leaderHuman) {
          const distToLeader = Math.sqrt(Math.pow(human.x - leaderHuman.x, 2) + Math.pow(human.y - leaderHuman.y, 2));
          if (distToLeader <= 16) {
            const r = myBase.resources;
            let toolUpgradeAction = null;

            if (!human.tool && r.wood_tools > 0) {
              toolUpgradeAction = () => { human.tool = 'wood'; r.wood_tools--; };
            } else if (human.tool === 'wood' && r.stone_tools > 0) {
              toolUpgradeAction = () => { human.tool = 'stone'; r.stone_tools--; };
            } else if (human.tool === 'stone' && r.copper_tools > 0) {
              toolUpgradeAction = () => { human.tool = 'copper'; r.copper_tools--; };
            } else if (!human.tool && r.wood >= 8) {
              toolUpgradeAction = () => {
                r.wood -= 4;
                human.currentTask = 'crafting'; human.taskTimer = 1200; human.maxTaskTimer = 1200;
                human.tool = 'wood';
              };
            } else if (human.tool === 'wood' && r.wood >= 12 && r.stone >= 8) {
              toolUpgradeAction = () => {
                r.wood -= 4; r.stone -= 8;
                human.currentTask = 'crafting'; human.taskTimer = 1200; human.maxTaskTimer = 1200;
                human.tool = 'stone';
              };
            } else if (human.tool === 'stone' && r.copper >= 12 && r.wood >= 8) {
              toolUpgradeAction = () => {
                r.copper -= 8; r.wood -= 4;
                human.currentTask = 'crafting'; human.taskTimer = 1200; human.maxTaskTimer = 1200;
                human.tool = 'copper';
              };
            }

            if (toolUpgradeAction) {
              toolUpgradeAction();
              human.failedTaskAttempts = 0;  
              return;
            }

            const availableTypes = new Set(currentResources.map(res => res.type));
            const tool = human.tool;
            const needs = [];

            if (availableTypes.has('stick')) {
              const deficit = Math.max(0, 20 - r.wood);
              if (!tool) {
                needs.push({ type: 'stick', score: 100 });
              } else {
                needs.push({ type: 'stick', score: 20 + deficit }); 
              }
            }
            if (tool && availableTypes.has('tree')) {
              const deficit = Math.max(0, 20 - r.wood);
              needs.push({ type: 'tree', score: 10 + deficit });
            }
            if (tool && availableTypes.has('stone_vein')) {
              const deficit = Math.max(0, 16 - r.stone);
              needs.push({ type: 'stone_vein', score: 8 + deficit });
            }
            if ((tool === 'stone' || tool === 'copper') && availableTypes.has('copper_vein')) {
              const deficit = Math.max(0, 16 - r.copper);
              needs.push({ type: 'copper_vein', score: 8 + deficit });
            }

            needs.sort((a, b) => b.score - a.score);
            let targetType = needs.length > 0 ? needs[0].type : null;

            if (!targetType) {
              if (availableTypes.has('stick')) targetType = 'stick';
              else if (tool && availableTypes.has('tree')) targetType = 'tree';
              else if (tool && availableTypes.has('stone_vein')) targetType = 'stone_vein';
              else if ((tool === 'stone' || tool === 'copper') && availableTypes.has('copper_vein')) targetType = 'copper_vein';
            }

            if (targetType) {
              let nearestNode = null;
              let minDist = Infinity;
              currentResources.forEach(node => {
                if (node.minerId !== null && node.minerId !== human.id) return;
                if (node.type !== targetType) return;
                const RESOURCE_WATER_BUFFER = 25;
                const isNearWater = checkWaterBody(node.x, node.y, lakes, rivers, []) ||
                  checkWaterBody(node.x - RESOURCE_WATER_BUFFER, node.y, lakes, rivers, []) ||
                  checkWaterBody(node.x + RESOURCE_WATER_BUFFER, node.y, lakes, rivers, []) ||
                  checkWaterBody(node.x, node.y - RESOURCE_WATER_BUFFER, lakes, rivers, []) ||
                  checkWaterBody(node.x, node.y + RESOURCE_WATER_BUFFER, lakes, rivers, []);
                if (isNearWater) {
                  // Check if it's specifically on a bridge
                  let onBridge = false;
                  for (const b of bridges) {
                    const dx = node.x - b.x;
                    const dy = node.y - b.y;
                    const cos = Math.cos(-b.angle);
                    const sin = Math.sin(-b.angle);
                    const lx = dx * cos - dy * sin;
                    const ly = dx * sin + dy * cos;
                    if (Math.abs(lx) <= 42 && Math.abs(ly) <= 42) {
                      onBridge = true;
                      break;
                    }
                  }
                  // Only skip if near water but NOT on a bridge
                  if (!onBridge) return;
                }
                
                const d = Math.sqrt(Math.pow(human.x - node.x, 2) + Math.pow(human.y - node.y, 2));
                if (d < minDist) { minDist = d; nearestNode = node; }
              });

              if (nearestNode) {
                human.failedTaskAttempts = 0; 
                nearestNode.minerId = human.id;
                human.taskTarget = nearestNode;
                human.currentTask = 'gathering';
                if (nearestNode.type === 'stick') {
                  human.taskTimer = 60;
                } else if (nearestNode.type === 'tree') {
                  let baseSec = 1200;
                  if (human.tool === 'wood') baseSec *= 0.6;
                  if (human.tool === 'stone') baseSec *= 0.36;
                  if (human.tool === 'copper') baseSec *= 0.216;
                  human.taskTimer = Math.max(60, Math.floor(baseSec));
                } else {
                  let baseSec = 3600;
                  if (human.tool === 'stone') baseSec *= 0.6;
                  if (human.tool === 'copper') baseSec *= 0.36;
                  human.taskTimer = Math.max(60, Math.floor(baseSec));
                }
                human.maxTaskTimer = human.taskTimer;
              } else {
                human.currentTask = null;
                human.failedTaskAttempts++;
                human.restTimer = Math.min(300 * (human.failedTaskAttempts + 1), 3600);
              }
            } else {
              human.currentTask = null;
              human.failedTaskAttempts++;
              human.restTimer = Math.min(300 * (human.failedTaskAttempts + 1), 3600);
            }
          }
        }
      });

      for (let i = 0; i < currentHumans.length; i++) {
        const h1 = currentHumans[i];
        if (!h1.communityId || h1.reproductionCooldown > 0) continue;
        
        const myBase = currentBases.find(b => b.id === h1.communityId);
        if (myBase && myBase.population >= myBase.populationLimit) continue; 

        for (let j = i + 1; j < currentHumans.length; j++) {
          const h2 = currentHumans[j];
          if (h1.communityId === h2.communityId && h1.gender !== h2.gender && h2.reproductionCooldown <= 0) {
            const dist = Math.sqrt(Math.pow(h1.x - h2.x, 2) + Math.pow(h1.y - h2.y, 2));
            if (dist < (h1.radius + h2.radius + 2)) {
              const father = h1.gender === 'male' ? h1 : h2;
              const mother = h1.gender === 'female' ? h1 : h2;
              if (mother.childrenCount >= 5) continue; 
              h1.reproductionCooldown = 7200; h2.reproductionCooldown = 7200; mother.childrenCount++;
              const childId = nextIdRef.current++;
              const child = new Human(childId, FIELD_SIZE, { father, mother });
              child.reproductionCooldown = 7200; child.x = h1.x + 5; child.y = h1.y + 5; child.communityId = h1.communityId;
              currentHumans.push(child);
              break; 
            }
          }
        }
      }
      
      currentBases.forEach(base => {
        base.draw(ctx);        
      });
      // Отрисовка Мостов 
      bridges.forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(-30, -16, 60, 32);
        ctx.restore();
      });
      let selectedHuman = null;

      const waterCheck = (x, y) => checkWaterBody(x, y, lakes, rivers, bridges);
      const formattedBridges = bridges.map(b => {
      const crossAngle = b.angle + Math.PI / 2;
      const cos = Math.cos(crossAngle);
      const sin = Math.sin(crossAngle);
      const halfLen = 30;
      const treeSize = 6;
      return {
        x: b.x,
        y: b.y,
        angle: b.angle, // Keep original river angle for structural rendering
        entry: { x: b.x + cos * (halfLen + treeSize), y: b.y + sin * (halfLen + treeSize) },
        exit: { x: b.x - cos * (halfLen + treeSize), y: b.y - sin * (halfLen + treeSize) }
      };
    });


      currentHumans.forEach(human => {
        const myBase = currentBases.find(b => b.id === human.communityId);
        const leaderHuman = currentHumans.find(h => h.communityId === human.communityId && h.isLeader);
        
        const waterCheck = (x, y) => checkWaterBody(x, y, lakes, rivers, bridges);
      
        // Convert bridges to {entry, exit} format, rotating 90 degrees to point to the dry land banks
        const formattedBridges = bridges.map(b => {
          const crossAngle = b.angle + Math.PI / 2;
          const cos = Math.cos(crossAngle);
          const sin = Math.sin(crossAngle);
          const halfLen = 30;
          const treeSize = 2;
          return {
            x: b.x,
            y: b.y,
            angle: b.angle,
            entry: { x: b.x + cos * (halfLen + treeSize), y: b.y + sin * (halfLen + treeSize) },
            exit: { x: b.x - cos * (halfLen + treeSize), y: b.y - sin * (halfLen + treeSize) }
          };
        });

        human.update(FIELD_SIZE, currentHumans, myBase, leaderHuman, currentResources, (tx, ty) => {
          resourcesRef.current.push({
            id: Date.now() + Math.random(), type: 'tree', amount: 5, x: tx, y: ty, minerId: null, isSelected: false
          });
        }, waterCheck, formattedBridges);

        human.draw(ctx, myBase);
        if (human.isSelected) selectedHuman = human;
      });


      let selectedResource = null;
      currentResources.forEach(res => {
        ctx.beginPath();
        if (res.type === 'stick') { ctx.fillStyle = '#964B00'; ctx.arc(res.x, res.y, 2, 0, Math.PI * 2); }
        else if (res.type === 'stone_vein') { ctx.fillStyle = '#808080'; ctx.fillRect(res.x - 5, res.y - 5, 10, 10); }
        else if (res.type === 'copper_vein') { ctx.fillStyle = '#D2691E'; ctx.fillRect(res.x - 5, res.y - 5, 10, 10); }
        ctx.fill();
        ctx.lineWidth = res.isSelected ? 2 : 1;
        ctx.strokeStyle = res.isSelected ? '#FFFFFF' : '#222';
        ctx.stroke();

        if (res.isSelected) selectedResource = res;
      });
      
      currentResources
        .filter(res => res.type === 'tree')
        .forEach(res => {
          ctx.beginPath();
          ctx.fillStyle = '#228B22';
          ctx.arc(res.x, res.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = res.isSelected ? 2 : 1;
          ctx.strokeStyle = res.isSelected ? '#FFFFFF' : '#222';
          ctx.stroke();

          if (res.isSelected) selectedResource = res;
        });
        
      currentBases.forEach(base => {
        base.drawLabel(ctx);     
      });

      ctx.restore();

      if (selectedHuman) {
        const screenX = selectedHuman.x * zoomRef.current + panRef.current.x;
        const screenY = selectedHuman.y * zoomRef.current + panRef.current.y;
        
        const originalX = selectedHuman.x;
        const originalY = selectedHuman.y;
        selectedHuman.x = screenX;
        selectedHuman.y = screenY;
        
        const myBase = currentBases.find(b => b.id === selectedHuman.communityId);
        selectedHuman.drawTooltip(ctx, myBase, canvas.width);
        
                selectedHuman.x = originalX;
        selectedHuman.y = originalY;
      } else if (selectedResource) {
        drawResourceTooltip(ctx, selectedResource, canvas.width);
      }

      tickCount++;
      if (tickCount % 15 === 0) {
        setUiState({
          population: currentHumans.length,
          colonies: currentBases.map(b => ({
            id: b.id, name: b.name, population: b.population, populationLimit: b.populationLimit, color: b.color, x: b.x, y: b.y, resources: { ...b.resources }
          })),
          humans: currentHumans.map(h => ({
            id: h.id, name: h.name, gender: h.gender, communityId: h.communityId, isLeader: h.isLeader, tool: h.tool,
            parents: h.parents ? { father: { id: h.parents.father.id }, mother: { id: h.parents.mother.id } } : null
          }))
        });
      }

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationId);
  }, [simPopulation, restartToken]); 

  // Native Interactions Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const enforceBounds = (panX, panY, zoom) => {
      const minPan = FIELD_SIZE - (FIELD_SIZE * zoom);
      return {
        x: Math.min(0, Math.max(minPan, panX)),
        y: Math.min(0, Math.max(minPan, panY))
      };
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      let newZoom = zoomRef.current * (1 + delta);

      newZoom = Math.max(1, Math.min(newZoom, 10));

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      
      let newPanX = mouseX - (mouseX - panRef.current.x) * (newZoom / zoomRef.current);
      let newPanY = mouseY - (mouseY - panRef.current.y) * (newZoom / zoomRef.current);

      panRef.current = enforceBounds(newPanX, newPanY, newZoom);
      zoomRef.current = newZoom;
    };

    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const dx = (e.clientX - lastMousePosRef.current.x) * scaleX;
      const dy = (e.clientY - lastMousePosRef.current.y) * scaleY;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      panRef.current = enforceBounds(panRef.current.x + dx, panRef.current.y + dy, zoomRef.current);
    };

    const handleMouseUpOrLeave = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'grab';
    };

    const handleCanvasClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const realX = clientX * scaleX;
      const realY = clientY * scaleY;

      const clickX = (realX - panRef.current.x) / zoomRef.current;
      const clickY = (realY - panRef.current.y) / zoomRef.current;

      let clickedAnyHuman = false;

      humansRef.current.forEach(human => {
        const distance = Math.sqrt(Math.pow(clickX - human.x, 2) + Math.pow(clickY - human.y, 2));
        
        if (distance < 15 && !clickedAnyHuman) {
          human.isSelected = !human.isSelected;
          if (human.isSelected) {
            human.savedVx = human.vx;
            human.savedVy = human.vy;
          } else {
            human.vx = human.savedVx || (Math.random() - 0.5) * 2;
            human.vy = human.savedVy || (Math.random() - 0.5) * 2;
          }
          clickedAnyHuman = true;
        } else {
          if (human.isSelected) {
            human.isSelected = false;
            human.vx = human.savedVx || (Math.random() - 0.5) * 2;
            human.vy = human.savedVy || (Math.random() - 0.5) * 2;
          }
        }
      });

      let clickedAnyResource = false;
      resourcesRef.current.forEach(res => {
        if (clickedAnyHuman) {
          res.isSelected = false; 
          return;
        }

        const distance = Math.sqrt(Math.pow(clickX - res.x, 2) + Math.pow(clickY - res.y, 2));
        if (distance < 12 && !clickedAnyResource) {
          res.isSelected = !res.isSelected;
          clickedAnyResource = true;
        } else {
          res.isSelected = false;
        }
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUpOrLeave);
    canvas.addEventListener('mouseleave', handleMouseUpOrLeave);
    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUpOrLeave);
      canvas.removeEventListener('mouseleave', handleMouseUpOrLeave);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, []);

  const isSafeSpawn = (x, y) => {
    const { lakes, rivers} = waterRef.current;
    for (let l of lakes) {
      if (pointInEllipse(x, y, l.x, l.y, l.a + 10, l.b + 10, l.angle)) return false;
    }
    for (let riv of (rivers || bridges)) {
      if (pointNearRiver(x, y, riv.points, riv.thickness + 10)) return false;
    }
    return true;
  };

  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '1400px', margin: '0 auto', alignItems: 'flex-start' }}>
      
      {/* Left Column: Canvas and Interactive Controls */}
      <div style={{ flex: '1 1 50%', overflow: 'hidden' }}>
        <canvas 
          ref={canvasRef} 
          width={FIELD_SIZE} 
          height={FIELD_SIZE} 
          style={{ 
            width: '100%', height: 'auto', aspectRatio: '1 / 1', 
            border: '4px solid #2e7d32', borderRadius: '8px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)', 
            cursor: 'grab',
            backgroundColor: '#1e2814' 
          }}
        />
        
        {/* Control Bar Placed Directly Under Canvas */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'center', 
          marginTop: '15px', 
          flexWrap: 'wrap',  
          backgroundColor: '#2a2a2a', 
          padding: '12px 20px', 
          borderRadius: '8px', 
          color: '#fff',
          boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
        }}>
          <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Initial Population:</label>
          <input 
            type="number" 
            value={popInput} 
            min="1"
            max="500"
            onChange={(e) => setPopInput(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ 
              width: '70px', 
              padding: '6px 10px', 
              borderRadius: '4px', 
              border: '1px solid #555', 
              backgroundColor: '#333', 
              color: '#fff', 
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          />
          <button 
            onClick={handleRestartSimulation}
            style={{ 
              padding: '6px 14px', 
              borderRadius: '4px', 
              border: 'none', 
              backgroundColor: '#2e7d32', 
              color: '#fff', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#388e3c'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2e7d32'}
          >
            Restart
          </button>
          <button
            onClick={() => {
              let attempts = 0;
              let x = FIELD_SIZE / 2, y = FIELD_SIZE / 2;
              while (!isSafeSpawn(x, y) && attempts < 50) {
                x = Math.random() * (FIELD_SIZE - 20) + 10;
                y = Math.random() * (FIELD_SIZE - 20) + 10;
                attempts++;
              }
              if (attempts < 50) {
                const newId = nextIdRef.current++;
                const spawnedHuman = new Human(newId, FIELD_SIZE);
                spawnedHuman.x = x;
                spawnedHuman.y = y;
                spawnedHuman.vx = (Math.random() - 0.5) * 2;
                spawnedHuman.vy = (Math.random() - 0.5) * 2;
                humansRef.current.push(spawnedHuman);
              }
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#2e7d32',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap' 
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#388e3c'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2e7d32'}
          >
            Spawn Human
          </button>
          <div style={{ flexBasis: '100%', height: '0' }} /> 
          <button 
            onClick={handleResetCamera}
            style={{ 
              padding: '6px 14px', 
              borderRadius: '4px', 
              border: 'none', 
              backgroundColor: '#444', 
              color: '#fff', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap'  
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#555'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#444'}
          >
            Reset Camera View
          </button>
          <label style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '0.9rem' }}>
            <input 
              type="checkbox" 
              checked={waterBanksChecked} 
              onChange={(e) => setWaterBanksChecked(e.target.checked)} 
              style={{ marginRight: '6px' }}
            />
            Generate water banks
          </label>
        </div>
      </div>
      
      {/* Middle Column: Simulation Stats */}
      <div style={{ 
        flex: '1 1 25%', backgroundColor: '#2a2a2a', padding: '20px', 
        borderRadius: '8px', maxHeight: '800px', 
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ flexShrink: 0 }}>
          <h2 style={{ borderBottom: '2px solid #444', paddingBottom: '10px', marginTop: 0 }}>Simulation Stats</h2>
          <p style={{ fontSize: '1.1rem' }}><strong>Current Population:</strong> {uiState.population}</p>
          <p style={{ fontSize: '1.1rem' }}><strong>Settlements:</strong> {uiState.colonies.length}</p>
          <h3 style={{ marginTop: '25px', marginBottom: '15px', color: '#aaa' }}>Settlements List:</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
          {uiState.colonies.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No communities formed yet...</p>
          ) : (
            uiState.colonies.map(colony => (
              <div key={colony.id} style={{ borderLeft: `5px solid ${colony.color}`, paddingLeft: '15px', backgroundColor: '#333', padding: '10px', borderRadius: '0 6px 6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ color: colony.color, fontWeight: 'bold', fontSize: '1.2rem' }}>
                    {colony.name} ({colony.population}/{colony.populationLimit || 4})
                  </span>
                  <span 
                    onClick={() => renameBase(colony.id, colony.name)}
                    style={{ cursor: 'pointer', color: '#888', fontSize: '1.1rem', padding: '0 5px', display: 'inline-block', transform: 'scaleX(-1)' }}
                    title="Rename Settlement"
                  >
                    ✎
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#bbb' }}>
                  <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#222', borderRadius: '4px', fontSize: '0.85rem' }}>
                    📦 <strong>Stockpile:</strong><br/>
                    🪵 Wood: {colony.resources?.wood || 0} 🪨 Stone: {colony.resources?.stone || 0}<br/>🪙 Copper: {colony.resources?.copper || 0}<br/>
                    🛠️ <strong>Tools:</strong> 🪵: {colony.resources?.wood_tools || 0} | 🪨: {colony.resources?.stone_tools || 0} | 🪙: {colony.resources?.copper_tools || 0}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Right Column: Villagers List */}
      <div style={{ 
        flex: '1 1 25%', backgroundColor: '#2a2a2a', padding: '20px', 
        borderRadius: '8px', maxHeight: '800px', 
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ flexShrink: 0, marginBottom: '15px' }}>
          <h2 style={{ borderBottom: '2px solid #444', paddingBottom: '10px', marginTop: 0 }}>Villagers</h2>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
          {uiState.colonies.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Waiting for settlements...</p>
          ) : (
            uiState.colonies.map(colony => {
              const commHumans = uiState.humans.filter(h => h.communityId === colony.id);
              
              const leader = commHumans.find(h => h.isLeader);
              const remaining = commHumans.filter(h => !h.isLeader).sort((a, b) => a.id - b.id);
              
              const sortedLineage = [];
              if (leader) sortedLineage.push(leader);
              sortedLineage.push(...remaining);

              return (
                <div key={colony.id} style={{ marginBottom: '20px' }}>
                  <div style={{ backgroundColor: colony.color, color: '#111', padding: '5px 10px', borderRadius: '4px 4px 0 0', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{colony.name}</span>
                    <span>{commHumans.length} Pop</span>
                  </div>
                  
                  <div style={{ padding: '10px', backgroundColor: '#333', borderRadius: '0 0 4px 4px', fontSize: '0.9rem' }}>
                    {sortedLineage.map(h => (
                      <div key={h.id} style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px'
                      }}>
                        <div>
                          {h.isLeader ? (
                            <span style={{ marginRight: '8px' }}>🟡</span>
                          ) : (
                            <span style={{ marginRight: '8px', fontWeight: 'bold', color: h.gender === 'male' ? '#89CFF0' : '#FFB6C1' }}>
                              {h.gender === 'male' ? '♂' : '♀'}
                            </span>
                          )}
                          
                          <span style={{ color: colony.color, fontWeight: h.isLeader ? 'bold' : 'normal' }}>
                            {h.name} <span style={{ opacity: 0.6, fontSize: '0.85em', marginLeft: '2px' }}>#{h.id}</span>
                            {h.tool && (
                              <span style={{ fontSize: '0.8rem', backgroundColor: '#222', color: '#fff', padding: '2px 4px', borderRadius: '3px', marginLeft: '6px', border: '1px solid #555' }}>
                                🪓 {h.tool}
                              </span>
                            )}
                          </span>
                        </div>
                        <span 
                          onClick={() => renameHuman(h.id, h.name)}
                          style={{ cursor: 'pointer', color: '#666', padding: '0 5px', display: 'inline-block', transform: 'scaleX(-1)' }}
                          title="Rename Villager"
                        >
                          ✎
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          ,
        ))}</div>
        </div>
{/* Окно ошибки */}
{errorMessage && (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 9999
  }}>
    <div style={{
      backgroundColor: '#2a2a2a', padding: '24px', borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #ff4444',
      maxWidth: '400px', width: '90%', textAlign: 'center', color: '#fff'
    }}>
      <h3 style={{ marginTop: 0, color: '#ff4444', fontSize: '1.2rem' }}>WARNING</h3>
      <p style={{ margin: '15px 0 20px', color: '#bbb' }}>{errorMessage}</p>
      <button 
        onClick={() => setErrorMessage(null)}
        style={{
          padding: '8px 24px', borderRadius: '4px', border: 'none',
          backgroundColor: '#ff4444', color: '#fff', cursor: 'pointer',
          fontWeight: 'bold', transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#ff6666'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#ff4444'}
      >
        ОК
      </button>
    </div>
  </div>
)}
{/* Окно переименования */}
  {renameModal.isOpen && (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#2a2a2a', padding: '24px', borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #2e7d32',
        maxWidth: '400px', width: '90%', color: '#fff'
      }}>
        <h3 style={{ marginTop: 0, color: '#2e7d32', fontSize: '1.2rem' }}>
          {renameModal.type === 'base' ? 'Rename settlement' : 'Rename citizen'}
        </h3>
        
        <input 
          type="text" 
          value={renameModal.newName}
          onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveName();
            if (e.key === 'Escape') setRenameModal({ isOpen: false, type: null, id: null, oldName: '', newName: '' });
          }}
          autoFocus
          style={{
            width: '100%', padding: '10px', marginTop: '10px', marginBottom: '20px',
            borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333',
            color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => setRenameModal({ isOpen: false, type: null, id: null, oldName: '', newName: '' })}
            style={{
              padding: '8px 16px', borderRadius: '4px', border: 'none',
              backgroundColor: '#555', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveName}
            style={{
              padding: '8px 16px', borderRadius: '4px', border: 'none',
              backgroundColor: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}

