# Module System Documentation

## Overview

The Population Simulation now features a **modular architecture** that allows developers to extend game functionality without modifying core files. Modules can:

1. **Modify human behavior** - Add new traits, specialties, and roles
2. **Extend canvas rendering** - Add new terrain objects, resources, and visual elements
3. **Add game mechanics** - Implement new systems like food management, farming, etc.

## Module Structure

Each module is a JavaScript object with the following structure:

```javascript
export const ModuleName = {
  name: 'ModuleName',                    // Unique identifier
  version: '1.0.0',                      // Semantic versioning
  description: 'Module description',     // What it does
  
  init(moduleManager) {
    // Initialize module state
    // Called when module is registered
  },
  
  hooks: {
    // Hook implementations (see Hook Types below)
    onSimulationInit(context) { },
    onHumanUpdate(context) { },
    // ... other hooks
  },
  
  // Optional: Custom methods
  customMethod() { }
};

export default ModuleName;
```

## Hook Types

Modules can implement the following hooks:

### Simulation Hooks
- **`onSimulationInit(context)`** - Called when simulation initializes
  - Context: `{ fieldSize, lakes, rivers, bases, moduleManager }`
  - Use for: Generating terrain, initializing game state

### Human Hooks
- **`onHumanCreated(context)`** - Called when a human is created
  - Context: `{ human, moduleManager }`
  
- **`onHumanUpdate(context)`** - Called every frame for each human
  - Context: `{ human, myBase, leaderHuman, currentResources, waterCheckFn, moduleManager }`
  - Use for: Custom AI, task assignment, behavior modification

- **`onHumanDraw(context)`** - Called when drawing each human
  - Context: `{ human, ctx, moduleManager }`
  - Use for: Custom visual indicators, icons, overlays

### Base Hooks
- **`onBaseCreated(context)`** - Called when a settlement is created
  - Context: `{ base, moduleManager }`

- **`onBaseUpdate(context)`** - Called every frame for each base
  - Context: `{ base, humans, moduleManager }`
  - Use for: Resource management, population control

- **`onBaseDraw(context)`** - Called when drawing each base
  - Context: `{ base, ctx, moduleManager }`

### Resource Hooks
- **`onResourceSpawn(context)`** - Called when a resource is spawned
  - Context: `{ resource, moduleManager }`

- **`onResourceUpdate(context)`** - Called every frame for each resource
  - Context: `{ resource, moduleManager }`

- **`onResourceDraw(context)`** - Called when drawing resources
  - Context: `{ ctx, moduleManager }`
  - Use for: Custom terrain, visual effects

## Built-in Modules

### 1. Mountain Generation Module
**File:** `src/modules/MountainGeneration.js`

Generates mountain terrain on the map.

**Features:**
- Generates 4-6 mountains randomly placed
- Avoids lakes, rivers, and other mountains
- Mountains act as visual obstacles
- Provides collision detection

**Usage:**
```javascript
const mountainModule = moduleManager.getModule('MountainGeneration');
const mountains = mountainModule.getMountains();
const isInMountain = mountainModule.isInMountain(x, y);
```

### 2. Food System Module
**File:** `src/modules/FoodSystem.js`

Adds food resource management to settlements.

**Features:**
- Each settlement starts with 100 food
- Food consumption check every 2 minutes (7200 frames)
- Food decreases by population count per check
- Villagers die if they miss 2 meals in a row (4 minutes)
- Last villagers in list get food first (priority system)

**Mechanics:**
- Every 2 minutes: `food -= population`
- If `food < population`: Some villagers don't eat
- If villager misses 2 meals: `isDead = true`
- Dead villagers are removed from simulation

**Usage:**
```javascript
const foodModule = moduleManager.getModule('FoodSystem');
foodModule.addFood(base, 50);  // Add 50 food to base
const status = foodModule.getFoodStatus(base, populationCount);
// Returns: { food, needed, status: 'good'|'warning'|'critical' }
```

### 3. Farmer Role Module
**File:** `src/modules/FarmerRole.js`

Adds farmer specialization and farming system.

**Features:**
- Farmers assigned based on population: `ceil(population / 10)`
- Farmers prioritize: harvest → plant → make tools → make soil
- Buckwheat crop takes 30 seconds to grow
- Planting takes 3 seconds
- Making soil takes 10 seconds
- Soil can only be made adjacent to existing soil (grid-based)
- Farmers have 🌾 icon above their head

**Farming Mechanics:**
1. **Soil Making** (10 seconds)
   - Creates new farming square next to existing soil
   - Can't be placed on water, resources, or buildings
   - Grid-based placement (20px squares)

2. **Planting** (3 seconds)
   - Plants buckwheat on prepared soil
   - Requires farmer to have a tool

3. **Growing** (30 seconds)
   - Buckwheat grows automatically
   - Visual progress indicator shown

4. **Harvesting** (5 seconds)
   - Collects mature buckwheat
   - Adds 5 food to base resources

**Usage:**
```javascript
const farmerModule = moduleManager.getModule('FarmerRole');
const farmers = farmerModule.getFarmers(base);
const farmingSquares = farmerModule.getFarmingSquares(base);
```

## Creating a Custom Module

### Example: Simple Resource Multiplier Module

```javascript
export const ResourceMultiplier = {
  name: 'ResourceMultiplier',
  version: '1.0.0',
  description: 'Doubles resource gathering speed',

  init(moduleManager) {
    this.multiplier = 2;
  },

  hooks: {
    onHumanUpdate(context) {
      const { human } = context;
      
      // Modify gathering speed
      if (human.currentTask === 'gathering' && human.taskTimer > 0) {
        human.taskTimer -= (this.multiplier - 1);
      }
    }
  }
};

export default ResourceMultiplier;
```

### Example: Custom Trait Module

```javascript
export const TraitSystem = {
  name: 'TraitSystem',
  version: '1.0.0',
  description: 'Adds personality traits to humans',

  init(moduleManager) {
    this.traits = ['hardworker', 'lazy', 'smart', 'strong'];
  },

  hooks: {
    onHumanCreated(context) {
      const { human } = context;
      
      // Assign random trait
      human.trait = this.traits[Math.floor(Math.random() * this.traits.length)];
      
      // Modify stats based on trait
      if (human.trait === 'hardworker') {
        human.strength += 10;
      } else if (human.trait === 'lazy') {
        human.strength -= 5;
      }
    },

    onHumanDraw(context) {
      const { human, ctx } = context;
      
      // Draw trait indicator
      ctx.fillStyle = '#FFD700';
      ctx.font = '8px sans-serif';
      ctx.fillText(human.trait[0].toUpperCase(), human.x - 2, human.y - 8);
    }
  }
};

export default TraitSystem;
```

## Module Manager API

### Methods

```javascript
// Register a module
moduleManager.registerModule(module);

// Execute hooks
moduleManager.executeHook('onHumanUpdate', context);

// Get modules
const module = moduleManager.getModule('ModuleName');
const allModules = moduleManager.getModules();

// Game state
moduleManager.setGameState(gameState);
const state = moduleManager.getGameState();

// Custom hooks
moduleManager.addHookType('customHookName');
moduleManager.on('customHookName', callback);
```

## Module Loading

Modules are automatically loaded when the simulation starts. Place your module files in `src/modules/` directory with `.js` extension.

**File naming convention:**
- Use PascalCase: `MyModule.js`
- Export as default: `export default MyModule;`
- Include name property: `name: 'MyModule'`

## Best Practices

1. **Namespace your data** - Store module-specific data on objects with a prefix
   ```javascript
   human.farmerTask = 'planting';  // Good
   human.task = 'planting';        // Might conflict
   ```

2. **Check for existence** - Always verify objects exist before modifying
   ```javascript
   if (!base.resources) base.resources = {};
   if (base.resources.food === undefined) base.resources.food = 0;
   ```

3. **Use optional chaining** - Safely access nested properties
   ```javascript
   const food = base.resources?.food || 0;
   ```

4. **Document your hooks** - Explain what context properties you use
   ```javascript
   /**
    * Called every frame for each human
    * Uses: human.x, human.y, human.currentTask
    * Modifies: human.farmerTask, human.taskTimer
    */
   onHumanUpdate(context) { }
   ```

5. **Handle edge cases** - Check for null/undefined values
   ```javascript
   if (!myBase || !myBase.farmingSquares) return;
   ```

6. **Performance** - Avoid expensive operations in update hooks
   ```javascript
   // Bad: Recalculating every frame
   onHumanUpdate(context) {
     const farmers = humans.filter(h => h.isFarmer);
   }
   
   // Good: Cache in init or update less frequently
   onBaseUpdate(context) {
     if (tickCount % 60 === 0) {  // Every second
       base.farmers = humans.filter(h => h.isFarmer);
     }
   }
   ```

## Debugging Modules

Enable console logging to debug modules:

```javascript
// In your module
init(moduleManager) {
  console.log(`[${this.name}] Initializing...`);
}

hooks: {
  onHumanUpdate(context) {
    if (context.human.isFarmer) {
      console.log(`[FarmerRole] Farmer task: ${context.human.farmerTask}`);
    }
  }
}
```

Check browser console (F12) for module loading messages and errors.

## Troubleshooting

### Module not loading
- Check file is in `src/modules/` directory
- Verify `name` property exists
- Check for syntax errors in console

### Hooks not executing
- Verify hook name matches exactly (case-sensitive)
- Check module is registered: `moduleManager.getModules()`
- Ensure context object has required properties

### Performance issues
- Profile with DevTools (F12 → Performance)
- Reduce hook execution frequency
- Cache expensive calculations
- Avoid creating new objects every frame

## Future Enhancements

Potential additions to the module system:

- Module dependencies and load order
- Module configuration files
- Hot module reloading
- Module marketplace/registry
- Performance profiling tools
- Module conflict detection
