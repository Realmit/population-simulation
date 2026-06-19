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

    const randomIndex = Math.floor(Math.random() * SETTLEMENT_NAMES.length);
    this.name = SETTLEMENT_NAMES[randomIndex];
    
    // Generate a vibrant random color for the colony
    this.color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`; 
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 15, this.y - 15, 30, 30);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 15, this.y - 15, 30, 30);
  }

  // ---- NEW: draw the label **after** everything else ----
  drawLabel(ctx) {
    const label = `${this.name} - Pop: ${this.population}/${this.populationLimit}`;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Measure text width so we can keep it inside the canvas
    const metrics    = ctx.measureText(label);
    const labelWidth = metrics.width;
    const canvasW    = ctx.canvas.width;
    const canvasH    = ctx.canvas.height;

    // Desired position (centered above the base)
    let labelX = this.x;
    let labelY = this.y - 25;

    const padding    = 5;   // keep a few pixels from the edge
    const lineHeight = 16;  // approx. height of a 14 px font

    // ----- Horizontal clamping -----
    if (labelX - labelWidth / 2 < padding) {
      labelX = padding + labelWidth / 2;
    }
    if (labelX + labelWidth / 2 > canvasW - padding) {
      labelX = canvasW - padding - labelWidth / 2;
    }

    // ----- Vertical clamping (avoid the top edge) -----
    if (labelY - lineHeight < padding) {
      labelY = padding + lineHeight;
    }

    // ----- Grey‑transparent shadow -----
    ctx.fillStyle   = 'rgba(0,0,0,0.5)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 4;
    ctx.fillText(label, labelX + 1, labelY + 1); // offset shadow

    // ----- Thin grey outline for extra contrast -----
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(80,80,80,0.6)';
    ctx.strokeText(label, labelX, labelY);

    // ----- Final white fill (on top) -----
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#ffffff';
    ctx.fillText(label, labelX, labelY);
  }
}