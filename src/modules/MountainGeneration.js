/**
 * Mountain Generation Module
 * Adds mountain terrain objects to the game world
 */

export const MountainGeneration = {
  name: 'MountainGeneration',
  version: '1.0.1',
  description: 'Generates mountain terrain on the map',

  init(moduleManager) {
    // Initialize mountains data structure
    this.mountains = [];
    this.moduleManager = moduleManager;
  },

  hooks: {
    onSimulationInit(context) {
      const { fieldSize, lakes, rivers, generateMountains } = context;
      const mountainModule = context.moduleManager.getModule('MountainGeneration');
      
      if (!mountainModule) return;

      // Reset mountains array
      mountainModule.mountains = [];
      context.mountains = [];

      // Check if generation is enabled from the UI
      if (generateMountains === false) {
        return;
      }

      // Generate 4-6 mountains
      const mountainCount = 4 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < mountainCount; i++) {
        let valid = false;
        let attempts = 0;
        let mx, my, mSize;

        while (!valid && attempts < 50) {
          mx = 100 + Math.random() * (fieldSize - 200);
          my = 100 + Math.random() * (fieldSize - 200);
          mSize = 40 + Math.random() * 60; // Mountain radius

          valid = true;

          // Check distance from lakes
          if (lakes) {
            for (let lake of lakes) {
              const dist = Math.hypot(mx - lake.x, my - lake.y);
              if (dist < mSize + Math.max(lake.a, lake.b) + 50) {
                valid = false;
                break;
              }
            }
          }

          // Check distance from rivers
          if (valid && rivers) {
            for (let river of rivers) {
              for (let point of river.points) {
                const dist = Math.hypot(mx - point.x, my - point.y);
                if (dist < mSize + river.thickness + 50) {
                  valid = false;
                  break;
                }
              }
              if (!valid) break;
            }
          }

          // Check distance from other mountains
          if (valid && mountainModule.mountains) {
            for (let mountain of mountainModule.mountains) {
              const dist = Math.hypot(mx - mountain.x, my - mountain.y);
              if (dist < mSize + mountain.size + 30) {
                valid = false;
                break;
              }
            }
          }

          attempts++;
        }

        if (valid) {
          mountainModule.mountains.push({
            x: mx,
            y: my,
            size: mSize,
            height: 50 + Math.random() * 100, // Visual height variation
            color: `hsl(${30 + Math.random() * 20}, ${40 + Math.random() * 20}%, ${40 + Math.random() * 15}%)`,
          });
        }
      }

      // Store mountains in context for other modules
      context.mountains = mountainModule.mountains;
    },

    onResourceDraw(context) {
      const { ctx, moduleManager } = context;
      const mountainModule = moduleManager.getModule('MountainGeneration');
      
      if (!mountainModule || !mountainModule.mountains) return;

      // Draw mountains
      for (let mountain of mountainModule.mountains) {
        // Draw mountain shadow/base
        ctx.beginPath();
        ctx.ellipse(mountain.x, mountain.y + mountain.size * 0.3, mountain.size, mountain.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();

        // Draw mountain peak (triangle)
        ctx.beginPath();
        ctx.moveTo(mountain.x, mountain.y - mountain.size);
        ctx.lineTo(mountain.x - mountain.size * 0.7, mountain.y + mountain.size * 0.3);
        ctx.lineTo(mountain.x + mountain.size * 0.7, mountain.y + mountain.size * 0.3);
        ctx.closePath();
        ctx.fillStyle = mountain.color;
        ctx.fill();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw snow cap
        ctx.beginPath();
        ctx.moveTo(mountain.x, mountain.y - mountain.size);
        ctx.lineTo(mountain.x - mountain.size * 0.3, mountain.y - mountain.size * 0.3);
        ctx.lineTo(mountain.x + mountain.size * 0.3, mountain.y - mountain.size * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    },
  },

  /**
   * Check if a position is inside a mountain (for collision detection)
   */
  isInMountain(x, y) {
    if (!this.mountains) return false;
    
    for (let mountain of this.mountains) {
      const dist = Math.hypot(x - mountain.x, y - mountain.y);
      if (dist < mountain.size * 0.8) {
        return true;
      }
    }
    return false;
  },

  /**
   * Get all mountains
   */
  getMountains() {
    return this.mountains || [];
  },
};

export default MountainGeneration;