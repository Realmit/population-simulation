/**
 * Farmer Role Module
 * Adds farmer specialization to villagers
 */

export const FarmerRole = {
  name: 'FarmerRole',
  version: '1.0.6',
  description: 'Adds farmer role and farming system',

  init(moduleManager) {
    this.moduleManager = moduleManager;
    this.SOIL_SIZE = 20; // Size of each farming square
    this.BUCKWHEAT_GROW_TIME = 1800; // 30 seconds at 60fps
    this.PLANTING_TIME = 180; // 3 seconds
    this.SOIL_MAKING_TIME = 600; // 10 seconds
  },

  hooks: {
    onBaseUpdate(context) {
      const { base, humans } = context;

      if (!base.farmingSquares) base.farmingSquares = [];
      if (!base.farmers) base.farmers = [];

      const baseHumans = humans.filter(h => h.communityId === base.id && !h.isLeader);
      const requiredFarmerCount = Math.ceil(baseHumans.length / 10);

      let currentFarmers = baseHumans.filter(h => h.isFarmer);

      while (currentFarmers.length > requiredFarmerCount) {
        const firedFarmer = currentFarmers.pop(); 
        firedFarmer.isFarmer = false;
        firedFarmer.role = null;
        if (firedFarmer.currentTask === 'farming') {
          firedFarmer.currentTask = null; 
          firedFarmer.farmerTask = null;
          firedFarmer.taskTimer = 0;
          firedFarmer.maxTaskTimer = 0;
        }
      }

      if (currentFarmers.length < requiredFarmerCount) {
        const needed = requiredFarmerCount - currentFarmers.length;
        const availableHumans = baseHumans.filter(h => !h.isFarmer);
        availableHumans.sort((a, b) => a.id - b.id);

        for (let i = 0; i < Math.min(needed, availableHumans.length); i++) {
          const newFarmer = availableHumans[i];
          newFarmer.role = 'farmer';
          newFarmer.isFarmer = true;
          currentFarmers.push(newFarmer);
        }
      }
      base.farmers = currentFarmers;
    },

    onHumanUpdate(context) {
      const { human, myBase, waterCheckFn, currentResources } = context; 

      if (!human.isFarmer || !myBase) return;

      if (!human.farmerTask) human.farmerTask = null;
      if (!human.farmerTaskTimer) human.farmerTaskTimer = 0;
      if (!human.targetFarmSquare) human.targetFarmSquare = null;

      if (!human.currentTask || human.currentTask === 'going_to_leader') {
        human.currentTask = 'farming';
      }

      // --- NEW COLLISION CHECK HELPER ---
      const isSpotClear = (x, y) => {
        if (waterCheckFn(x, y)) return false; // Checks water AND mountains
        
        if (currentResources) {
          for (const r of currentResources) {
            const rRadius = r.type === 'tree' ? 6 : (r.type === 'stick' ? 2 : 10);
            if (Math.hypot(x - r.x, y - r.y) < rRadius + (FarmerRole.SOIL_SIZE / 2) + 2) {
              return false; // Too close to a resource!
            }
          }
        }
        return true;
      };

      // Task Execution Logic
      if (human.farmerTask === 'collecting_crop') {
        const matureCrop = myBase.farmingSquares?.find(
          sq => sq.crop === 'buckwheat' && sq.cropGrowthTime <= 0 && sq.minerId === human.id
        );

        if (matureCrop) {
          const dist = Math.hypot(human.x - matureCrop.x, human.y - matureCrop.y);
          if (dist > 5) {
            human.moveToTarget(matureCrop.x, matureCrop.y);
          } else {
            human.vx = 0; human.vy = 0;
            human.farmerTaskTimer--;
            human.taskTimer = human.farmerTaskTimer; 

            if (human.farmerTaskTimer <= 0) {
              if (myBase.resources) myBase.resources.food = (myBase.resources.food || 0) + 5;
              matureCrop.crop = null;
              matureCrop.minerId = null;
              human.farmerTask = null;
              human.currentTask = 'farming'; 
              human.taskTimer = 0;
              human.maxTaskTimer = 0;
              human.restTimer = 300;
            }
          }
        } else {
          human.farmerTask = null;
          human.currentTask = 'farming';
          human.taskTimer = 0;
        }
      } else if (human.farmerTask === 'planting_crop') {
        const emptySquare = myBase.farmingSquares?.find(
          sq => sq.crop === null && sq.isSoil && sq.minerId === human.id
        );

        if (emptySquare) {
          const dist = Math.hypot(human.x - emptySquare.x, human.y - emptySquare.y);
          if (dist > 5) {
            human.moveToTarget(emptySquare.x, emptySquare.y);
          } else {
            human.vx = 0; human.vy = 0;
            human.farmerTaskTimer--;
            human.taskTimer = human.farmerTaskTimer;

            if (human.farmerTaskTimer <= 0) {
              emptySquare.crop = 'buckwheat';
              emptySquare.cropGrowthTime = FarmerRole.BUCKWHEAT_GROW_TIME;
              emptySquare.minerId = null;
              human.farmerTask = null;
              human.currentTask = 'farming';
              human.taskTimer = 0;
              human.maxTaskTimer = 0;
              human.restTimer = 300;
            }
          }
        } else {
          human.farmerTask = null;
          human.currentTask = 'farming';
          human.taskTimer = 0;
        }
      } else if (human.farmerTask === 'making_soil') {
        const targetSquare = human.targetFarmSquare;

        if (targetSquare) {
          const dist = Math.hypot(human.x - targetSquare.x, human.y - targetSquare.y);
          if (dist > 5) {
            human.moveToTarget(targetSquare.x, targetSquare.y);
          } else {
            human.vx = 0; human.vy = 0;
            human.farmerTaskTimer--;
            human.taskTimer = human.farmerTaskTimer;

            if (human.farmerTaskTimer <= 0) {
              targetSquare.isSoil = true;
              targetSquare.minerId = null;
              human.targetFarmSquare = null;
              human.farmerTask = null;
              human.currentTask = 'farming';
              human.taskTimer = 0;
              human.maxTaskTimer = 0;
              human.restTimer = 300;
            }
          }
        } else {
          human.farmerTask = null;
          human.currentTask = 'farming';
          human.taskTimer = 0;
        }
      } else if (human.restTimer <= 0 && human.currentTask === 'farming') {
        
        const matureCrops = myBase.farmingSquares?.filter(
          sq => sq.crop === 'buckwheat' && sq.cropGrowthTime <= 0
        ) || [];

        if (matureCrops.length > 0) {
          human.farmerTask = 'collecting_crop';
          human.farmerTaskTimer = 300;
          human.taskTimer = 300;
          human.maxTaskTimer = 300;
          matureCrops[0].minerId = human.id;
        } else {
          const emptySoil = myBase.farmingSquares?.find(sq => sq.crop === null && sq.isSoil);

          if (emptySoil) {
            human.farmerTask = 'planting_crop';
            human.farmerTaskTimer = FarmerRole.PLANTING_TIME;
            human.taskTimer = FarmerRole.PLANTING_TIME;
            human.maxTaskTimer = FarmerRole.PLANTING_TIME;
            emptySoil.minerId = human.id;
          } else {
            if (!human.tool) {
              const r = myBase.resources || {};
              if (r.wood_tools > 0) {
                human.tool = 'wood';
                r.wood_tools--;
              } else if (r.stone_tools > 0) {
                human.tool = 'stone';
                r.stone_tools--;
              } else if (r.copper_tools > 0) {
                human.tool = 'copper';
                r.copper_tools--;
              } else if (r.wood >= 8) {
                r.wood -= 4;
                human.currentTask = 'crafting'; 
                human.taskTimer = 1200;
                human.maxTaskTimer = 1200;
                human.tool = 'wood';
              } else {
                human.farmerTask = null;
                human.currentTask = 'farming';
                human.restTimer = 300; 
              }
            } else {
              
              // --- SOIL EXPANSION LOGIC ---
              const allSoils = myBase.farmingSquares?.filter(sq => sq.isSoil) || [];
              let spotFound = false;

              // 1. Try to expand existing farms
              if (allSoils.length > 0) {
                for (const soil of allSoils) {
                  const adjacentSpots = [
                    { x: soil.x + FarmerRole.SOIL_SIZE, y: soil.y },
                    { x: soil.x - FarmerRole.SOIL_SIZE, y: soil.y },
                    { x: soil.x, y: soil.y + FarmerRole.SOIL_SIZE },
                    { x: soil.x, y: soil.y - FarmerRole.SOIL_SIZE },
                  ];

                  for (const spot of adjacentSpots) {
                    const occupied = myBase.farmingSquares?.some(
                      sq => Math.abs(sq.x - spot.x) < 5 && Math.abs(sq.y - spot.y) < 5
                    );

                    if (!occupied && isSpotClear(spot.x, spot.y)) {
                      const newSquare = {
                        x: spot.x, y: spot.y, isSoil: false, crop: null, cropGrowthTime: 0, minerId: human.id,
                      };
                      myBase.farmingSquares.push(newSquare);
                      human.farmerTask = 'making_soil';
                      human.farmerTaskTimer = FarmerRole.SOIL_MAKING_TIME;
                      human.taskTimer = FarmerRole.SOIL_MAKING_TIME;
                      human.maxTaskTimer = FarmerRole.SOIL_MAKING_TIME;
                      human.targetFarmSquare = newSquare;
                      spotFound = true;
                      break; 
                    }
                  }
                  if (spotFound) break; 
                }
              }

              // 2. If no existing farms could be expanded (or this is the very first soil block), 
              // start a brand new detached farm patch somewhere nearby
              if (!spotFound) {
                let rx, ry;
                let foundSafe = false;
                
                for(let attempts = 0; attempts < 30; attempts++) {
                   const angle = Math.random() * Math.PI * 2;
                   const dist = 40 + Math.random() * 80; // Distance from the base center
                   rx = myBase.x + Math.cos(angle) * dist;
                   ry = myBase.y + Math.sin(angle) * dist;
                   
                   if (isSpotClear(rx, ry)) {
                     // Ensure the new patch doesn't spawn halfway clipping into another soil square
                     const overlap = myBase.farmingSquares?.some(
                       sq => Math.hypot(sq.x - rx, sq.y - ry) < FarmerRole.SOIL_SIZE
                     );
                     
                     if (!overlap) {
                       foundSafe = true;
                       break;
                     }
                   }
                }
                
                if (foundSafe) {
                  const newSquare = {
                    x: rx, y: ry, isSoil: false, crop: null, cropGrowthTime: 0, minerId: human.id,
                  };
                  myBase.farmingSquares.push(newSquare);
                  human.farmerTask = 'making_soil';
                  human.farmerTaskTimer = FarmerRole.SOIL_MAKING_TIME;
                  human.taskTimer = FarmerRole.SOIL_MAKING_TIME;
                  human.maxTaskTimer = FarmerRole.SOIL_MAKING_TIME;
                  human.targetFarmSquare = newSquare;
                } else {
                  // The base is completely surrounded by obstacles, nowhere to farm.
                  human.farmerTask = null;
                  human.currentTask = 'farming';
                  human.restTimer = 300;
                }
              }
            }
          }
        }
      }

      if (myBase.farmingSquares) {
        myBase.farmingSquares.forEach(square => {
          if (square.crop === 'buckwheat' && square.cropGrowthTime > 0) {
            square.cropGrowthTime--;
          }
        });
      }
    },

    onResourceDraw(context) {
      const { ctx, moduleManager, bases } = context;
      const farmerModule = moduleManager.getModule('FarmerRole');

      if (!farmerModule || !bases) return;

      bases.forEach(base => {
        if (base.farmingSquares) {
          base.farmingSquares.forEach(square => {
            if (square.isSoil) {
              ctx.fillStyle = '#8B7355';
              ctx.fillRect(square.x - FarmerRole.SOIL_SIZE / 2, square.y - FarmerRole.SOIL_SIZE / 2, FarmerRole.SOIL_SIZE, FarmerRole.SOIL_SIZE);
              ctx.strokeStyle = '#654321';
              ctx.lineWidth = 1;
              ctx.strokeRect(square.x - FarmerRole.SOIL_SIZE / 2, square.y - FarmerRole.SOIL_SIZE / 2, FarmerRole.SOIL_SIZE, FarmerRole.SOIL_SIZE);
            }

            if (square.crop === 'buckwheat') {
              const growthProgress = 1 - square.cropGrowthTime / FarmerRole.BUCKWHEAT_GROW_TIME;
              const plantHeight = 8 * growthProgress;

              ctx.fillStyle = '#90EE90';
              ctx.beginPath();
              ctx.ellipse(square.x, square.y - plantHeight / 2, 4, plantHeight / 2, 0, 0, Math.PI * 2);
              ctx.fill();

              if (growthProgress < 1) {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                ctx.fillRect(square.x - 6, square.y + 8, 12 * growthProgress, 2);
              }
            }
          });
        }
      });
    },

    onHumanDraw(context) {
      const { human, ctx } = context;
      if (human.isFarmer) {
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌾', human.x, human.y - human.radius - 6);
        ctx.restore();
      }
    },

    onRenderHumanRole(context) {
      const { human, rolesHtml } = context;
      if (human.isFarmer) {
        rolesHtml.push('🌾');
      }
    }
  }
};

export default FarmerRole;