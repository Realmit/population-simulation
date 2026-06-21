import { PREHISTORIC_NAMES } from './names';

export class Human {
  constructor(id, fieldSize, parents = null) {
    this.id = id;
    this.radius = 4;
    this.name = PREHISTORIC_NAMES[Math.floor(Math.random() * PREHISTORIC_NAMES.length)];
    this.gender = Math.random() > 0.5 ? 'male' : 'female';
    this.reproductionCooldown = 1800; // 30s at 60fps
    this.childrenCount = 0; 
    this.failedTaskAttempts = 0;
    this.bridgeTarget = null;
    this.bridgePhase = null;
    this.parents = parents;
    this.isRoyal = false;

    this.tool = null; 
    this.currentTask = null; 
    this.taskTarget = null; 
    this.taskTimer = 0;
    this.maxTaskTimer = 0; 
    this.restTimer = 0;

    if (parents) {
      const calcStat = (fatherStat, motherStat) => {
        const base = (fatherStat + motherStat) / 2;
        const mutation = Math.floor(Math.random() * 21) - 10; 
        return Math.max(21, Math.min(100, Math.floor(base + mutation)));
      };

      this.health = calcStat(parents.father.health, parents.mother.health);
      this.strength = calcStat(parents.father.strength, parents.mother.strength);
      this.intelligence = calcStat(parents.father.intelligence, parents.mother.intelligence);
      this.charisma = calcStat(parents.father.charisma, parents.mother.charisma);

      if (parents.father.isLeader || parents.mother.isLeader) {
        this.isRoyal = true;
      }
    } else {
      this.health = Math.floor(Math.random() * 50) + 51;      
      this.strength = Math.floor(Math.random() * 70) + 31;   
      this.intelligence = Math.floor(Math.random() * 90) + 11; 
      this.charisma = Math.floor(Math.random() * 100) + 1;   
    }

    this.communityId = null;
    this.isLeader = false;
    this.job = null;
    this.leaderScore = this.health + (this.strength * 0.75);

    this.isSelected = false;
    this.status = "Wandering";

    this.x = Math.random() * (fieldSize - this.radius * 2) + this.radius;
    this.y = Math.random() * (fieldSize - this.radius * 2) + this.radius;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.savedVx = 0;
    this.savedVy = 0;
    this.maxSpeed = 1.5;
  }

    update(fieldSize, allHumans, myBase, leaderHuman, resourcesList, addTreeCallback, waterCheckFn, allBridges) {
    if (this.reproductionCooldown > 0) this.reproductionCooldown--;
    if (this.bridgeCooldown === undefined) this.bridgeCooldown = 0;
    if (this.bridgeCooldown > 0) this.bridgeCooldown--;

    // Update status string
    if (this.currentTask === 'seeking_mate') {
      this.status = "Seeking Mate";
    } else if (this.isLeader) {
      this.status = "Managing Village";
    } else if (this.communityId) {
      if (this.currentTask === 'replanting') this.status = "Replanting Trees";
      else if (this.restTimer > 0) this.status = `Resting (${Math.ceil(this.restTimer / 60)}s)`;
      else if (this.currentTask === 'going_to_leader') this.status = "Getting Task";
      else if (this.currentTask === 'gathering' && this.taskTarget) this.status = `Mining ${this.taskTarget.type.split('_')[0]}`;
      else if (this.currentTask === 'crafting') this.status = `Crafting (${Math.ceil(this.taskTimer / 60)}s)`;
      else this.status = "Idle";
    } else {
      this.status = "Wandering";
    }

    if (this.isSelected) { this.vx = 0; this.vy = 0; return; }
    
    // Helper functions
    const getCurrentGoal = () => {
      if (this.bridgeTarget) {
        return this.bridgePhase === 'to_entry'
          ? this.bridgeTarget.entry
          : this.bridgeTarget.exit;
      }
      if (this.taskTarget) return { x: this.taskTarget.x, y: this.taskTarget.y };
      if (leaderHuman) return { x: leaderHuman.x, y: leaderHuman.y };
      if (myBase) return { x: myBase.x, y: myBase.y };
      return { x: this.x, y: this.y };
    };
    
    const isPathClear = (targetX, targetY) => {
      if (!waterCheckFn) return true;
      if (waterCheckFn(this.x, this.y)) return false;
      if (waterCheckFn(targetX, targetY)) return false;
      
      const steps = 20; // FIX: was 5, too few to detect narrow rivers
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const checkX = this.x + (targetX - this.x) * t;
        const checkY = this.y + (targetY - this.y) * t;
        if (waterCheckFn(checkX, checkY)) return false;
      }
      return true;
    };
    
    const isSafePosition = (x, y) => {
      if (!waterCheckFn) return true;
      return !waterCheckFn(x, y);
    };
    
    const getWaterAvoidanceVelocity = (targetX, targetY) => {
      if (!waterCheckFn) return null;
      
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return null;
      
      const dirX = dx / dist;
      const dirY = dy / dist;
      
      if (isSafePosition(this.x + dirX * 15, this.y + dirY * 15)) {
        return { x: dirX * this.maxSpeed, y: dirY * this.maxSpeed };
      }
      
      const perpX = -dirY;
      const perpY = dirX;
      
      const leftX = this.x + perpX * 15;
      const leftY = this.y + perpY * 15;
      const rightX = this.x - perpX * 15;
      const rightY = this.y - perpY * 15;
      
      if (isSafePosition(leftX, leftY)) {
        return { x: perpX * this.maxSpeed, y: perpY * this.maxSpeed };
      }
      if (isSafePosition(rightX, rightY)) {
        return { x: -perpX * this.maxSpeed, y: -perpY * this.maxSpeed };
      }
      
      return { x: -dirX * this.maxSpeed, y: -dirY * this.maxSpeed };
    };

    const findBridgeForPath = (targetX, targetY) => {
      if (!waterCheckFn || !allBridges || allBridges.length === 0) return false;
      if (waterCheckFn(this.x, this.y)) return false; // already in water, let reactive handle

      // Check if direct path crosses water
      const steps = 15;
      let pathCrossesWater = false;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const checkX = this.x + (targetX - this.x) * t;
        const checkY = this.y + (targetY - this.y) * t;
        if (waterCheckFn(checkX, checkY)) { pathCrossesWater = true; break; }
      }
      if (!pathCrossesWater) return false;

      // Find best bridge dynamically choosing entry/exit sides
      let closestDist = Infinity;
      let bestBridge = null;
      for (const b of allBridges) {
        if (waterCheckFn(b.entry.x, b.entry.y) || waterCheckFn(b.exit.x, b.exit.y)) continue;
        
        // Check BOTH directions: crossing Entry->Exit OR Exit->Entry
        const d1 = Math.hypot(this.x - b.entry.x, this.y - b.entry.y) + Math.hypot(b.exit.x - targetX, b.exit.y - targetY);
        const d2 = Math.hypot(this.x - b.exit.x, this.y - b.exit.y) + Math.hypot(b.entry.x - targetX, b.entry.y - targetY);
        
        let totalDist = Math.min(d1, d2);
        
        if (totalDist < closestDist) {
          closestDist = totalDist;
          // Dynamically map entry to whichever side the human is closest to
          bestBridge = d1 < d2 ? { entry: b.entry, exit: b.exit } : { entry: b.exit, exit: b.entry };
        }
      }

      if (bestBridge) {
        this.bridgeTarget = bestBridge;
        this.bridgePhase = 'to_entry';
        return true;
      }
      return false;
    };

    // Resource avoidance
    if (resourcesList) {
      for (let res of resourcesList) {
        if (res.type === 'stick') continue; 
        let resRadius = res.type === 'tree' ? 6 : 7;
        const dist = Math.sqrt(Math.pow(this.x - res.x, 2) + Math.pow(this.y - res.y, 2));
        const minDistance = this.radius + resRadius + 2;
        if (dist < minDistance && dist > 0) {
                    const overlap = minDistance - dist;
          this.vx += ((this.x - res.x) / dist) * overlap * 0.2;
          this.vy += ((this.y - res.y) / dist) * overlap * 0.2;
        }
      }
    }
    
    // --- Water avoidance logic ---
    // --- Water avoidance logic ---
    if (waterCheckFn && !this.bridgeTarget && this.bridgePhase !== 'crossing') {
      const lookAhead = 15;
      const checkX = this.x + this.vx * lookAhead;
      const checkY = this.y + this.vy * lookAhead;
      
      const inWaterNow = waterCheckFn(this.x, this.y);
      const willBeInWater = waterCheckFn(checkX, checkY);
      
      if (inWaterNow || willBeInWater) {
        const goal = getCurrentGoal();
        let bridge = null;
        
        // FIX: Only villagers (communityId) look for bridges, and ONLY if not on cooldown
        if (this.communityId && this.bridgeCooldown <= 0 && allBridges && allBridges.length > 0) {
          let closestDist = Infinity;
          for (const b of allBridges) {
            if (!waterCheckFn(b.entry.x, b.entry.y) && !waterCheckFn(b.exit.x, b.exit.y)) {
              const d1 = Math.hypot(this.x - b.entry.x, this.y - b.entry.y) + Math.hypot(b.exit.x - goal.x, b.exit.y - goal.y);
              const d2 = Math.hypot(this.x - b.exit.x, this.y - b.exit.y) + Math.hypot(b.entry.x - goal.x, b.entry.y - goal.y);
              
              let totalDist = Math.min(d1, d2);
              if (totalDist < closestDist) {
                closestDist = totalDist;
                bridge = d1 < d2 ? { entry: b.entry, exit: b.exit } : { entry: b.exit, exit: b.entry };
              }
            }
          }
        }
        
        if (bridge) {
          this.bridgeTarget = bridge;
          this.bridgePhase = 'to_entry';
        } else {
          // Avoid water: Nomads ALWAYS fall through to here, naturally bouncing off rivers.
          const avoidance = getWaterAvoidanceVelocity(goal.x, goal.y);
          if (avoidance) {
            this.vx = avoidance.x;
            this.vy = avoidance.y;
          } else if (inWaterNow) {
            const angle = Math.atan2(this.vy, this.vx);
            this.vx = Math.cos(angle + Math.PI) * this.maxSpeed;
            this.vy = Math.sin(angle + Math.PI) * this.maxSpeed;
          }
        }
      }
    }
    
    // FIX: Apply cooldown check to proactive pathfinding as well
    if (!this.bridgeTarget && this.communityId && waterCheckFn && this.bridgeCooldown <= 0) {
      const goal = getCurrentGoal();
      if (goal.x !== this.x || goal.y !== this.y) {
        findBridgeForPath(goal.x, goal.y);
      }
    }
    // Bridge crossing state machine
    if (this.bridgeTarget) {
      if (this.bridgePhase === 'to_entry') {
        this.moveToTarget(this.bridgeTarget.entry.x, this.bridgeTarget.entry.y);
        const distE = Math.hypot(this.x - this.bridgeTarget.entry.x, this.y - this.bridgeTarget.entry.y);
        if (distE < 10) this.bridgePhase = 'crossing'; // Reduced to ensure they step fully onto the start
      } else if (this.bridgePhase === 'crossing') {
        this.moveToTarget(this.bridgeTarget.exit.x, this.bridgeTarget.exit.y);
        const distX = Math.hypot(this.x - this.bridgeTarget.exit.x, this.y - this.bridgeTarget.exit.y);
        
        // FIX: Require them to actually reach the end of the bridge (dist < 5 instead of 15)
        if (distX < 5) {
          this.bridgeTarget = null;
          this.bridgePhase = null;
          
          // FIX: Apply a 2-second cooldown so they walk safely away from the river bank
          this.bridgeCooldown = 120; 
          
          if (this.currentTask) this._postBridgeTask = this.currentTask;
        }
      }
    } else if (this._postBridgeTask) {
      this.currentTask = this._postBridgeTask;
      this._postBridgeTask = null;
    } else if (this.communityId && !this.isLeader) {
      // Replanting Task
      if (this.currentTask === 'replanting' && this.replantX) {
        if (isPathClear(this.replantX, this.replantY)) {
          this.moveToTarget(this.replantX, this.replantY);
          const dist = Math.sqrt(Math.pow(this.x - this.replantX, 2) + Math.pow(this.y - this.replantY, 2));
          if (dist <= 5) {
            this.vx = 0; this.vy = 0;
            this.taskTimer--;
            if (this.taskTimer <= 0) {
              if (addTreeCallback) addTreeCallback(this.replantX, this.replantY);
              this.currentTask = null;
              this.replantX = null;
              this.replantY = null;
            }
          }
        } else {
          const avoidance = getWaterAvoidanceVelocity(this.replantX, this.replantY);
          if (avoidance) {
            this.vx = avoidance.x;
            this.vy = avoidance.y;
          }
        }
      }
      else if (this.restTimer > 0) {
        this.restTimer--;
        this.wanderGently(myBase, waterCheckFn);
      } else if (!this.currentTask) {
        this.currentTask = 'going_to_leader';
      }

      if (this.currentTask === 'seeking_mate' && this.mateTarget) {
        if (isPathClear(this.mateTarget.x, this.mateTarget.y)) {
          this.moveToTarget(this.mateTarget.x, this.mateTarget.y);
        } else {
          const avoidance = getWaterAvoidanceVelocity(this.mateTarget.x, this.mateTarget.y);
          if (avoidance) {
            this.vx = avoidance.x;
            this.vy = avoidance.y;
          }
        }
      } else if (this.currentTask === 'going_to_leader' && leaderHuman) {
        if (isPathClear(leaderHuman.x, leaderHuman.y)) {
          this.moveToTarget(leaderHuman.x, leaderHuman.y);
        } else {
          const avoidance = getWaterAvoidanceVelocity(leaderHuman.x, leaderHuman.y);
          if (avoidance) {
            this.vx = avoidance.x;
            this.vy = avoidance.y;
          }
        }
      } else if (this.currentTask === 'crafting') {
        if (isPathClear(myBase.x, myBase.y)) {
          const dist = Math.sqrt(Math.pow(this.x - myBase.x, 2) + Math.pow(this.y - myBase.y, 2));
          if (dist > 10) {
            this.moveToTarget(myBase.x, myBase.y);
          } else {
            this.vx = 0; 
            this.vy = 0;
          }
        } else {
          const avoidance = getWaterAvoidanceVelocity(myBase.x, myBase.y);
          if (avoidance) {
            this.vx = avoidance.x;
            this.vy = avoidance.y;
          }
        }
        
        this.taskTimer--;
        if (this.taskTimer <= 0) { 
          this.currentTask = null; 
          this.restTimer = 1800; 
        }
      } else if (this.currentTask === 'gathering') {
        if (isPathClear(this.taskTarget.x, this.taskTarget.y)) {
          const dist = Math.sqrt(Math.pow(this.x - this.taskTarget.x, 2) + Math.pow(this.y - this.taskTarget.y, 2));
          if (dist > 14) {
            this.moveToTarget(this.taskTarget.x, this.taskTarget.y);
          } else {
            this.vx = 0; this.vy = 0;
            this.taskTimer--;
            if (this.taskTimer <= 0) {
              if (myBase && myBase.resources) {
                if (this.taskTarget.type === 'stick' || this.taskTarget.type === 'tree') myBase.resources.wood += 1;
                if (this.taskTarget.type === 'stone_vein') myBase.resources.stone += 1;
                if (this.taskTarget.type === 'copper_vein') myBase.resources.copper += 1;
              }
              this.taskTarget.amount--;
              this.taskTarget.minerId = null; this.taskTarget = null;
              this.currentTask = null; this.restTimer = 900; 
            }
          }
        } else {
          const avoidance = getWaterAvoidanceVelocity(this.taskTarget.x, this.taskTarget.y);
          if (avoidance) {
            this.vx = avoidance.x;
            this.vy = avoidance.y;
          }
        }
      }
    } else {
      // Limit speed for wandering humans
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > this.maxSpeed) { 
        this.vx = (this.vx / speed) * this.maxSpeed; 
        this.vy = (this.vy / speed) * this.maxSpeed; 
      }
    }
    
    // GENERAL MOVEMENT
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }
    this.x += this.vx; 
    this.y += this.vy;

    // Screen boundary limits
    if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
    if (this.x > fieldSize - this.radius) { this.x = fieldSize - this.radius; this.vx *= -1; }
    if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
    if (this.y > fieldSize - this.radius) {
        this.y = fieldSize - this.radius;
        this.vy *= -1;
    }
    
    // FINAL WATER CHECK
    if (waterCheckFn && waterCheckFn(this.x, this.y)) {
      const pushStrength = 3;
      const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -Math.PI/4, -Math.PI/2, -3*Math.PI/4];
      for (const angle of angles) {
        const testX = this.x + Math.cos(angle) * pushStrength;
        const testY = this.y + Math.sin(angle) * pushStrength;
        if (!waterCheckFn(testX, testY)) {
          this.x = testX;
          this.y = testY;
          this.vx = Math.cos(angle) * this.maxSpeed;
          this.vy = Math.sin(angle) * this.maxSpeed;
          break;
        }
      }
    }
  }

   moveToTarget(tx, ty) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      this.vx = (dx / dist) * this.maxSpeed;
      this.vy = (dy / dist) * this.maxSpeed;
    }
  }

  wanderGently(myBase, waterCheckFn) {
    if (Math.random() < 0.05) {
      this.vx += (Math.random() - 0.5) * 0.5;
      this.vy += (Math.random() - 0.5) * 0.5;
    }
    if (myBase) {
      const dx = myBase.x - this.x;
      const dy = myBase.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 30) {
        this.vx += (dx / dist) * 0.05; 
        this.vy += (dy / dist) * 0.05;
      }
    }

    // Water awareness for wandering: just reverse if heading into water
    if (waterCheckFn) {
      const lookAhead = 12;
      const checkX = this.x + this.vx * lookAhead;
      const checkY = this.y + this.vy * lookAhead;
      if (waterCheckFn(checkX, checkY)) {
        this.vx = -this.vx;
        this.vy = -this.vy;
      }
    }

    const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if (speed > 0.5) {
      this.vx = (this.vx / speed) * 0.5;
      this.vy = (this.vy / speed) * 0.5;
    }
    // If stuck (very low speed), pick a new random direction
    if (speed < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * 0.5;
      this.vy = Math.sin(angle) * 0.5;
    }
  }

  draw(ctx, myBase) {
    // 1. Draw Royal Halo above head if child of leader
    if (this.isRoyal && !this.isLeader && this.communityId) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.radius - 4, 5, 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#FFD700';
      ctx.stroke();
      ctx.restore();
    }

    // 2. Core Body configuration
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    
    if (!this.communityId) {
      ctx.fillStyle = '#888888'; // Unassigned / free human is gray
    } else {
      ctx.fillStyle = myBase ? myBase.color : '#4CAF50'; // Village color
    }
    ctx.fill();

    // 3. Border ring styling
    if (this.isLeader) {
      ctx.strokeStyle = '#FFD700'; // Chief yellow ring
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = this.isSelected ? '#FFFFFF' : '#222222';
      ctx.lineWidth = this.isSelected ? 1 : 1;
    }
    ctx.stroke();

    // 4. Inner gender core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = this.gender === 'male' ? '#00bfff' : '#ff69b4'; // Vibrant blue or pink core
    ctx.fill();

    // 5. Active processing tracking bar
    if (this.currentTask && this.maxTaskTimer > 0 && this.taskTimer > 0) {
      const progress = 1 - (this.taskTimer / this.maxTaskTimer);
      const barWidth = 14;
      const barHeight = 3;
      
      // Only draw the progress bar if there is actual progress (avoids red bar while walking)
      if (progress > 0) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 8, barWidth * progress, barHeight);
      }
    }
  }
  drawTooltip(ctx, myBase, fieldSize) {
    if (!this.isSelected) return;
    const boxWidth = 265; 
    const hasParents = this.parents !== null;
    const boxHeight = hasParents ? 215 : 165; 
    
    let boxX = this.x - boxWidth / 2;
    let boxY = this.y - boxHeight - 20;

    if (boxX < 10) boxX = 10;
    if (boxX + boxWidth > fieldSize - 10) boxX = fieldSize - boxWidth - 10;
    if (boxY < 10) boxY = this.y + this.radius + 15;

    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.strokeStyle = myBase ? myBase.color : '#4CAF50';
    ctx.lineWidth = 2;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
	
	let currentY = boxY + 25; 
    const lineHeight = 25;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif'; 
    const genderSymbol = this.gender === 'male' ? '♂' : '♀';
    const genderColor = this.gender === 'male' ? '#89CFF0' : '#FFB6C1';
    
    ctx.fillText(`${this.name} #${this.id}`, boxX + 12, currentY);
    ctx.fillStyle = genderColor; ctx.fillText(genderSymbol, boxX + boxWidth - 25, currentY);
	
	currentY += lineHeight;
	
    ctx.font = '22px sans-serif'; 
    ctx.fillStyle = '#A0C4FF';
    ctx.fillText(`Role: ${this.isLeader ? 'Leader' : (this.communityId ? 'Villager' : 'Nomad')}`, boxX + 12, currentY);
	currentY += lineHeight;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Action: ${this.status}`, boxX + 12, currentY);
	
	currentY += lineHeight;
	
    ctx.fillStyle = '#eeeeee';
    ctx.fillText(`HP: ${this.health}      STR: ${this.strength}`, boxX + 12, currentY);
	currentY += lineHeight;
    ctx.fillText(`INT: ${this.intelligence}      CHA: ${this.charisma}`, boxX + 12, currentY);
	currentY += lineHeight;
    ctx.fillText(`Equip: ${this.tool ? this.tool.toUpperCase() : 'NONE'}`, boxX + 12, currentY);

    if (hasParents) {
		currentY += lineHeight;
      ctx.fillStyle = '#aaaaaa'; ctx.fillText(`Father: `, boxX + 12, currentY);
      ctx.fillStyle = this.parents.father.isLeader ? '#FFD700' : '#89CFF0'; ctx.fillText(`${this.parents.father.name} #${this.parents.father.id}`, boxX + 90, currentY);
	  currentY += lineHeight;
      ctx.fillStyle = '#aaaaaa'; ctx.fillText(`Mother: `, boxX + 12, currentY);
      ctx.fillStyle = this.parents.mother.isLeader ? '#FFD700' : '#FFB6C1'; ctx.fillText(`${this.parents.mother.name} #${this.parents.mother.id}`, boxX + 90, currentY);
    }
  }
}







