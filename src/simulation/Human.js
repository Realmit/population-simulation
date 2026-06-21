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
    // --- Water avoidance steering ---
    if (waterCheckFn && this.bridgePhase !== 'crossing' && !this.bridgeTarget) {
      if (!this.bridgeTarget) {
        const bridge = findNearestBridgeTowards(this.x, this.y, targetX, targetY, allBridges);
      if (bridge) {
        this.bridgeTarget = bridge;
        this.bridgePhase = 'to_entry';
      }
    }
      const lookAhead = 8;
      const checkX = this.x + this.vx * lookAhead;
      const checkY = this.y + this.vy * lookAhead;
      
      if (waterCheckFn(checkX, checkY)) {
        if (!this.bridgeTarget && this.taskTarget) {
        // Use the current task's coordinates as the destination
        const bridge = findNearestBridgeTowards(
            this.x, this.y, 
            this.taskTarget.x, this.taskTarget.y, 
            allBridges
        );
        
        if (bridge) {
            this.bridgeTarget = bridge;
            this.bridgePhase = 'to_entry';
            return; // Exit early: we have a mission, stop wandering/bouncing!
        }
        }
        const leftX = this.x + this.vy * lookAhead;
        const leftY = this.y - this.vx * lookAhead;
        const rightX = this.x - this.vy * lookAhead;
        const rightY = this.y + this.vx * lookAhead;

        if (!waterCheckFn(leftX, leftY)) {
          const newVx = this.vy;
          const newVy = -this.vx;
          this.vx = newVx;
          this.vy = newVy;
        } else if (!waterCheckFn(rightX, rightY)) {
          const newVx = -this.vy;
          const newVy = this.vx;
          this.vx = newVx;
          this.vy = newVy;
        } else {
          if (!this.bridgeTarget) {
            const bridge = findNearestBridgeTowards(this.x, this.y, this.targetX, this.targetY, allBridges);
            if (bridge) {
              this.bridgeTarget = bridge;
              this.bridgePhase = 'to_entry';
              return; // Stop the bounce and start crossing
            }
          }
          this.vx = -this.vx;
          this.vy = -this.vy;
        }
      }
    }

    // --- Bridge crossing state machine ---
    if (this.bridgeTarget) {
      if (!this.bridgePhase) this.bridgePhase = 'to_entry';
      
      if (this.bridgePhase === 'to_entry') {
        this.moveToTarget(this.bridgeTarget.entry.x, this.bridgeTarget.entry.y);
        const distE = Math.hypot(this.x - this.bridgeTarget.entry.x, this.y - this.bridgeTarget.entry.y);
        if (distE < 15) {
          this.bridgePhase = 'crossing';
        }
      } else if (this.bridgePhase === 'crossing') {
        this.moveToTarget(this.bridgeTarget.exit.x, this.bridgeTarget.exit.y);
        const distX = Math.hypot(this.x - this.bridgeTarget.exit.x, this.y - this.bridgeTarget.exit.y);
        if (distX < 15) {
          this.bridgeTarget = null;
          this.bridgePhase = null;
        }
      }
    } else if (this.communityId && !this.isLeader) {
      // Replanting Task execution
      if (this.currentTask === 'replanting' && this.replantX) {
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
      }
      else if (this.restTimer > 0) {
        this.restTimer--;
        this.wanderGently(myBase);
      } else if (!this.currentTask) {
        this.currentTask = 'going_to_leader';
      }

      if (this.currentTask === 'seeking_mate' && this.mateTarget) {
        this.moveToTarget(this.mateTarget.x, this.mateTarget.y);
      } else if (this.currentTask === 'going_to_leader' && leaderHuman) {
        this.moveToTarget(leaderHuman.x, leaderHuman.y);
      } else if (this.currentTask === 'crafting') {
        const dist = Math.sqrt(Math.pow(this.x - myBase.x, 2) + Math.pow(this.y - myBase.y, 2));
        if (dist > 10) {
          this.moveToTarget(myBase.x, myBase.y);
        } else {
          // Прибыли на базу — стоим на месте и крафтим
          this.vx = 0; 
          this.vy = 0;
        }
        
        this.taskTimer--;
        if (this.taskTimer <= 0) { 
          this.currentTask = null; 
          this.restTimer = 1800; 
        }
      } else if (this.currentTask === 'gathering') {
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
      }
    } else {
      // Ограничение скорости для бродячих людей
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > this.maxSpeed) { this.vx = (this.vx / speed) * this.maxSpeed; this.vy = (this.vy / speed) * this.maxSpeed; }
    }

    // ОБЩЕЕ ПЕРЕМЕЩЕНИЕ (теперь применяется и для задач, и для бродяжничества):
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }
    this.x += this.vx; 
    this.y += this.vy;

    // Ограничение по границам экрана (остается без изменений)
    if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
    if (this.x > fieldSize - this.radius) { this.x = fieldSize - this.radius; this.vx *= -1; }
    if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
    if (this.y > fieldSize - this.radius) { this.y = fieldSize - this.radius; this.vy *= -1; }
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

  wanderGently(myBase) {
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
    this.x += this.vx;
    this.y += this.vy;
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

