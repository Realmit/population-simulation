# Module System Quick Start Guide

## What's New?

Your population simulation now has a **modular architecture**! This means:

✅ **Add new features without touching core code**
✅ **Three ready-to-use modules included**
✅ **Easy to create custom modules**
✅ **Extensible hook system**

## The Three Included Modules

### 1. 🏔️ Mountain Generation
- Generates 4-6 mountains on the map
- Mountains are visual obstacles
- Automatically avoids water and other terrain

### 2. 🍖 Food System
- Settlements start with 100 food
- Food consumed every 2 minutes based on population
- Villagers die if they miss 2 meals in a row
- Adds hunger indicator (orange/red dot) above starving villagers

### 3. 👨‍🌾 Farmer Role
- Automatically assigns farmers (1 per 10 population)
- Farmers plant buckwheat crops (30 seconds to grow)
- Farming workflow: harvest → plant → make tools → make soil
- Farmers marked with 🌾 icon
- Produces food for the settlement

## How Modules Work

### Module Structure
```javascript
export const MyModule = {
  name: 'MyModule',
  version: '1.0.0',
  description: 'What it does',
  
  init(moduleManager) {
    // Initialize your module
  },
  
  hooks: {
    onHumanUpdate(context) {
      // Called every frame for each human
    },
    onResourceDraw(context) {
      // Called when drawing resources
    }
    // ... other hooks
  }
};

export default MyModule;
```

### Available Hooks

**Simulation:**
- `onSimulationInit` - When game starts

**Humans:**
- `onHumanCreated` - When human spawns
- `onHumanUpdate` - Every frame per human
- `onHumanDraw` - When drawing human

**Bases:**
- `onBaseCreated` - When settlement forms
- `onBaseUpdate` - Every frame per base
- `onBaseDraw` - When drawing base

**Resources:**
- `onResourceSpawn` - When resource created
- `onResourceUpdate` - Every frame per resource
- `onResourceDraw` - When drawing resources

## Creating Your First Module

### Step 1: Create the file
Create `src/modules/MyFirstModule.js`:

```javascript
export const MyFirstModule = {
  name: 'MyFirstModule',
  version: '1.0.0',
  description: 'My first custom module',

  init(moduleManager) {
    console.log('MyFirstModule initialized!');
  },

  hooks: {
    onHumanDraw(context) {
      const { human, ctx } = context;
      
      // Draw a star above each human
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(human.x, human.y - 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

export default MyFirstModule;
```

### Step 2: That's it!
The module will automatically load when the game starts. Check the browser console (F12) to see:
```
[ModuleManager] Registering module: MyFirstModule v1.0.0
[ModuleLoader] Loaded 4 modules
```

## Common Module Patterns

### Pattern 1: Add a new resource type
```javascript
export const GoldMining = {
  name: 'GoldMining',
  version: '1.0.0',
  
  hooks: {
    onResourceDraw(context) {
      const { ctx, moduleManager } = context;
      const gameState = moduleManager.getGameState();
      
      // Draw gold resources
      if (gameState.resources) {
        gameState.resources
          .filter(r => r.type === 'gold_ore')
          .forEach(res => {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(res.x - 5, res.y - 5, 10, 10);
          });
      }
    }
  }
};

export default GoldMining;
```

### Pattern 2: Modify human behavior
```javascript
export const FastWorkers = {
  name: 'FastWorkers',
  version: '1.0.0',
  
  hooks: {
    onHumanUpdate(context) {
      const { human } = context;
      
      // Make gathering 50% faster
      if (human.currentTask === 'gathering' && human.taskTimer > 0) {
        human.taskTimer -= 0.5;
      }
    }
  }
};

export default FastWorkers;
```

### Pattern 3: Add visual indicators
```javascript
export const HealthBars = {
  name: 'HealthBars',
  version: '1.0.0',
  
  hooks: {
    onHumanDraw(context) {
      const { human, ctx } = context;
      
      // Draw health bar above human
      const healthPercent = human.health / 100;
      ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : '#FF0000';
      ctx.fillRect(human.x - 5, human.y - 15, 10 * healthPercent, 2);
    }
  }
};

export default HealthBars;
```

## Module Manager API

```javascript
import { moduleManager } from '../modules/ModuleManager';

// Get a specific module
const farmerModule = moduleManager.getModule('FarmerRole');

// Get all modules
const allModules = moduleManager.getModules();

// Access game state
const gameState = moduleManager.getGameState();
console.log(gameState.humans);
console.log(gameState.bases);
console.log(gameState.resources);

// Call module methods
const farmers = farmerModule.getFarmers(base);
const farmingSquares = farmerModule.getFarmingSquares(base);
```

## Debugging Tips

### Check if module loaded
```javascript
// In browser console (F12)
moduleManager.getModules()
// Should show your module in the list
```

### Add logging
```javascript
export const MyModule = {
  name: 'MyModule',
  
  hooks: {
    onHumanUpdate(context) {
      const { human } = context;
      if (human.id === 0) {  // Only log first human
        console.log(`[MyModule] Human 0 at (${human.x}, ${human.y})`);
      }
    }
  }
};
```

### Check context properties
```javascript
hooks: {
  onHumanUpdate(context) {
    console.log('Available context:', Object.keys(context));
    // Shows: ['human', 'myBase', 'leaderHuman', 'currentResources', 'waterCheckFn', 'moduleManager']
  }
}
```

## Performance Tips

1. **Avoid expensive operations in update hooks**
   ```javascript
   // ❌ Bad - runs every frame
   onHumanUpdate(context) {
     const farmers = context.humans.filter(h => h.isFarmer);
   }
   
   // ✅ Good - cache the result
   onBaseUpdate(context) {
     context.base.farmers = context.humans.filter(h => h.isFarmer);
   }
   ```

2. **Use optional chaining**
   ```javascript
   // ✅ Safe
   const food = base.resources?.food || 0;
   ```

3. **Check before modifying**
   ```javascript
   // ✅ Good
   if (!base.resources) base.resources = {};
   base.resources.food = 100;
   ```

## File Structure

```
src/
├── modules/
│   ├── ModuleManager.js          ← Core module system
│   ├── ModuleLoader.js           ← Auto-loads modules
│   ├── MountainGeneration.js     ← Mountain terrain
│   ├── FoodSystem.js             ← Food management
│   ├── FarmerRole.js             ← Farming system
│   └── YourModule.js             ← Your custom module
├── components/
│   └── SimulationCanvas.jsx      ← Updated to use modules
├── simulation/
│   ├── Human.js
│   ├── Base.js
│   └── names.js
└── ...
```

## Next Steps

1. **Read MODULES.md** for detailed documentation
2. **Examine existing modules** to understand patterns
3. **Create your first module** using the patterns above
4. **Test in browser** and check console for errors
5. **Share your modules** with the community!

## Example: Complete Weather Module

```javascript
export const WeatherSystem = {
  name: 'WeatherSystem',
  version: '1.0.0',
  description: 'Adds weather effects to the simulation',

  init(moduleManager) {
    this.weatherTypes = ['sunny', 'rainy', 'stormy'];
    this.currentWeather = 'sunny';
    this.weatherTimer = 0;
    this.weatherDuration = 3600; // 1 minute
  },

  hooks: {
    onSimulationTick(context) {
      this.weatherTimer++;
      
      if (this.weatherTimer >= this.weatherDuration) {
        this.weatherTimer = 0;
        this.currentWeather = this.weatherTypes[
          Math.floor(Math.random() * this.weatherTypes.length)
        ];
        console.log(`[Weather] Changed to ${this.currentWeather}`);
      }
    },

    onHumanUpdate(context) {
      const { human } = context;
      
      // Rainy weather slows down work
      if (this.currentWeather === 'rainy' && human.currentTask === 'gathering') {
        human.taskTimer += 0.2; // Takes 20% longer
      }
    },

    onResourceDraw(context) {
      const { ctx } = context;
      
      // Draw weather effect
      if (this.currentWeather === 'rainy') {
        ctx.fillStyle = 'rgba(100, 150, 200, 0.1)';
        ctx.fillRect(0, 0, 1000, 1000);
      } else if (this.currentWeather === 'stormy') {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.2)';
        ctx.fillRect(0, 0, 1000, 1000);
      }
    }
  },

  getWeather() {
    return this.currentWeather;
  }
};

export default WeatherSystem;
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Module not loading | Check file is in `src/modules/`, has `name` property, and exports default |
| Hooks not running | Verify hook name is exact (case-sensitive), check console for errors |
| Context is undefined | Make sure you're destructuring: `const { human, ctx } = context;` |
| Performance issues | Profile with DevTools, reduce hook frequency, cache calculations |
| Module conflicts | Use unique property names, check for naming collisions |

## Support

For detailed documentation, see **MODULES.md**

For questions or issues:
1. Check browser console (F12) for error messages
2. Review existing module implementations
3. Read the MODULES.md documentation
4. Check the troubleshooting section

Happy modding! 🎮
