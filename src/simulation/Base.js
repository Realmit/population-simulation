import { SETTLEMENT_NAMES } from './settlementNames';

export class Base {
  constructor(id, x, y, initialPopulation) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.population = initialPopulation;
    
    // --- NEW PROPERTIES FOR REPLANTING & POPULATION CAP ---
    // Sets a default minimum limit of 4, or higher if starting pop is larger
    this.populationLimit = Math.max(4, initialPopulation); 
    this.replantWindowTimer = 0;
    this.replantedThisPeriod = 0;
    // ------------------------------------------------------

    const randomIndex = Math.floor(Math.random() * SETTLEMENT_NAMES.length);
    this.name = SETTLEMENT_NAMES[randomIndex];
    
    // Generate a vibrant random color for the colony
    this.color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`; 
  }

  draw(ctx) {
    // Draw the Base colored to match the colony
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 15, this.y - 15, 30, 30);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 15, this.y - 15, 30, 30);

    // Draw the Village Name & Population Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    
    // Visually show Population vs Population Limit
    ctx.fillText(`${this.name} - Pop: ${this.population}/${this.populationLimit}`, this.x, this.y - 25);
    
    ctx.shadowBlur = 0;
  }
}