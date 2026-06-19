import React, { useRef, useEffect, useState } from 'react';
import { Human } from '../simulation/Human';
import { Base } from '../simulation/Base';

export default function SimulationCanvas({ initialPopulation }) {
  const canvasRef = useRef(null);
  const humansRef = useRef([]);
  const basesRef = useRef([]);
  const resourcesRef = useRef([]); 
  const nextIdRef = useRef(initialPopulation);
  const FIELD_SIZE = 1000;
  const [errorMessage, setErrorMessage] = useState(null);

  // Zoom and Pan Refs
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Simulation settings states
  const [popInput, setPopInput] = useState(initialPopulation);
  const [simPopulation, setSimPopulation] = useState(initialPopulation);

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

  // Handle save name button click
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
    setSimPopulation(popInput);
    handleResetCamera();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    humansRef.current = Array.from({ length: simPopulation }, (_, i) => new Human(i, FIELD_SIZE));
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
    resourcesRef.current = resources;
    
    let animationId;
    let tickCount = 0; 
    const drawResourceTooltip = (ctx, res, fieldSize) => {
      const boxWidth = 160;
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
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      
      const typeName = res.type.replace('_', ' ').toUpperCase();
      ctx.fillText(typeName, boxX + 12, boxY + 22);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#eeeeee';
      ctx.fillText(`Resources Left: ${res.amount}`, boxX + 12, boxY + 45);
      
      const status = res.minerId ? 'Being Mined' : 'Idle';
      ctx.fillStyle = res.minerId ? '#FFD700' : '#A0C4FF';
      ctx.fillText(`Status: ${status}`, boxX + 12, boxY + 65);
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, 0, FIELD_SIZE, FIELD_SIZE);

      const currentHumans = humansRef.current;
      const currentBases = basesRef.current;
      
      resourcesRef.current = resourcesRef.current.filter(r => r.amount > 0);
      const currentResources = resourcesRef.current;

      currentBases.forEach(base => {
        const villageMembers = currentHumans.filter(h => h.communityId === base.id);
        
        // Tool-based population limit logic
        let woodBonus = 0;
        let stoneBonus = 0;
        let copperBonus = 0;

        villageMembers.forEach(member => {
          if (member.tool === 'wood') woodBonus += 1;
          if (member.tool === 'stone') stoneBonus += 2;
          if (member.tool === 'copper') copperBonus += 3;
        });

        // Apply strict tool caps
        woodBonus = Math.min(woodBonus, 10);
        stoneBonus = Math.min(stoneBonus, 20);

        base.populationLimit = 4 + woodBonus + stoneBonus + copperBonus;
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

        // Replanting logic with distance checks
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

          // Find a spaced-out valid spot for the new tree
          let rx, ry, valid, attempts = 0;
          do {
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 80; // Distance between 60 and 140 from base
            rx = myBase.x + Math.cos(angle) * dist;
            ry = myBase.y + Math.sin(angle) * dist;

            valid = true;
            if (rx < 10 || rx > FIELD_SIZE - 10 || ry < 10 || ry > FIELD_SIZE - 10) valid = false;

            if (valid) {
              for (let r of currentResources) {
                if (r.type === 'tree') {
                  const d = Math.hypot(rx - r.x, ry - r.y);
                  if (d < 25) { valid = false; break; } // Must be at least 25 units away from other trees
                }
              }
            }
            attempts++;
          } while (!valid && attempts < 50);

          human.replantX = rx;
          human.replantY = ry;
          myBase.replantedThisPeriod++;
          return;
        }
     
        currentHumans.forEach(human => {
          if (!human.isLeader || !human.communityId) return;
          const myBase = currentBases.find(b => b.id === human.communityId);
          if (!myBase) return;

          const dx = human.x - myBase.x;
          const dy = human.y - myBase.y;
          const dist = Math.hypot(dx, dy);
          const MAX_LEADER_DIST = 70;

          if (dist > MAX_LEADER_DIST) {
            // 1. Возвращаем на границу
            human.x = myBase.x + (dx / dist) * MAX_LEADER_DIST;
            human.y = myBase.y + (dy / dist) * MAX_LEADER_DIST;

            // 2. Считаем базовый угол направления НА базу
            const angleToBase = Math.atan2(-dy, -dx);

            // 3. Добавляем случайное отклонение (например, от -0.5 до +0.5 радиан, это около +-30 градусов)
            const randomOffset = (Math.random() - 0.5) * 1.0; 
            const finalAngle = angleToBase + randomOffset;

            // 4. Задаем новую скорость с учетом измененного угла
            const currentSpeed = Math.hypot(human.vx || 0, human.vy || 0) || 1;
            human.vx = Math.cos(finalAngle) * currentSpeed;
            human.vy = Math.sin(finalAngle) * currentSpeed;
          }
        });
        if (human.restTimer > 0) return;

        if (human.currentTask === 'going_to_leader' && leaderHuman) {
          const distToLeader = Math.sqrt(Math.pow(human.x - leaderHuman.x, 2) + Math.pow(human.y - leaderHuman.y, 2));
          if (distToLeader <= 16) {
            if (!human.tool && myBase.resources.wood_tools > 0) { human.tool = 'wood'; myBase.resources.wood_tools--; }
            if (human.tool === 'wood' && myBase.resources.stone_tools > 0) { human.tool = 'stone'; myBase.resources.stone_tools--; }
            if (human.tool === 'stone' && myBase.resources.copper_tools > 0) { human.tool = 'copper'; myBase.resources.copper_tools--; }

            if (!human.tool && myBase.resources.wood >= 4) {
              myBase.resources.wood -= 4; human.currentTask = 'crafting'; human.taskTimer = 1200; human.maxTaskTimer = 1200; human.tool = 'wood'; return;
            } else if (human.tool === 'wood' && myBase.resources.wood >= 8 && myBase.resources.stone >= 4) {
              myBase.resources.wood -= 8; myBase.resources.stone -= 4; human.currentTask = 'crafting'; human.taskTimer = 1200; human.maxTaskTimer = 1200; human.tool = 'stone'; return;
            } else if (human.tool === 'stone' && myBase.resources.copper >= 16 && myBase.resources.wood >= 4) {
              myBase.resources.copper -= 16; myBase.resources.wood -= 4; human.currentTask = 'crafting'; human.taskTimer = 1200; human.maxTaskTimer = 1200; human.tool = 'copper'; return;
            }

            let targetType = null;
            const availableTypes = new Set(currentResources.map(r => r.type));

            if (myBase.resources.wood < 10 && (availableTypes.has('tree') || availableTypes.has('stick'))) {
              targetType = (human.tool && availableTypes.has('tree')) ? 'tree' : 'stick';
            } else if (human.tool === 'wood' || human.tool === 'stone' || human.tool === 'copper') {
              if (myBase.resources.stone < 8 && availableTypes.has('stone_vein')) {
                targetType = 'stone_vein';
              } else if ((human.tool === 'stone' || human.tool === 'copper') && availableTypes.has('copper_vein')) {
                targetType = 'copper_vein';
              } else if (availableTypes.has('tree')) {
                targetType = 'tree';
              } else if (availableTypes.has('stone_vein')) {
                targetType = 'stone_vein';
              } else if (availableTypes.has('stick')) {
                targetType = 'stick';
              }
            } else if (availableTypes.has('stick')) {
              targetType = 'stick';
            }

            if (!targetType) {
               if (availableTypes.has('copper_vein') && ['stone', 'copper'].includes(human.tool)) targetType = 'copper_vein';
               else if (availableTypes.has('stone_vein') && ['wood', 'stone', 'copper'].includes(human.tool)) targetType = 'stone_vein';
               else if (availableTypes.has('tree') && human.tool) targetType = 'tree';
               else if (availableTypes.has('stick')) targetType = 'stick';
            }

            let nearestNode = null;
            let minDist = Infinity;
            currentResources.forEach(node => {
              if (node.minerId !== null && node.minerId !== human.id) return;
              if (node.type !== targetType && !(targetType === 'stick' && node.type === 'tree')) return;
              const d = Math.sqrt(Math.pow(human.x - node.x, 2) + Math.pow(human.y - node.y, 2));
              if (d < minDist) { minDist = d; nearestNode = node; }
            });

            if (nearestNode) {
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
              human.restTimer = 300;
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

      let selectedHuman = null;
      currentHumans.forEach(human => {
        const myBase = currentBases.find(b => b.id === human.communityId);
        const leaderHuman = currentHumans.find(h => h.communityId === human.communityId && h.isLeader);
        
        human.update(FIELD_SIZE, currentHumans, myBase, leaderHuman, currentResources, (tx, ty) => {
          resourcesRef.current.push({
            id: Date.now() + Math.random(), type: 'tree', amount: 5, x: tx, y: ty, minerId: null, isSelected: false
          });
        });

        human.draw(ctx, myBase);
        if (human.isSelected) selectedHuman = human; 
      });

      let selectedResource = null;
      currentResources.forEach(res => {
        ctx.beginPath();
        if (res.type === 'stick') { ctx.fillStyle = '#964B00'; ctx.arc(res.x, res.y, 2, 0, Math.PI * 2); }
        else if (res.type === 'tree') { ctx.fillStyle = '#228B22'; ctx.arc(res.x, res.y, 6, 0, Math.PI * 2); }
        else if (res.type === 'stone_vein') { ctx.fillStyle = '#808080'; ctx.fillRect(res.x - 5, res.y - 5, 10, 10); }
        else if (res.type === 'copper_vein') { ctx.fillStyle = '#D2691E'; ctx.fillRect(res.x - 5, res.y - 5, 10, 10); }
        ctx.fill();
        ctx.lineWidth = res.isSelected ? 2 : 1;
        ctx.strokeStyle = res.isSelected ? '#FFFFFF' : '#222';
        ctx.stroke();

        if (res.isSelected) selectedResource = res;
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
  }, [simPopulation]); 

  // Native Interactions Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Boundary helper to prevent dark green background
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
              const centerX = FIELD_SIZE / 2;
              const centerY = FIELD_SIZE / 2;
      
              const newId = nextIdRef.current++;
              const spawnedHuman = new Human(newId, FIELD_SIZE);
              
              spawnedHuman.x = centerX;
              spawnedHuman.y = centerY;
              spawnedHuman.vx = (Math.random() - 0.5) * 2;
              spawnedHuman.vy = (Math.random() - 0.5) * 2;
              
              humansRef.current.push(spawnedHuman);
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
            })
          )}
        </div>
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