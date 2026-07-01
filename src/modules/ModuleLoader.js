/**
 * ModuleLoader - Dynamically loads modules from the Modules folder
 */

import { moduleManager } from './ModuleManager';

export class ModuleLoader {
  /**
   * Load all modules from the modules directory
   * This function uses dynamic imports to load all .js files from the Modules folder
   */
  static async loadAllModules() {
    try {
      // Import all module files
      const modules = import.meta.glob('./*.js', { eager: true });
      
      for (const [path, module] of Object.entries(modules)) {
        // Skip ModuleManager and ModuleLoader themselves
        if (path.includes('ModuleManager') || path.includes('ModuleLoader')) {
          continue;
        }

        // Look for a default export or a module export
        const moduleExport = module.default || module.module;
        
        if (moduleExport && moduleExport.name) {
          moduleManager.registerModule(moduleExport);
        }
      }

      console.log(`[ModuleLoader] Loaded ${moduleManager.getModules().length} modules`);
      return moduleManager.getModules();
    } catch (error) {
      console.error('[ModuleLoader] Error loading modules:', error);
      return [];
    }
  }

  /**
   * Load a specific module by name
   */
  static async loadModule(moduleName) {
    try {
      const module = await import(/* @vite-ignore */ `./${moduleName}.js`);
      const moduleExport = module.default || module.module;
      
      if (moduleExport && moduleExport.name) {
        moduleManager.registerModule(moduleExport);
        return moduleExport;
      }
    } catch (error) {
      console.error(`[ModuleLoader] Error loading module ${moduleName}:`, error);
    }
    return null;
  }
}
