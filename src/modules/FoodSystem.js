/**
 * Food System Module
 * Adds food resource management to the game
 * - Food decreases every 2 minutes based on population
 * - Villagers die if they skip 2 meals in a row (4 minutes without food)
 */

export const FoodSystem = {
  name: 'FoodSystem',
  version: '1.0.0',
  description: 'Adds food resource management system',

  init(moduleManager) {
    this.moduleManager = moduleManager;
    this.foodCheckInterval = 7200; // 2 minutes at 60fps (120 seconds * 60)
    this.mealMissedThreshold = 2; // 2 missed meals = death
    this.foodPerPerson = 1; // Food consumed per person per check
  },

  hooks: {
    onSimulationInit(context) {
      const { bases } = context;
      
      // Initialize food for each base
      if (bases) {
        bases.forEach(base => {
          if (!base.resources) {
            base.resources = {};
          }
          base.resources.food = 20; // Starting food
          base.foodCheckTimer = 0;
        });
      }
    },

    onBaseUpdate(context) {
      const { base, humans, moduleManager } = context;
      
      if (!base.resources) {
        base.resources = {};
      }
      if (base.resources.food === undefined) {
        base.resources.food = 20; // Starting food
0;
      }

      // Initialize food check timer
      if (!base.foodCheckTimer) {
        base.foodCheckTimer = 0;
      }

      base.foodCheckTimer++;

      // Every 2 minutes, check food consumption
      if (base.foodCheckTimer >= 7200) {
        base.foodCheckTimer = 0;

        const baseHumans = humans.filter(h => h.communityId === base.id);
        const foodNeeded = baseHumans.length;

        if (base.resources.food >= foodNeeded) {
          // Enough food - everyone eats
          base.resources.food -= foodNeeded;
          baseHumans.forEach(human => {
            human.mealsMissed = 0;
          });
        } else {
          // Not enough food - some people starve
          const fedCount = Math.floor(base.resources.food);
          base.resources.food = 0;

          // Sort by villager list order (last ones don't get food)
          const sortedHumans = [...baseHumans].sort((a, b) => a.id - b.id);

          for (let i = 0; i < sortedHumans.length; i++) {
            if (i < fedCount) {
              sortedHumans[i].mealsMissed = 0;
            } else {
              sortedHumans[i].mealsMissed = (sortedHumans[i].mealsMissed || 0) + 1;

              // If missed 2 meals in a row, they die
              if (sortedHumans[i].mealsMissed >= 2) {
                sortedHumans[i].isDead = true;
              }
            }
          }
        }
      }
    },

    onHumanUpdate(context) {
      const { human } = context;
      
      // Initialize meals missed counter
      if (human.mealsMissed === undefined) {
        human.mealsMissed = 0;
      }

      // Remove dead humans from simulation
      if (human.isDead) {
        human.isDead = true; // Mark for removal
      }
    },

    onHumanDraw(context) {
      const { human, ctx } = context;

      // Draw hunger indicator if human is starving
      if (human.mealsMissed && human.mealsMissed > 0) {
        ctx.beginPath();
        ctx.arc(human.x, human.y + human.radius + 5, 2, 0, Math.PI * 2);
        ctx.fillStyle = human.mealsMissed >= 2 ? '#FF0000' : '#FFA500'; // Red if critical, orange if warning
        ctx.fill();
      }
    },

    onRenderBaseResources(context) {
      const { base, resourcesHtml } = context;
      
      if (!base.resources || base.resources.food === undefined) {
        return;
      }

      // Add food to the resources display
      resourcesHtml.push(`🍖 Food: ${base.resources.food || 0}`);
    },
  },

  /**
   * Add food to a base
   */
  addFood(base, amount) {
    if (!base.resources) {
      base.resources = {};
    }
    if (base.resources.food === undefined) {
      base.resources.food = 0;
    }
    base.resources.food += amount;
  },

  /**
   * Get food status for a base
   */
  getFoodStatus(base, populationCount) {
    if (!base.resources || base.resources.food === undefined) {
      return { food: 0, needed: populationCount, status: 'critical' };
    }

    const food = base.resources.food;
    const needed = populationCount;
    let status = 'good';

    if (food < needed * 0.5) status = 'warning';
    if (food < needed * 0.2) status = 'critical';

    return { food, needed, status };
  },
};

export default FoodSystem;
