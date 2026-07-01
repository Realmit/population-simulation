/**
 * ModuleManager - Handles loading and managing game modules
 * Modules can extend game functionality by:
 * 1. Adding new traits/specialties to humans
 * 2. Adding new terrain objects, resources, and live objects
 * 3. Modifying game behavior through hooks
 */

export class ModuleManager {
  constructor() {
    this.modules = [];
    this.hooks = {
      // Human-related hooks
      onHumanCreated: [],
      onHumanUpdate: [],
      onHumanDraw: [],
      
      // Resource-related hooks
      onResourceSpawn: [],
      onResourceUpdate: [],
      onResourceDraw: [],
      
      // Base-related hooks
      onBaseCreated: [],
      onBaseUpdate: [],
      onBaseDraw: [],
      
      // Simulation hooks
      onSimulationTick: [],
      onSimulationInit: [],

      // UI hooks for rendering additional information
      onRenderBaseResources: [],  // Render additional resources in base UI
      onRenderHumanRole: [],      // Render additional role icons for humans
    };
    
    this.gameState = {
      humans: [],
      bases: [],
      resources: [],
      canvas: null,
      ctx: null,
      fieldSize: 1000,
    };
  }

  /**
   * Register a module
   * @param {Object} module - Module object with name, version, and hooks
   */
  registerModule(module) {
    if (!module.name) {
      console.error('Module must have a name');
      return false;
    }
    if (this.modules.some(m => m.name === module.name)) {
      console.warn(`[ModuleManager] Module ${module.name} is already registered.`);
      return false; 
    }

    console.log(`[ModuleManager] Registering module: ${module.name} v${module.version || '1.0'}`);
    
    this.modules.push(module);

    // Register all hooks provided by the module
    if (module.hooks) {
      for (const [hookName, hookFn] of Object.entries(module.hooks)) {
        if (this.hooks[hookName]) {
          this.hooks[hookName].push(hookFn);
        } else {
          console.warn(`[ModuleManager] Unknown hook: ${hookName}`);
        }
      }
    }

    // Call module initialization if provided
    if (module.init) {
      module.init(this);
    }

    return true;
  }

  /**
   * Execute all hooks for a given hook name
   * @param {string} hookName - Name of the hook to execute
   * @param {Object} context - Context object to pass to hooks
   */
  executeHook(hookName, context) {
    if (!this.hooks[hookName]) {
      console.warn(`[ModuleManager] Unknown hook: ${hookName}`);
      return;
    }

    for (const hookFn of this.hooks[hookName]) {
      try {
        hookFn(context);
      } catch (error) {
        console.error(`[ModuleManager] Error executing hook ${hookName}:`, error);
      }
    }
  }

  /**
   * Set game state reference for modules to access
   */
  setGameState(gameState) {
    this.gameState = { ...this.gameState, ...gameState };
  }

  /**
   * Get game state
   */
  getGameState() {
    return this.gameState;
  }

  /**
   * Get a specific module by name
   */
  getModule(name) {
    return this.modules.find(m => m.name === name);
  }

  /**
   * Get all loaded modules
   */
  getModules() {
    return [...this.modules];
  }

  /**
   * Add a custom hook type (for modules to extend)
   */
  addHookType(hookName) {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
  }

  /**
   * Register a custom hook listener
   */
  on(hookName, callback) {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(callback);
  }
}

// Global module manager instance
export const moduleManager = new ModuleManager();
